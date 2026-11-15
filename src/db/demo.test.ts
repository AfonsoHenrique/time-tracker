import { IDBFactory, IDBKeyRange } from 'fake-indexeddb'
import { describe, expect, it } from 'vitest'
import { DEMO_DB_NAME } from '../lib/env'
import { at } from '../lib/test-helpers'
import { dayKey } from '../lib/time'
import { fillDemoDb } from './demo'
import { createRepository } from './repository'
import { PontoDb } from './schema'

describe('fillDemoDb', () => {
  it('grava só no banco demo e não muda o banco real da homologação (CA2)', async () => {
    const options = { indexedDB: new IDBFactory(), IDBKeyRange }
    const real = createRepository(new PontoDb('ponto-hml', options))
    await real.createInterval({ start: at('2026-11-10 08:00'), end: at('2026-11-10 12:00'), note: 'real 1' })
    await real.createInterval({ start: at('2026-11-10 13:00'), end: at('2026-11-10 17:00'), note: 'real 2' })
    const before = await real.exportAll()

    await fillDemoDb(new Date(at('2026-11-18 15:00')), options)
    await fillDemoDb(new Date(at('2026-11-19 10:00')), options)

    expect(await real.exportAll()).toEqual(before)
    const demo = createRepository(new PontoDb(DEMO_DB_NAME, options))
    const data = await demo.exportAll()
    expect(data.intervals.length).toBeGreaterThan(10)
    expect(data.intervals.every((i) => i.id.startsWith('demo-'))).toBe(true)
    // Recriar troca tudo: os dados seguem o último "agora".
    expect(data.intervals.some((i) => dayKey(i.start) === '2026-11-19')).toBe(true)
  })
})
