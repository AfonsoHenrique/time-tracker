import { parseISO, startOfMinute } from 'date-fns'
import type { BackupData } from '../lib/backup'
import { isDevOpsId } from '../lib/devops'
import { dayEndInstant, dayStartInstant, isDayKey } from '../lib/time'
import { settingsProblem } from '../lib/settings'
import { DEFAULT_SETTINGS, type DayOff, type Interval, type Settings } from '../lib/types'
import { PontoDb, SETTINGS_ID } from './schema'

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
}

export interface IntervalPatch {
  start?: Date | string
  end?: Date | string | null
  note?: string
  workItemId?: number | null
  taskId?: number | null
  declared?: boolean
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

function assertDayKey(date: string) {
  if (!isDayKey(date)) throw new RepositoryError('invalid-day', `Dia inválido: ${date}`)
}

function validateSettings(settings: Settings) {
  const problem = settingsProblem(settings)
  if (problem) throw new RepositoryError('invalid-settings', problem)
}

export function createRepository(db: PontoDb) {
  async function findOpenInterval(exceptId?: string): Promise<Interval | null> {
    const open = await db.intervals.filter((i) => i.end === null && i.id !== exceptId).first()
    return open ?? null
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
      createdAt: now,
      updatedAt: now,
    }
    await db.transaction('rw', db.intervals, async () => {
      if (end === null) await assertNoOtherOpen()
      await db.intervals.add(interval)
    })
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
      return db.transaction('rw', db.intervals, async () => {
        const open = await findOpenInterval()
        if (!open) throw new RepositoryError('no-open-interval', 'Não há intervalo em andamento.')
        const end = toInstant(now)
        assertOrder(open.start, end)
        const closed: Interval = { ...open, end, updatedAt: new Date().toISOString() }
        await db.intervals.put(closed)
        return closed
      })
    },

    async updateInterval(id: string, patch: IntervalPatch): Promise<Interval> {
      return db.transaction('rw', db.intervals, async () => {
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
          updatedAt: new Date().toISOString(),
        }
        await db.intervals.put(updated)
        return updated
      })
    },

    /** Apaga o intervalo. Se ele não existir, não faz nada. */
    deleteInterval: (id: string) => db.intervals.delete(id),

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
      await db.daysOff.put(dayOff)
      return dayOff
    },

    removeDayOff: (date: string) => db.daysOff.delete(date),

    async listDaysOff(fromDay: string, toDay: string): Promise<DayOff[]> {
      assertDayKey(fromDay)
      assertDayKey(toDay)
      return db.daysOff.where('date').between(fromDay, toDay, true, true).toArray()
    },

    /** Configurações salvas, com os valores padrão no que não foi alterado. */
    getSettings: () => getSettingsIn(),

    async saveSettings(patch: Partial<Settings>): Promise<Settings> {
      return db.transaction('rw', db.settings, async () => {
        const row = await db.settings.get(SETTINGS_ID)
        const next: Settings = {
          dailyTargetMinutes: patch.dailyTargetMinutes ?? row?.dailyTargetMinutes ?? DEFAULT_SETTINGS.dailyTargetMinutes,
          workDays: patch.workDays ?? row?.workDays ?? [...DEFAULT_SETTINGS.workDays],
          periodStartDay: patch.periodStartDay ?? row?.periodStartDay ?? DEFAULT_SETTINGS.periodStartDay,
        }
        validateSettings(next)
        await db.settings.put({ id: SETTINGS_ID, ...next })
        return next
      })
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
        return { intervals, daysOff, settings }
      })
    },

    /**
     * Substitui todos os dados pelos do backup, numa única transação: se algo falhar no meio,
     * os dados anteriores continuam lá. Quem chama já validou com `parseBackup`.
     */
    async replaceAll(data: BackupData): Promise<void> {
      validateSettings(data.settings)
      await db.transaction('rw', db.intervals, db.daysOff, db.settings, async () => {
        await Promise.all([db.intervals.clear(), db.daysOff.clear(), db.settings.clear()])
        await db.intervals.bulkAdd(data.intervals)
        await db.daysOff.bulkAdd(data.daysOff)
        await db.settings.put({ id: SETTINGS_ID, ...data.settings, workDays: [...data.settings.workDays] })
      })
    },
  }
}

export type Repository = ReturnType<typeof createRepository>

let shared: Repository | undefined

/** Repositório do app, sobre o banco do ambiente (`DB_NAME`). Criado só no primeiro uso. */
export function getRepository(): Repository {
  shared ??= createRepository(new PontoDb())
  return shared
}
