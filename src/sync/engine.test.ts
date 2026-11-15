import { IDBFactory, IDBKeyRange } from 'fake-indexeddb'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRepository, type Repository } from '../db/repository'
import { PontoDb } from '../db/schema'
import { at } from '../lib/test-helpers'
import { DEFAULT_SETTINGS } from '../lib/types'
import { createSyncEngine } from './engine'
import { createMemoryRemote } from './memoryRemote'

const UID = 'usuario-a'
let n = 0

function device(remote: ReturnType<typeof createMemoryRemote>) {
  const repo = createRepository(new PontoDb(`aparelho-${++n}`, { indexedDB: new IDBFactory(), IDBKeyRange }))
  const onRemoteChange = vi.fn()
  const engine = createSyncEngine({ repo, remote, lock: (run) => run(), onRemoteChange })
  return { repo, engine, onRemoteChange }
}

/** Avança o relógio do app, para cada gravação ter um `updatedAt` diferente. */
function clockAt(iso: string) {
  vi.setSystemTime(new Date(iso))
}

const day = (repo: Repository) => repo.listIntervals('2026-11-09', '2026-11-09')

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  clockAt('2026-11-09T12:00:00.000Z')
})

afterEach(() => {
  vi.useRealTimers()
})

describe('enviar e receber', () => {
  it('CA3/CA7: o que é gravado num aparelho aparece no outro', async () => {
    const remote = createMemoryRemote()
    const mac = device(remote)
    const android = device(remote)
    await mac.engine.link(UID, 'upload')
    await android.engine.link(UID, 'upload')

    const created = await mac.repo.createInterval({ start: at('2026-11-09 08:00'), end: at('2026-11-09 12:00') })
    await mac.repo.setDayOff('2026-11-10', 'feriado')
    expect(await mac.engine.sync()).toMatchObject({ ok: true, pushed: 2 })
    expect(await mac.repo.sync.pendingCount()).toBe(0)

    expect(await android.engine.sync()).toMatchObject({ ok: true, pulled: 2 })
    expect(await day(android.repo)).toEqual([created])
    expect(await android.repo.listDaysOff('2026-11-10', '2026-11-10')).toEqual([{ date: '2026-11-10', note: 'feriado' }])
    expect(android.onRemoteChange).toHaveBeenCalledTimes(1)
  })

  it('o que veio da nuvem não volta em eco', async () => {
    const remote = createMemoryRemote()
    const mac = device(remote)
    const android = device(remote)
    await mac.engine.link(UID, 'upload')
    await android.engine.link(UID, 'upload')
    await mac.repo.createInterval({ start: at('2026-11-09 08:00'), end: at('2026-11-09 12:00') })
    await mac.engine.sync()
    await android.engine.sync()
    expect(await android.repo.sync.pendingCount()).toBe(0)
    expect(await android.engine.sync()).toMatchObject({ ok: true, pushed: 0, pulled: 0 })
  })

  it('sem rede, as mudanças esperam na fila e sobem depois', async () => {
    const remote = createMemoryRemote()
    const mac = device(remote)
    await mac.engine.link(UID, 'upload')
    const push = vi.spyOn(remote, 'push').mockRejectedValueOnce(new Error('Sem internet'))
    await mac.repo.startInterval(new Date(at('2026-11-09 08:00')))

    expect(await mac.engine.sync()).toEqual({ ok: false, error: 'Sem internet' })
    expect(await mac.repo.sync.pendingCount()).toBe(1)
    expect((await mac.repo.sync.getState()).lastError).toBe('Sem internet')

    push.mockRestore()
    expect(await mac.engine.sync()).toMatchObject({ ok: true, pushed: 1 })
    expect((await mac.repo.sync.getState()).lastError).toBeNull()
  })

  it('configurações também sincronizam', async () => {
    const remote = createMemoryRemote()
    const mac = device(remote)
    const android = device(remote)
    await mac.engine.link(UID, 'upload')
    await android.engine.link(UID, 'upload')
    await mac.repo.saveSettings({ periodStartDay: 1 })
    await mac.engine.sync()
    await android.engine.sync()
    expect(await android.repo.getSettings()).toEqual({ ...DEFAULT_SETTINGS, periodStartDay: 1 })
  })
})

describe('conflitos', () => {
  async function pair() {
    const remote = createMemoryRemote()
    const mac = device(remote)
    const android = device(remote)
    await mac.engine.link(UID, 'upload')
    const interval = await mac.repo.createInterval({ start: at('2026-11-09 08:00'), end: at('2026-11-09 12:00') })
    await mac.engine.sync()
    await android.engine.link(UID, 'upload')
    return { remote, mac, android, interval }
  }

  it('CA4: a observação gravada por último vence nos dois aparelhos', async () => {
    const { mac, android, interval } = await pair()
    clockAt('2026-11-09T13:00:00.000Z')
    await mac.repo.updateInterval(interval.id, { note: 'do Mac' })
    clockAt('2026-11-09T13:05:00.000Z')
    await android.repo.updateInterval(interval.id, { note: 'do Android' })

    // O Android sobe primeiro; o Mac, mais antigo, perde ao subir e recebe a do Android.
    await android.engine.sync()
    await mac.engine.sync()
    await android.engine.sync()
    expect((await day(mac.repo))[0].note).toBe('do Android')
    expect((await day(android.repo))[0].note).toBe('do Android')
  })

  it('CA4: a ordem de sincronização não muda o resultado', async () => {
    const { mac, android, interval } = await pair()
    clockAt('2026-11-09T13:00:00.000Z')
    await mac.repo.updateInterval(interval.id, { note: 'do Mac' })
    clockAt('2026-11-09T13:05:00.000Z')
    await android.repo.updateInterval(interval.id, { note: 'do Android' })

    await mac.engine.sync()
    await android.engine.sync()
    await mac.engine.sync()
    expect((await day(mac.repo))[0].note).toBe('do Android')
    expect((await day(android.repo))[0].note).toBe('do Android')
  })

  it('CA5: apagar depois de editar apaga nos dois', async () => {
    const { mac, android, interval } = await pair()
    clockAt('2026-11-09T13:00:00.000Z')
    await mac.repo.updateInterval(interval.id, { note: 'editado' })
    clockAt('2026-11-09T13:05:00.000Z')
    await android.repo.deleteInterval(interval.id)

    await mac.engine.sync()
    await android.engine.sync()
    await mac.engine.sync()
    expect(await day(mac.repo)).toEqual([])
    expect(await day(android.repo)).toEqual([])
  })

  it('CA5: editar depois de apagar mantém a edição nos dois', async () => {
    const { mac, android, interval } = await pair()
    clockAt('2026-11-09T13:00:00.000Z')
    await android.repo.deleteInterval(interval.id)
    clockAt('2026-11-09T13:05:00.000Z')
    await mac.repo.updateInterval(interval.id, { note: 'editado' })

    await android.engine.sync()
    await mac.engine.sync()
    await android.engine.sync()
    expect((await day(mac.repo)).map((i) => i.note)).toEqual(['editado'])
    expect((await day(android.repo)).map((i) => i.note)).toEqual(['editado'])
  })

  it('CA6: entrada nos dois aparelhos offline deixa dois abertos, e Sair fecha o mais recente', async () => {
    const remote = createMemoryRemote()
    const mac = device(remote)
    const android = device(remote)
    await mac.engine.link(UID, 'upload')
    await android.engine.link(UID, 'upload')
    await mac.repo.startInterval(new Date(at('2026-11-09 08:00')))
    await android.repo.startInterval(new Date(at('2026-11-09 08:05')))

    await mac.engine.sync()
    await android.engine.sync()
    await mac.engine.sync()
    expect((await day(mac.repo)).filter((i) => i.end === null)).toHaveLength(2)

    const closed = await mac.repo.stopInterval(new Date(at('2026-11-09 12:00')))
    expect(closed.start).toBe(at('2026-11-09 08:05'))
    expect((await mac.repo.getOpenInterval())?.start).toBe(at('2026-11-09 08:00'))
  })

  it('dia sem meta tirado num aparelho some no outro', async () => {
    const remote = createMemoryRemote()
    const mac = device(remote)
    const android = device(remote)
    await mac.engine.link(UID, 'upload')
    await mac.repo.setDayOff('2026-11-10')
    await mac.engine.sync()
    await android.engine.link(UID, 'upload')
    clockAt('2026-11-09T13:00:00.000Z')
    await android.repo.removeDayOff('2026-11-10')
    await android.engine.sync()
    await mac.engine.sync()
    expect(await mac.repo.listDaysOff('2026-11-10', '2026-11-10')).toEqual([])
  })
})

describe('primeiro login', () => {
  it('CA7: sobe os dados do aparelho e desce num aparelho vazio', async () => {
    const remote = createMemoryRemote()
    const mac = device(remote)
    for (let h = 0; h < 20; h++) {
      const start = new Date(at('2026-11-09 00:00'))
      start.setMinutes(h * 60)
      const end = new Date(start)
      end.setMinutes(30)
      await mac.repo.createInterval({ start, end })
    }
    expect(await mac.engine.plan(UID)).toBe('upload')
    expect(await mac.engine.link(UID, 'upload')).toMatchObject({ ok: true, pushed: 20 })

    const android = device(remote)
    expect(await android.engine.plan(UID)).toBe('download')
    await android.engine.link(UID, 'cloud-only')
    expect(await day(android.repo)).toHaveLength(20)
  })

  it('CA8: com dados nos dois lados pergunta, e Juntar une pelos ids', async () => {
    const remote = createMemoryRemote()
    const mac = device(remote)
    await mac.repo.createInterval({ start: at('2026-11-09 08:00'), end: at('2026-11-09 09:00') })
    await mac.engine.link(UID, 'upload')

    const android = device(remote)
    await android.repo.createInterval({ start: at('2026-11-09 10:00'), end: at('2026-11-09 11:00') })
    expect(await android.engine.plan(UID)).toBe('ask')
    await android.engine.link(UID, 'merge')
    await mac.engine.sync()
    expect(await day(android.repo)).toHaveLength(2)
    expect(await day(mac.repo)).toHaveLength(2)
  })

  it('CA8: Usar só os da nuvem descarta o aparelho sem apagar nada na nuvem', async () => {
    const remote = createMemoryRemote()
    const mac = device(remote)
    await mac.repo.createInterval({ start: at('2026-11-09 08:00'), end: at('2026-11-09 09:00') })
    await mac.engine.link(UID, 'upload')

    const android = device(remote)
    await android.repo.createInterval({ start: at('2026-11-09 10:00'), end: at('2026-11-09 11:00') })
    await android.engine.link(UID, 'cloud-only')
    await mac.engine.sync()
    expect((await day(android.repo)).map((i) => i.start)).toEqual([at('2026-11-09 08:00')])
    expect((await day(mac.repo)).map((i) => i.start)).toEqual([at('2026-11-09 08:00')])
  })

  it('CA8: Cancelar (não ligar) não muda nada em nenhum lado', async () => {
    const remote = createMemoryRemote()
    const android = device(remote)
    await android.repo.createInterval({ start: at('2026-11-09 10:00'), end: at('2026-11-09 11:00') })
    expect(await android.engine.plan(UID)).toBe('upload')
    expect(remote.docs.size).toBe(0)
    expect(await day(android.repo)).toHaveLength(1)
  })

  it('R15: o aparelho ligado a outra conta pede confirmação', async () => {
    const remote = createMemoryRemote()
    const mac = device(remote)
    await mac.engine.link('outra', 'upload')
    expect(await mac.engine.plan(UID)).toBe('other-account')
  })

  it('R16: sair mantém os dados no aparelho', async () => {
    const remote = createMemoryRemote()
    const mac = device(remote)
    await mac.engine.link(UID, 'upload')
    await mac.repo.createInterval({ start: at('2026-11-09 08:00'), end: at('2026-11-09 09:00') })
    expect(await mac.repo.sync.pendingCount()).toBe(1)
    await mac.engine.unlink()
    expect(await day(mac.repo)).toHaveLength(1)
    expect((await mac.repo.sync.getState()).uid).toBeNull()
  })
})

describe('backup com a sincronização ligada', () => {
  it('CA11: restaurar deixa a nuvem e o outro aparelho iguais ao backup', async () => {
    const remote = createMemoryRemote()
    const mac = device(remote)
    const android = device(remote)
    await mac.engine.link(UID, 'upload')
    const old = await mac.repo.createInterval({ start: at('2026-11-09 08:00'), end: at('2026-11-09 09:00') })
    const keep = await mac.repo.createInterval({ start: at('2026-11-09 10:00'), end: at('2026-11-09 11:00') })
    await mac.engine.sync()
    await android.engine.link(UID, 'upload')

    // O Android edita depois de o backup ter sido feito; restaurar no Mac ainda vence.
    const backup = await mac.repo.exportAll()
    clockAt('2026-11-09T13:00:00.000Z')
    await android.repo.updateInterval(keep.id, { note: 'depois do backup' })
    await android.engine.sync()

    clockAt('2026-11-09T14:00:00.000Z')
    await mac.repo.replaceAll({ ...backup, intervals: backup.intervals.filter((i) => i.id !== old.id) })
    await mac.engine.sync()
    await android.engine.sync()

    const restored = await day(android.repo)
    expect(restored.map((i) => [i.id, i.note])).toEqual([[keep.id, '']])
  })
})

describe('validação do que vem da nuvem', () => {
  it('recusa documento inválido e segue com o resto', async () => {
    const remote = createMemoryRemote()
    const mac = device(remote)
    await mac.engine.link(UID, 'upload')
    remote.write({
      key: 'intervals/x',
      data: { id: 'x', start: at('2026-11-09 10:00'), end: at('2026-11-09 09:00') },
      updatedAt: '2026-11-09T12:00:00.000Z',
      deletedAt: null,
    })
    remote.write({
      key: 'daysOff/2026-11-10',
      data: { date: '2026-11-10', note: '' },
      updatedAt: '2026-11-09T12:00:00.000Z',
      deletedAt: null,
    })
    expect(await mac.engine.sync()).toMatchObject({ ok: true, pulled: 1, rejected: 1 })
    expect(await day(mac.repo)).toEqual([])
    expect((await mac.repo.sync.getState()).lastError).toMatch(/recusado/)
  })
})
