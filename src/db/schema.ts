import Dexie, { type DexieOptions, type EntityTable } from 'dexie'
import { DB_NAME } from '../lib/env'
import type { DayOff, Interval, Settings } from '../lib/types'

export const SETTINGS_ID = 'settings'

export type SettingsRow = Settings & { id: typeof SETTINGS_ID }

/**
 * Banco local (IndexedDB). Só `src/db/` importa o Dexie: o resto do app usa o repositório,
 * para a fase 2 poder trocar o armazenamento sem mexer nas telas.
 */
export class PontoDb extends Dexie {
  intervals!: EntityTable<Interval, 'id'>
  daysOff!: EntityTable<DayOff, 'date'>
  settings!: EntityTable<SettingsRow, 'id'>

  constructor(name: string = DB_NAME, options?: DexieOptions) {
    super(name, options)
    // O IndexedDB não indexa `null`, então `end` não entra nos índices: o intervalo aberto é achado por filtro.
    this.version(1).stores({
      intervals: 'id, start',
      daysOff: 'date',
      settings: 'id',
    })
  }
}
