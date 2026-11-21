import Dexie, { type DexieOptions, type EntityTable } from 'dexie'
import { withDevOpsDefaults } from '../lib/devops'
import { DB_NAME } from '../lib/env'
import type { DayOff, Interval, Settings } from '../lib/types'

export const SETTINGS_ID = 'settings'

export const SYNC_STATE_ID = 'sync'

/** Configurações como ficam no banco: uma linha só, com a data da última mudança (spec 008). */
export type SettingsRow = Settings & { id: typeof SETTINGS_ID; updatedAt?: string }

/** Dia sem meta como fica no banco, com a data da última mudança para a sincronização (spec 008). */
export type DayOffRow = DayOff & { updatedAt: string }

/** Registro local alterado que ainda não subiu para a nuvem. `key` é `intervals/{id}`, `daysOff/{data}` ou `settings`. */
export interface OutboxRow {
  key: string
  updatedAt: string
}

/** Marca de um registro apagado, para o outro aparelho saber que ele sumiu e para decidir conflitos. */
export interface TombstoneRow {
  key: string
  deletedAt: string
}

/** Estado da sincronização neste aparelho. */
export interface SyncStateRow {
  id: typeof SYNC_STATE_ID
  /** Conta com que este aparelho sincroniza; `null` = nunca sincronizou. */
  uid: string | null
  /** Cursor de leitura: maior `syncedAt` já recebido da nuvem. */
  lastPulledAt: string | null
  /** Fim do último ciclo que deu certo. */
  lastSyncAt: string | null
  lastError: string | null
}

/**
 * Banco local (IndexedDB). Só `src/db/` importa o Dexie: o resto do app usa o repositório,
 * para a fase 2 poder trocar o armazenamento sem mexer nas telas.
 */
export class PontoDb extends Dexie {
  intervals!: EntityTable<Interval, 'id'>
  daysOff!: EntityTable<DayOffRow, 'date'>
  settings!: EntityTable<SettingsRow, 'id'>
  outbox!: EntityTable<OutboxRow, 'key'>
  tombstones!: EntityTable<TombstoneRow, 'key'>
  syncState!: EntityTable<SyncStateRow, 'id'>

  constructor(name: string = DB_NAME, options?: DexieOptions) {
    super(name, options)
    // O IndexedDB não indexa `null`, então `end` não entra nos índices: o intervalo aberto é achado por filtro.
    this.version(1).stores({
      intervals: 'id, start',
      daysOff: 'date',
      settings: 'id',
    })
    // Versão 2: campos do Azure DevOps no intervalo (spec 005). Os índices não mudam; os
    // intervalos que já existem ficam sem work item, sem task e não declarados.
    this.version(2)
      .stores({
        intervals: 'id, start',
        daysOff: 'date',
        settings: 'id',
      })
      .upgrade((tx) =>
        tx
          .table<Interval, string>('intervals')
          .toCollection()
          .modify((row, ref) => {
            ref.value = withDevOpsDefaults(row)
          }),
      )
    // Versão 3: projeto no intervalo (spec 007). Os intervalos que já existem ficam sem projeto.
    this.version(3)
      .stores({
        intervals: 'id, start',
        daysOff: 'date',
        settings: 'id',
      })
      .upgrade((tx) =>
        tx
          .table<Interval, string>('intervals')
          .toCollection()
          .modify((row, ref) => {
            ref.value = withDevOpsDefaults(row)
          }),
      )
    // Versão 4: sincronização (spec 008). Fila de mudanças, marcas de apagado e estado da
    // sincronização. Dias sem meta e configurações ganham `updatedAt`, preenchido com agora.
    this.version(4)
      .stores({
        intervals: 'id, start',
        daysOff: 'date',
        settings: 'id',
        outbox: 'key',
        tombstones: 'key',
        syncState: 'id',
      })
      .upgrade(async (tx) => {
        const now = new Date().toISOString()
        await tx
          .table<DayOffRow, string>('daysOff')
          .toCollection()
          .modify((row) => {
            row.updatedAt ??= now
          })
        await tx
          .table<SettingsRow, string>('settings')
          .toCollection()
          .modify((row) => {
            row.updatedAt ??= now
          })
      })
  }
}
