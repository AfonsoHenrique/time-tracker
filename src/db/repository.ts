import { parseISO, startOfMinute } from 'date-fns'
import { parseDayOffRecord, parseIntervalRecord, parseSettingsRecord, type BackupData } from '../lib/backup'
import { isDevOpsId, normalizeProject } from '../lib/devops'
import { settingsProblem } from '../lib/settings'
import { isNewer, parseRecordKey, recordKey, SETTINGS_DOC_ID, type SyncDoc } from '../lib/sync'
import { dayEndInstant, dayStartInstant, isDayKey } from '../lib/time'
import { DEFAULT_SETTINGS, PROJECT_MAX_LENGTH, type DayOff, type Interval, type Settings } from '../lib/types'
import { PontoDb, SETTINGS_ID, SYNC_STATE_ID, type DayOffRow, type SyncStateRow } from './schema'

export type RepositoryErrorCode =
  | 'open-interval-exists'
  | 'no-open-interval'
  | 'not-found'
  | 'invalid-interval'
  | 'invalid-day'
  | 'invalid-settings'

export class RepositoryError extends Error {
  code: RepositoryErrorCode

  constructor(code: RepositoryErrorCode, message: string) {
    super(message)
    this.name = 'RepositoryError'
    this.code = code
  }
}

export interface NewInterval {
  start: Date | string
  /** Vazio ou `null` cria um intervalo em andamento. */
  end?: Date | string | null
  note?: string
  /** Work item do Azure DevOps; vazio = sem work item. */
  workItemId?: number | null
  /** Task filha do work item, onde as horas são declaradas; vazio = sem task. */
  taskId?: number | null
  /** Se as horas já foram lançadas no Azure DevOps. Padrão: `false`. */
  declared?: boolean
  /** Projeto, até 15 caracteres; vazio = sem projeto. */
  project?: string
}

export interface IntervalPatch {
  start?: Date | string
  end?: Date | string | null
  note?: string
  workItemId?: number | null
  taskId?: number | null
  declared?: boolean
  project?: string
}

/** Guarda sempre em UTC e no minuto exato: o app não guarda segundos nem arredonda para múltiplos de 15. */
function toInstant(value: Date | string): string {
  const date = typeof value === 'string' ? parseISO(value) : value
  if (Number.isNaN(date.getTime())) {
    throw new RepositoryError('invalid-interval', `Data e hora inválidas: ${String(value)}`)
  }
  return startOfMinute(date).toISOString()
}

function assertOrder(start: string, end: string | null) {
  // Instantes em UTC com o mesmo formato, então a comparação de texto respeita a ordem do tempo.
  if (end !== null && end < start) {
    throw new RepositoryError('invalid-interval', 'O fim não pode ser antes do início.')
  }
}

function devOpsId(value: number | null | undefined, label: string): number | null {
  if (value == null) return null
  if (!isDevOpsId(value)) {
    throw new RepositoryError('invalid-interval', `${label} deve ser um número inteiro positivo.`)
  }
  return value
}

function project(value: string | undefined): string {
  const result = normalizeProject(value ?? '')
  if (!result.ok) {
    throw new RepositoryError('invalid-interval', `O projeto deve ter no máximo ${PROJECT_MAX_LENGTH} caracteres.`)
  }
  return result.value
}

function assertDayKey(date: string) {
  if (!isDayKey(date)) throw new RepositoryError('invalid-day', `Dia inválido: ${date}`)
}

function validateSettings(settings: Settings) {
  const problem = settingsProblem(settings)
  if (problem) throw new RepositoryError('invalid-settings', problem)
}

const SETTINGS_KEY = recordKey('settings', SETTINGS_DOC_ID)

const intervalKey = (id: string) => recordKey('intervals', id)
const dayOffKey = (date: string) => recordKey('daysOff', date)

/** Tira do dia sem meta o que é só do banco (`updatedAt`), para as telas e o backup. */
const toDayOff = ({ date, note }: DayOffRow): DayOff => ({ date, note })

const EMPTY_SYNC_STATE: SyncStateRow = {
  id: SYNC_STATE_ID,
  uid: null,
  lastPulledAt: null,
  lastSyncAt: null,
  lastError: null,
}

export interface ApplyResult {
  /** Registros do aparelho que mudaram por causa da nuvem. */
  applied: number
  /** Documentos recusados pela validação, com o motivo. */
  rejected: { key: string; error: string }[]
}

export function createRepository(db: PontoDb) {
  const listeners = new Set<() => void>()
  const changed = () => listeners.forEach((listener) => listener())

  /** Tabelas que toda gravação toca: a do registro e as da sincronização. */
  const syncTables = [db.outbox, db.tombstones] as const

  /** Marca o registro como alterado, para subir na próxima sincronização. Chamar dentro da transação. */
  async function track(key: string, updatedAt: string) {
    await db.outbox.put({ key, updatedAt })
    await db.tombstones.delete(key)
  }

  /** Marca o registro como apagado. Chamar dentro da transação. */
  async function trackDelete(key: string, deletedAt: string) {
    await db.outbox.put({ key, updatedAt: deletedAt })
    await db.tombstones.put({ key, deletedAt })
  }

  /** O intervalo em andamento mais recente. Depois de sincronizar pode haver dois (R9). */
  async function findOpenInterval(exceptId?: string): Promise<Interval | null> {
    const open = await db.intervals.filter((i) => i.end === null && i.id !== exceptId).toArray()
    open.sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0))
    return open[open.length - 1] ?? null
  }

  async function assertNoOtherOpen(exceptId?: string) {
    if (await findOpenInterval(exceptId)) {
      throw new RepositoryError('open-interval-exists', 'Já existe um intervalo em andamento.')
    }
  }

  async function getSettingsIn(): Promise<Settings> {
    const row = await db.settings.get(SETTINGS_ID)
    return {
      dailyTargetMinutes: row?.dailyTargetMinutes ?? DEFAULT_SETTINGS.dailyTargetMinutes,
      workDays: [...(row?.workDays ?? DEFAULT_SETTINGS.workDays)],
      periodStartDay: row?.periodStartDay ?? DEFAULT_SETTINGS.periodStartDay,
    }
  }

  /** Cria um intervalo. Sem `end`, ele fica em andamento, e só pode existir um assim por vez. */
  async function createInterval(input: NewInterval): Promise<Interval> {
    const start = toInstant(input.start)
    const end = input.end == null ? null : toInstant(input.end)
    assertOrder(start, end)
    const now = new Date().toISOString()
    const interval: Interval = {
      id: crypto.randomUUID(),
      start,
      end,
      note: input.note ?? '',
      workItemId: devOpsId(input.workItemId, 'O work item'),
      taskId: devOpsId(input.taskId, 'A task'),
      declared: input.declared ?? false,
      project: project(input.project),
      createdAt: now,
      updatedAt: now,
    }
    await db.transaction('rw', db.intervals, ...syncTables, async () => {
      if (end === null) await assertNoOtherOpen()
      await db.intervals.add(interval)
      await track(intervalKey(interval.id), now)
    })
    changed()
    return interval
  }

  return {
    createInterval,

    /** O intervalo em andamento, se houver. */
    getOpenInterval: () => findOpenInterval(),

    /** "Entrar": abre um intervalo agora. Falha se já houver um em andamento. */
    startInterval(now: Date = new Date(), note = ''): Promise<Interval> {
      return createInterval({ start: now, end: null, note })
    },

    /** "Sair": fecha o intervalo em andamento. Falha se não houver. */
    async stopInterval(now: Date = new Date()): Promise<Interval> {
      const closed = await db.transaction('rw', db.intervals, ...syncTables, async () => {
        const open = await findOpenInterval()
        if (!open) throw new RepositoryError('no-open-interval', 'Não há intervalo em andamento.')
        const end = toInstant(now)
        assertOrder(open.start, end)
        const result: Interval = { ...open, end, updatedAt: new Date().toISOString() }
        await db.intervals.put(result)
        await track(intervalKey(result.id), result.updatedAt)
        return result
      })
      changed()
      return closed
    },

    async updateInterval(id: string, patch: IntervalPatch): Promise<Interval> {
      const saved = await db.transaction('rw', db.intervals, ...syncTables, async () => {
        const current = await db.intervals.get(id)
        if (!current) throw new RepositoryError('not-found', 'Intervalo não encontrado.')
        const start = patch.start === undefined ? current.start : toInstant(patch.start)
        const end = patch.end === undefined ? current.end : patch.end === null ? null : toInstant(patch.end)
        assertOrder(start, end)
        if (end === null) await assertNoOtherOpen(id)
        const updated: Interval = {
          ...current,
          start,
          end,
          note: patch.note ?? current.note,
          workItemId: patch.workItemId === undefined ? current.workItemId : devOpsId(patch.workItemId, 'O work item'),
          taskId: patch.taskId === undefined ? current.taskId : devOpsId(patch.taskId, 'A task'),
          declared: patch.declared ?? current.declared,
          project: patch.project === undefined ? current.project : project(patch.project),
          updatedAt: new Date().toISOString(),
        }
        await db.intervals.put(updated)
        await track(intervalKey(id), updated.updatedAt)
        return updated
      })
      changed()
      return saved
    },

    /** Apaga o intervalo. Se ele não existir, não faz nada. */
    async deleteInterval(id: string): Promise<void> {
      const removed = await db.transaction('rw', db.intervals, ...syncTables, async () => {
        if (!(await db.intervals.get(id))) return false
        await db.intervals.delete(id)
        await trackDelete(intervalKey(id), new Date().toISOString())
        return true
      })
      if (removed) changed()
    },

    /** Intervalos que começam entre os dois dias (locais, incluídos), do mais antigo para o mais novo. */
    async listIntervals(fromDay: string, toDay: string): Promise<Interval[]> {
      assertDayKey(fromDay)
      assertDayKey(toDay)
      return db.intervals
        .where('start')
        .between(dayStartInstant(fromDay), dayEndInstant(toDay), true, false)
        .sortBy('start')
    },

    async setDayOff(date: string, note = ''): Promise<DayOff> {
      assertDayKey(date)
      const dayOff = { date, note }
      const updatedAt = new Date().toISOString()
      await db.transaction('rw', db.daysOff, ...syncTables, async () => {
        await db.daysOff.put({ ...dayOff, updatedAt })
        await track(dayOffKey(date), updatedAt)
      })
      changed()
      return dayOff
    },

    async removeDayOff(date: string): Promise<void> {
      const removed = await db.transaction('rw', db.daysOff, ...syncTables, async () => {
        if (!(await db.daysOff.get(date))) return false
        await db.daysOff.delete(date)
        await trackDelete(dayOffKey(date), new Date().toISOString())
        return true
      })
      if (removed) changed()
    },

    async listDaysOff(fromDay: string, toDay: string): Promise<DayOff[]> {
      assertDayKey(fromDay)
      assertDayKey(toDay)
      const rows = await db.daysOff.where('date').between(fromDay, toDay, true, true).toArray()
      return rows.map(toDayOff)
    },

    /** Configurações salvas, com os valores padrão no que não foi alterado. */
    getSettings: () => getSettingsIn(),

    async saveSettings(patch: Partial<Settings>): Promise<Settings> {
      const saved = await db.transaction('rw', db.settings, ...syncTables, async () => {
        const row = await db.settings.get(SETTINGS_ID)
        const next: Settings = {
          dailyTargetMinutes: patch.dailyTargetMinutes ?? row?.dailyTargetMinutes ?? DEFAULT_SETTINGS.dailyTargetMinutes,
          workDays: patch.workDays ?? row?.workDays ?? [...DEFAULT_SETTINGS.workDays],
          periodStartDay: patch.periodStartDay ?? row?.periodStartDay ?? DEFAULT_SETTINGS.periodStartDay,
        }
        validateSettings(next)
        const updatedAt = new Date().toISOString()
        await db.settings.put({ id: SETTINGS_ID, ...next, updatedAt })
        await track(SETTINGS_KEY, updatedAt)
        return next
      })
      changed()
      return saved
    },

    /** Quantos intervalos existem, em qualquer data. */
    countIntervals: () => db.intervals.count(),

    /** Tudo o que está guardado, para o backup. */
    async exportAll(): Promise<BackupData> {
      return db.transaction('r', db.intervals, db.daysOff, db.settings, async () => {
        const [intervals, daysOff, settings] = await Promise.all([
          db.intervals.orderBy('start').toArray(),
          db.daysOff.orderBy('date').toArray(),
          getSettingsIn(),
        ])
        return { intervals, daysOff: daysOff.map(toDayOff), settings }
      })
    },

    /**
     * Substitui todos os dados pelos do backup, numa única transação: se algo falhar no meio,
     * os dados anteriores continuam lá. Quem chama já validou com `parseBackup`.
     *
     * Tudo o que foi gravado entra na fila da sincronização, e o que sumiu ganha marca de apagado.
     * Com a sincronização ligada, os registros ganham `updatedAt` de agora, para o backup
     * vencer também na nuvem e no outro aparelho (spec 008, R20).
     */
    async replaceAll(data: BackupData): Promise<void> {
      validateSettings(data.settings)
      await db.transaction('rw', [db.intervals, db.daysOff, db.settings, db.outbox, db.tombstones, db.syncState], async () => {
        const now = new Date().toISOString()
        const linked = ((await db.syncState.get(SYNC_STATE_ID))?.uid ?? null) !== null
        const [oldIntervalIds, oldDays] = await Promise.all([
          db.intervals.toCollection().primaryKeys(),
          db.daysOff.toCollection().primaryKeys(),
        ])
        await Promise.all([db.intervals.clear(), db.daysOff.clear(), db.settings.clear()])

        const intervals = data.intervals.map((interval) => (linked ? { ...interval, updatedAt: now } : interval))
        const daysOff: DayOffRow[] = data.daysOff.map(({ date, note }) => ({ date, note, updatedAt: now }))
        await db.intervals.bulkAdd(intervals)
        await db.daysOff.bulkAdd(daysOff)
        await db.settings.put({ id: SETTINGS_ID, ...data.settings, workDays: [...data.settings.workDays], updatedAt: now })

        const kept = new Set([...intervals.map((i) => intervalKey(i.id)), ...daysOff.map((d) => dayOffKey(d.date))])
        const gone = [...oldIntervalIds.map(intervalKey), ...oldDays.map(dayOffKey)].filter((key) => !kept.has(key))
        for (const key of gone) await trackDelete(key, now)
        for (const interval of intervals) await track(intervalKey(interval.id), interval.updatedAt)
        for (const day of daysOff) await track(dayOffKey(day.date), now)
        await track(SETTINGS_KEY, now)
      })
      changed()
    },

    /** Avisa quando o próprio aparelho grava algo (não quando a nuvem grava). Devolve como parar de ouvir. */
    onLocalChange(listener: () => void): () => void {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },

    /** Operações da sincronização (spec 008). Só `src/sync/` usa. */
    sync: {
      async getState(): Promise<SyncStateRow> {
        return (await db.syncState.get(SYNC_STATE_ID)) ?? { ...EMPTY_SYNC_STATE }
      },

      async setState(patch: Partial<Omit<SyncStateRow, 'id'>>): Promise<SyncStateRow> {
        return db.transaction('rw', db.syncState, async () => {
          const next: SyncStateRow = { ...((await db.syncState.get(SYNC_STATE_ID)) ?? EMPTY_SYNC_STATE), ...patch, id: SYNC_STATE_ID }
          await db.syncState.put(next)
          return next
        })
      },

      /** Quantas mudanças ainda não subiram. */
      pendingCount: () => db.outbox.count(),

      /** Intervalos e dias sem meta guardados, para decidir o primeiro login. */
      async recordCount(): Promise<number> {
        const [intervals, daysOff] = await Promise.all([db.intervals.count(), db.daysOff.count()])
        return intervals + daysOff
      },

      /** As mudanças que esperam para subir, já no formato da nuvem. */
      async pending(): Promise<SyncDoc[]> {
        return db.transaction('rw', db.intervals, db.daysOff, db.settings, ...syncTables, async () => {
          const docs: SyncDoc[] = []
          for (const entry of await db.outbox.toArray()) {
            const doc = await localDoc(entry.key)
            if (doc) docs.push(doc)
            else await db.outbox.delete(entry.key)
          }
          return docs
        })
      },

      /** Tira da fila o que subiu, a não ser que tenha mudado de novo enquanto subia. */
      async markPushed(docs: readonly Pick<SyncDoc, 'key' | 'updatedAt' | 'deletedAt'>[]): Promise<void> {
        await db.transaction('rw', db.outbox, async () => {
          for (const doc of docs) {
            const entry = await db.outbox.get(doc.key)
            if (entry && entry.updatedAt === (doc.deletedAt ?? doc.updatedAt)) await db.outbox.delete(doc.key)
          }
        })
      },

      /**
       * Grava no aparelho o que veio da nuvem, quando é mais novo que o daqui. Não entra na fila
       * (não volta em eco) e não avisa `onLocalChange`. Documentos inválidos são recusados.
       */
      async applyRemote(docs: readonly SyncDoc[]): Promise<ApplyResult> {
        const result: ApplyResult = { applied: 0, rejected: [] }
        await db.transaction('rw', db.intervals, db.daysOff, db.settings, ...syncTables, async () => {
          for (const doc of docs) {
            const target = parseRecordKey(doc.key)
            if (!target) {
              result.rejected.push({ key: doc.key, error: 'Chave desconhecida.' })
              continue
            }
            const local = await localVersion(doc.key)
            const incoming = doc.deletedAt ?? doc.updatedAt
            if (!isNewer(incoming, local)) continue

            if (doc.deletedAt !== null) {
              if (target.collection === 'intervals') await db.intervals.delete(target.id)
              else if (target.collection === 'daysOff') await db.daysOff.delete(target.id)
              else await db.settings.delete(SETTINGS_ID)
              await db.tombstones.put({ key: doc.key, deletedAt: doc.deletedAt })
            } else {
              const error = await writeRemote(target.collection, target.id, doc)
              if (error) {
                result.rejected.push({ key: doc.key, error })
                continue
              }
              await db.tombstones.delete(doc.key)
            }
            await db.outbox.delete(doc.key)
            result.applied++
          }
        })
        return result
      },

      /** Coloca tudo o que existe no aparelho na fila: subir os dados locais ou juntar com a nuvem. */
      async enqueueAll(): Promise<void> {
        await db.transaction('rw', db.intervals, db.daysOff, db.settings, ...syncTables, async () => {
          for (const interval of await db.intervals.toArray()) {
            await db.outbox.put({ key: intervalKey(interval.id), updatedAt: interval.updatedAt })
          }
          for (const day of await db.daysOff.toArray()) {
            await db.outbox.put({ key: dayOffKey(day.date), updatedAt: day.updatedAt })
          }
          const settings = await db.settings.get(SETTINGS_ID)
          if (settings?.updatedAt) await db.outbox.put({ key: SETTINGS_KEY, updatedAt: settings.updatedAt })
          for (const tombstone of await db.tombstones.toArray()) {
            await db.outbox.put({ key: tombstone.key, updatedAt: tombstone.deletedAt })
          }
        })
      },

      /** Apaga tudo do aparelho, sem marcas nem fila, para receber só os dados da nuvem. */
      async clearForDownload(): Promise<void> {
        await db.transaction('rw', [db.intervals, db.daysOff, db.settings, db.outbox, db.tombstones], async () => {
          await Promise.all([
            db.intervals.clear(),
            db.daysOff.clear(),
            db.settings.clear(),
            db.outbox.clear(),
            db.tombstones.clear(),
          ])
        })
        changed()
      },
    },
  }

  /** Versão local de um registro: a última mudança, a data em que foi apagado, ou `null`. */
  async function localVersion(key: string): Promise<string | null> {
    const target = parseRecordKey(key)
    if (!target) return null
    const tombstone = await db.tombstones.get(key)
    const live =
      target.collection === 'intervals'
        ? (await db.intervals.get(target.id))?.updatedAt
        : target.collection === 'daysOff'
          ? (await db.daysOff.get(target.id))?.updatedAt
          : (await db.settings.get(SETTINGS_ID))?.updatedAt
    return live ?? tombstone?.deletedAt ?? null
  }

  /** O registro local no formato da nuvem, ou `null` se não existe nem foi apagado. */
  async function localDoc(key: string): Promise<SyncDoc | null> {
    const target = parseRecordKey(key)
    if (!target) return null
    if (target.collection === 'intervals') {
      const interval = await db.intervals.get(target.id)
      if (interval) return { key, data: interval, updatedAt: interval.updatedAt, deletedAt: null }
    } else if (target.collection === 'daysOff') {
      const day = await db.daysOff.get(target.id)
      if (day) return { key, data: toDayOff(day), updatedAt: day.updatedAt, deletedAt: null }
    } else {
      const row = await db.settings.get(SETTINGS_ID)
      if (row?.updatedAt) {
        const { id: _id, updatedAt, ...settings } = row
        return { key, data: settings, updatedAt, deletedAt: null }
      }
    }
    const tombstone = await db.tombstones.get(key)
    return tombstone ? { key, data: null, updatedAt: tombstone.deletedAt, deletedAt: tombstone.deletedAt } : null
  }

  /** Grava um registro que veio da nuvem, validado como no backup. Devolve o erro, se houver. */
  async function writeRemote(collection: 'intervals' | 'daysOff' | 'settings', id: string, doc: SyncDoc) {
    if (collection === 'intervals') {
      const parsed = parseIntervalRecord(doc.data)
      if (!parsed.ok) return parsed.error
      if (parsed.value.id !== id) return 'Id diferente da chave.'
      await db.intervals.put({ ...parsed.value, updatedAt: doc.updatedAt })
    } else if (collection === 'daysOff') {
      const parsed = parseDayOffRecord(doc.data)
      if (!parsed.ok) return parsed.error
      if (parsed.value.date !== id) return 'Dia diferente da chave.'
      await db.daysOff.put({ ...parsed.value, updatedAt: doc.updatedAt })
    } else {
      const parsed = parseSettingsRecord(doc.data)
      if (!parsed.ok) return parsed.error
      await db.settings.put({ id: SETTINGS_ID, ...parsed.value, updatedAt: doc.updatedAt })
    }
    return null
  }
}

export type Repository = ReturnType<typeof createRepository>

let shared: Repository | undefined

/** Repositório do app, sobre o banco do ambiente (`DB_NAME`). Criado só no primeiro uso. */
export function getRepository(): Repository {
  shared ??= createRepository(new PontoDb())
  return shared
}
