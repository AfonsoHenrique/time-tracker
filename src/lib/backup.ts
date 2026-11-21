import { differenceInCalendarDays, format, parseISO, startOfMinute } from 'date-fns'
import { isDevOpsId, normalizeProject, withDevOpsDefaults } from './devops'
import type { AppEnv } from './env'
import { settingsProblem } from './settings'
import { dayKey, isDayKey } from './time'
import { DEFAULT_SETTINGS, PROJECT_MAX_LENGTH, type DayOff, type Interval, type Settings } from './types'

/** Versão do formato do arquivo de backup. É independente da versão do schema do Dexie. */
export const BACKUP_VERSION = 1

/** Tudo o que o app guarda. É o que o backup leva e o que a restauração grava. */
export interface BackupData {
  intervals: Interval[]
  daysOff: DayOff[]
  settings: Settings
}

export interface BackupFile extends BackupData {
  app: 'ponto'
  version: typeof BACKUP_VERSION
  exportedAt: string
  env: AppEnv
}

export function buildBackup(data: BackupData, now: Date, env: AppEnv): BackupFile {
  return { app: 'ponto', version: BACKUP_VERSION, exportedAt: now.toISOString(), env, ...data }
}

/** Nome do arquivo de backup. No modo demo da homologação, leva `demo` no nome. */
export function backupFileName(now: Date, demo = false): string {
  return `ponto-backup-${demo ? 'demo-' : ''}${dayKey(now)}.json`
}

export interface BackupSummary {
  env: AppEnv
  exportedAt: string
  intervals: number
  /** Primeiro e último dia com intervalo, ou `null` sem intervalos. */
  firstDay: string | null
  lastDay: string | null
  daysOff: number
}

export type ParseResult = { ok: true; data: BackupData; summary: BackupSummary } | { ok: false; error: string }

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/** Instante ISO válido, normalizado para UTC no minuto exato, como o repositório grava. */
function instant(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const date = parseISO(value)
  return Number.isNaN(date.getTime()) ? null : startOfMinute(date).toISOString()
}

/** Instante ISO válido em UTC, sem truncar (`createdAt`/`updatedAt` guardam segundos). */
function timestamp(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const date = parseISO(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

class BackupError extends Error {}

function readInterval(raw: unknown, n: number): Interval {
  const fail = (what: string): never => {
    throw new BackupError(`Intervalo ${n} ${what}.`)
  }
  if (!isObject(raw)) return fail('não é um objeto')
  if (typeof raw.id !== 'string' || raw.id === '') fail('sem id')
  const start = instant(raw.start) ?? fail('com início inválido')
  const end = raw.end === null || raw.end === undefined ? null : (instant(raw.end) ?? fail('com fim inválido'))
  if (end !== null && end < start) fail('com fim antes do início')
  if (raw.note !== undefined && typeof raw.note !== 'string') fail('com observação inválida')
  if (raw.workItemId != null && !isDevOpsId(raw.workItemId)) fail('com work item inválido')
  if (raw.taskId != null && !isDevOpsId(raw.taskId)) fail('com task inválida')
  if (raw.declared !== undefined && typeof raw.declared !== 'boolean') fail('com "declarado" inválido')
  let project = ''
  if (raw.project != null) {
    if (typeof raw.project !== 'string') fail('com projeto inválido')
    const normalized = normalizeProject(raw.project as string)
    if (!normalized.ok) return fail(`com projeto de mais de ${PROJECT_MAX_LENGTH} caracteres`)
    project = normalized.value
  }
  return withDevOpsDefaults({
    id: raw.id as string,
    start,
    end,
    note: (raw.note as string | undefined) ?? '',
    workItemId: raw.workItemId,
    taskId: raw.taskId,
    declared: raw.declared,
    project,
    createdAt: timestamp(raw.createdAt) ?? start,
    updatedAt: timestamp(raw.updatedAt) ?? start,
  })
}

function readDayOff(raw: unknown, n: number): DayOff {
  if (!isObject(raw) || typeof raw.date !== 'string' || !isDayKey(raw.date)) {
    throw new BackupError(`Dia sem meta ${n} inválido.`)
  }
  if (raw.note !== undefined && typeof raw.note !== 'string') throw new BackupError(`Dia sem meta ${n} inválido.`)
  return { date: raw.date, note: (raw.note as string | undefined) ?? '' }
}

function readSettings(raw: unknown): Settings {
  if (raw === undefined) return { ...DEFAULT_SETTINGS, workDays: [...DEFAULT_SETTINGS.workDays] }
  if (!isObject(raw)) throw new BackupError('Configurações inválidas.')
  const settings: Settings = {
    dailyTargetMinutes: (raw.dailyTargetMinutes ?? DEFAULT_SETTINGS.dailyTargetMinutes) as number,
    workDays: (raw.workDays ?? [...DEFAULT_SETTINGS.workDays]) as number[],
    periodStartDay: (raw.periodStartDay ?? DEFAULT_SETTINGS.periodStartDay) as number,
    launchRoundQuarter: (raw.launchRoundQuarter ?? DEFAULT_SETTINGS.launchRoundQuarter) as boolean,
    launchClose: (raw.launchClose ?? DEFAULT_SETTINGS.launchClose) as boolean,
  }
  const problem = settingsProblem(settings)
  if (problem) throw new BackupError(`Configurações inválidas: ${problem}`)
  return { ...settings, workDays: [...settings.workDays] }
}

/**
 * Lê e valida um arquivo de backup. Não grava nada: quem chama mostra o resumo e só depois
 * substitui os dados. Intervalos sem os campos do Azure DevOps (backups antigos) ficam sem
 * work item, sem task, não declarados e sem projeto.
 */
export function parseBackup(text: string): ParseResult {
  let json: unknown
  try {
    json = JSON.parse(text)
  } catch {
    return { ok: false, error: 'O arquivo não é um JSON válido.' }
  }
  if (!isObject(json) || json.app !== 'ponto') return { ok: false, error: 'Não é um backup do Ponto.' }
  if (json.version !== BACKUP_VERSION) {
    return { ok: false, error: `Versão de backup desconhecida (${String(json.version)}). Atualize o app e tente de novo.` }
  }
  if (json.env !== 'prod' && json.env !== 'hml') return { ok: false, error: 'Não é um backup do Ponto.' }
  if (!Array.isArray(json.intervals) || !Array.isArray(json.daysOff)) {
    return { ok: false, error: 'Não é um backup do Ponto.' }
  }

  try {
    const intervals = json.intervals.map((raw, i) => readInterval(raw, i + 1))
    const ids = new Set<string>()
    intervals.forEach((interval, i) => {
      if (ids.has(interval.id)) throw new BackupError(`Intervalo ${i + 1} repetido.`)
      ids.add(interval.id)
    })
    if (intervals.filter((interval) => interval.end === null).length > 1) {
      throw new BackupError('O backup tem mais de um intervalo em andamento.')
    }
    const daysOff = json.daysOff.map((raw, i) => readDayOff(raw, i + 1))
    const settings = readSettings(json.settings)

    const days = intervals.map((interval) => dayKey(interval.start)).sort()
    return {
      ok: true,
      data: { intervals, daysOff, settings },
      summary: {
        env: json.env,
        exportedAt: instant(json.exportedAt) ?? '',
        intervals: intervals.length,
        firstDay: days[0] ?? null,
        lastDay: days[days.length - 1] ?? null,
        daysOff: daysOff.length,
      },
    }
  } catch (error) {
    if (error instanceof BackupError) return { ok: false, error: error.message }
    throw error
  }
}

/** "hoje", "ontem", "há 5 dias" ou "nunca". */
export function formatLastBackup(lastBackupAt: string | null, now: Date): string {
  if (lastBackupAt === null) return 'nunca'
  const last = parseISO(lastBackupAt)
  if (Number.isNaN(last.getTime())) return 'nunca'
  const days = differenceInCalendarDays(now, last)
  if (days <= 0) return 'hoje'
  if (days === 1) return 'ontem'
  return `há ${days} dias`
}

/** Data de um dia `AAAA-MM-DD` como `dd/mm/aaaa`. */
export function formatDayBr(key: string): string {
  return format(parseISO(key), 'dd/MM/yyyy')
}

/** Data e hora do backup, como `15/11/2026 às 18:00`, no fuso local. Vazio se não houver. */
export function formatExportedAt(exportedAt: string): string {
  if (exportedAt === '') return ''
  return format(parseISO(exportedAt), "dd/MM/yyyy 'às' HH:mm")
}

/** Tamanho em bytes, como `850 B`, `12 KB` ou `1,5 MB`. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB']
  let value = bytes / 1024
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit++
  }
  const text = value < 10 ? value.toFixed(1).replace('.', ',').replace(',0', '') : String(Math.round(value))
  return `${text} ${units[unit]}`
}

export type RecordResult<T> = { ok: true; value: T } | { ok: false; error: string }

function readRecord<T>(read: () => T): RecordResult<T> {
  try {
    return { ok: true, value: read() }
  } catch (error) {
    if (error instanceof BackupError) return { ok: false, error: error.message }
    throw error
  }
}

/** Valida um intervalo que veio de fora (sincronização), com as mesmas regras do backup. */
export const parseIntervalRecord = (raw: unknown): RecordResult<Interval> => readRecord(() => readInterval(raw, 1))

/** Valida um dia sem meta que veio de fora (sincronização). */
export const parseDayOffRecord = (raw: unknown): RecordResult<DayOff> => readRecord(() => readDayOff(raw, 1))

/** Valida configurações que vieram de fora (sincronização). */
export const parseSettingsRecord = (raw: unknown): RecordResult<Settings> =>
  readRecord(() => {
    if (raw === undefined) throw new BackupError('Configurações ausentes.')
    return readSettings(raw)
  })
