import { IDBFactory, IDBKeyRange } from 'fake-indexeddb'
import { beforeEach, describe, expect, it } from 'vitest'
import { at } from '../lib/test-helpers'
import { DEFAULT_SETTINGS } from '../lib/types'
import { createRepository, RepositoryError, type Repository } from './repository'
import { PontoDb } from './schema'

let repo: Repository

beforeEach(() => {
  // Um IndexedDB novo por teste, sem depender de variável global.
  repo = createRepository(new PontoDb('teste', { indexedDB: new IDBFactory(), IDBKeyRange }))
})

async function expectCode(promise: Promise<unknown>, code: string) {
  await expect(promise).rejects.toMatchObject({ name: 'RepositoryError', code })
}

describe('entrar e sair', () => {
  it('entrar abre um intervalo e sair o fecha, no minuto exato', async () => {
    const opened = await repo.startInterval(new Date('2026-11-09T08:00:41'))
    expect(opened.end).toBeNull()
    expect(opened.start).toBe(at('2026-11-09 08:00'))
    expect(await repo.getOpenInterval()).toEqual(opened)

    const closed = await repo.stopInterval(new Date('2026-11-09T12:30:59'))
    expect(closed.id).toBe(opened.id)
    expect(closed.end).toBe(at('2026-11-09 12:30'))
    expect(await repo.getOpenInterval()).toBeNull()
  })

  it('CA9: entrar com um intervalo aberto falha e não grava nada', async () => {
    await repo.startInterval(new Date('2026-11-09T08:00'))
    await expectCode(repo.startInterval(new Date('2026-11-09T09:00')), 'open-interval-exists')
    await expectCode(repo.createInterval({ start: '2026-11-09T10:00' }), 'open-interval-exists')
    expect(await repo.listIntervals('2026-11-09', '2026-11-09')).toHaveLength(1)
  })

  it('sair sem intervalo aberto falha', async () => {
    await expectCode(repo.stopInterval(), 'no-open-interval')
  })

  it('não deixa sair antes de ter entrado', async () => {
    await repo.startInterval(new Date('2026-11-09T08:00'))
    await expectCode(repo.stopInterval(new Date('2026-11-09T07:00')), 'invalid-interval')
  })
})

describe('intervalos manuais', () => {
  it('cria um intervalo fechado com observação', async () => {
    const created = await repo.createInterval({
      start: new Date('2026-11-09T13:00'),
      end: new Date('2026-11-09T14:15'),
      note: 'Daily',
    })
    expect(created).toMatchObject({ start: at('2026-11-09 13:00'), end: at('2026-11-09 14:15'), note: 'Daily' })
  })

  it('intervalos fechados podem se sobrepor: quem avisa é o destaque de dia irregular', async () => {
    await repo.createInterval({ start: '2026-11-09T08:00', end: '2026-11-09T12:00' })
    await repo.createInterval({ start: '2026-11-09T11:00', end: '2026-11-09T13:00' })
    expect(await repo.listIntervals('2026-11-09', '2026-11-09')).toHaveLength(2)
  })

  it('recusa fim antes do início e datas inválidas', async () => {
    await expectCode(repo.createInterval({ start: '2026-11-09T12:00', end: '2026-11-09T08:00' }), 'invalid-interval')
    await expectCode(repo.createInterval({ start: 'ontem' }), 'invalid-interval')
  })

  it('edita horário e observação', async () => {
    const { id } = await repo.createInterval({ start: '2026-11-09T08:00', end: '2026-11-09T12:00' })
    const updated = await repo.updateInterval(id, { end: '2026-11-09T12:15', note: 'Reunião longa' })
    expect(updated).toMatchObject({ end: at('2026-11-09 12:15'), note: 'Reunião longa', start: at('2026-11-09 08:00') })
  })

  it('reabrir um intervalo só vale se não houver outro aberto', async () => {
    const { id } = await repo.createInterval({ start: '2026-11-09T08:00', end: '2026-11-09T12:00' })
    await repo.startInterval(new Date('2026-11-09T13:00'))
    await expectCode(repo.updateInterval(id, { end: null }), 'open-interval-exists')
  })

  it('editar o próprio intervalo aberto não conta como segundo aberto', async () => {
    const open = await repo.startInterval(new Date('2026-11-09T08:00'))
    const updated = await repo.updateInterval(open.id, { start: '2026-11-09T08:15' })
    expect(updated.start).toBe(at('2026-11-09 08:15'))
    expect(updated.end).toBeNull()
  })

  it('editar um intervalo que não existe falha', async () => {
    await expectCode(repo.updateInterval('nada', { note: 'x' }), 'not-found')
  })

  it('apaga, e apagar de novo não faz nada', async () => {
    const { id } = await repo.createInterval({ start: '2026-11-09T08:00', end: '2026-11-09T12:00' })
    await repo.deleteInterval(id)
    await repo.deleteInterval(id)
    expect(await repo.listIntervals('2026-11-09', '2026-11-09')).toEqual([])
  })
})

describe('listagem', () => {
  it('traz os intervalos da faixa de dias, do mais antigo para o mais novo', async () => {
    await repo.createInterval({ start: '2026-11-10T08:00', end: '2026-11-10T09:00' })
    await repo.createInterval({ start: '2026-11-08T23:30', end: '2026-11-09T00:30' })
    await repo.createInterval({ start: '2026-11-09T08:00', end: '2026-11-09T09:00' })
    await repo.createInterval({ start: '2026-11-11T00:00', end: '2026-11-11T01:00' })

    const list = await repo.listIntervals('2026-11-09', '2026-11-10')
    expect(list.map((i) => i.start)).toEqual([at('2026-11-09 08:00'), at('2026-11-10 08:00')])
  })

  it('inclui a primeira e a última hora do dia', async () => {
    await repo.createInterval({ start: '2026-11-09T00:00', end: '2026-11-09T00:30' })
    await repo.createInterval({ start: '2026-11-09T23:59', end: '2026-11-10T00:10' })
    expect(await repo.listIntervals('2026-11-09', '2026-11-09')).toHaveLength(2)
  })

  it('recusa dias inválidos', async () => {
    await expectCode(repo.listIntervals('09/11/2026', '2026-11-10'), 'invalid-day')
  })
})

describe('dias sem meta', () => {
  it('marca, lista por faixa e desmarca', async () => {
    await repo.setDayOff('2026-11-02', 'Finados')
    await repo.setDayOff('2026-11-15')
    await repo.setDayOff('2026-12-25')
    expect(await repo.listDaysOff('2026-11-01', '2026-11-30')).toEqual([
      { date: '2026-11-02', note: 'Finados' },
      { date: '2026-11-15', note: '' },
    ])
    await repo.removeDayOff('2026-11-02')
    expect(await repo.listDaysOff('2026-11-01', '2026-11-30')).toEqual([{ date: '2026-11-15', note: '' }])
  })

  it('marcar duas vezes só atualiza a observação', async () => {
    await repo.setDayOff('2026-11-02', 'a')
    await repo.setDayOff('2026-11-02', 'b')
    expect(await repo.listDaysOff('2026-11-02', '2026-11-02')).toEqual([{ date: '2026-11-02', note: 'b' }])
  })

  it('recusa dia inválido', async () => {
    await expectCode(repo.setDayOff('2026-13-40'), 'invalid-day')
  })
})

describe('configurações', () => {
  it('devolve os padrões quando nada foi salvo', async () => {
    expect(await repo.getSettings()).toEqual(DEFAULT_SETTINGS)
  })

  it('salva só o que mudou e mantém o resto', async () => {
    await repo.saveSettings({ periodStartDay: 1 })
    expect(await repo.getSettings()).toEqual({ ...DEFAULT_SETTINGS, periodStartDay: 1 })
  })

  it('recusa valores inválidos sem gravar', async () => {
    await expectCode(repo.saveSettings({ periodStartDay: 31 }), 'invalid-settings')
    await expectCode(repo.saveSettings({ workDays: [0, 8] }), 'invalid-settings')
    await expectCode(repo.saveSettings({ dailyTargetMinutes: -5 }), 'invalid-settings')
    expect(await repo.getSettings()).toEqual(DEFAULT_SETTINGS)
  })

  it('o erro é um RepositoryError', async () => {
    await expect(repo.saveSettings({ periodStartDay: 0 })).rejects.toBeInstanceOf(RepositoryError)
  })
})
