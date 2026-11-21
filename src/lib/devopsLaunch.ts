import { addDays, parseISO } from 'date-fns'
import { intervalMinutes } from './balance'
import { formatTime } from './clock'
import { formatDuration, toDecimalHours } from './duration'
import { dayKey, dayStartInstant, weekRange } from './time'
import type { Interval } from './types'

/** Campos padrão do Azure DevOps que o lançamento preenche (spec 013). */
export const DEVOPS_FIELDS = {
  originalEstimate: 'Microsoft.VSTS.Scheduling.OriginalEstimate',
  completedWork: 'Microsoft.VSTS.Scheduling.CompletedWork',
  startDate: 'Microsoft.VSTS.Scheduling.StartDate',
  targetDate: 'Microsoft.VSTS.Scheduling.TargetDate',
  assignedTo: 'System.AssignedTo',
  state: 'System.State',
} as const

const ORGANIZATION = /^[A-Za-z0-9][A-Za-z0-9-]{0,48}[A-Za-z0-9]?$/

/**
 * Lê a organização digitada: o nome (`minha-org`), a URL `https://dev.azure.com/minha-org/…`
 * ou `https://minha-org.visualstudio.com/…`.
 */
export function parseOrganization(text: string): { ok: true; value: string } | { ok: false } {
  const trimmed = text.trim()
  let name = trimmed
  const devAzure = /^(?:https?:\/\/)?dev\.azure\.com\/([^/?#]+)(?:[/?#].*)?$/i.exec(trimmed)
  const visualStudio = /^(?:https?:\/\/)?([^./?#]+)\.visualstudio\.com(?:[/?#].*)?$/i.exec(trimmed)
  if (devAzure) name = decodeURIComponent(devAzure[1])
  else if (visualStudio) name = visualStudio[1]
  return ORGANIZATION.test(name) ? { ok: true, value: name } : { ok: false }
}

/** Múltiplo de 15 mais próximo (até 7 min desce, 8 ou mais sobe), com mínimo de 15 min. */
export function roundToQuarter(minutes: number): number {
  return Math.max(15, Math.round(minutes / 15) * 15)
}

export interface LaunchOptions {
  /** Arredondar a duração de cada intervalo para 15 min. */
  roundQuarter: boolean
}

export interface LaunchLine {
  intervalId: string
  /** Início, para ordenar. */
  start: string
  /** Texto da linha, ex.: `19/nov 10:30 10:45 0:15 Daily MS`. */
  text: string
  /** Minutos que contam para a task (arredondados quando configurado). */
  minutes: number
}

export interface TaskPlan {
  taskId: number
  /** Total da task em minutos. */
  minutes: number
  /** Horas decimais do total, com duas casas. */
  hours: number
  /** Segunda-feira da semana do primeiro intervalo (`AAAA-MM-DD`). */
  startDate: string
  /** Sexta-feira da semana do último intervalo (`AAAA-MM-DD`). */
  targetDate: string
  /** Do mais recente para o mais antigo. */
  lines: LaunchLine[]
  intervalIds: string[]
  /** Quantos intervalos ainda não estão declarados. */
  pendingCount: number
}

export interface LaunchPlan {
  /** Tasks com algum intervalo não declarado, na ordem do id. */
  tasks: TaskPlan[]
  /** Intervalos fechados e não declarados sem task: não são lançados. */
  withoutTask: { count: number; minutes: number }
}

const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

/** Duração de um intervalo fechado para o lançamento. */
export function launchMinutes(interval: Interval, options: LaunchOptions): number {
  const minutes = intervalMinutes(interval, parseISO(interval.start))
  return options.roundQuarter ? roundToQuarter(minutes) : minutes
}

/** Linha de Detalhes do apontamento: data, início, fim, duração e observação. */
export function detailLine(interval: Interval, minutes: number): string {
  const start = parseISO(interval.start)
  const date = `${String(start.getDate()).padStart(2, '0')}/${MONTHS[start.getMonth()]}`
  const parts = [date, formatTime(interval.start), formatTime(interval.end as string), formatDuration(minutes)]
  const note = interval.note.replace(/\s+/g, ' ').trim()
  if (note !== '') parts.push(note)
  return parts.join(' ')
}

/**
 * Junta os intervalos fechados com task por task. Uma task entra quando tem algum intervalo não
 * declarado, e aí leva todos os seus intervalos (declarados ou não) para o total e os detalhes.
 */
export function planLaunch(intervals: readonly Interval[], options: LaunchOptions): LaunchPlan {
  const closed = intervals.filter((interval) => interval.end !== null)
  const byTask = new Map<number, Interval[]>()
  let withoutTaskCount = 0
  let withoutTaskMinutes = 0
  for (const interval of closed) {
    if (interval.taskId === null) {
      if (!interval.declared) {
        withoutTaskCount += 1
        withoutTaskMinutes += intervalMinutes(interval, parseISO(interval.start))
      }
      continue
    }
    const list = byTask.get(interval.taskId) ?? []
    list.push(interval)
    byTask.set(interval.taskId, list)
  }

  const tasks: TaskPlan[] = []
  for (const [taskId, list] of [...byTask].sort(([a], [b]) => a - b)) {
    const pendingCount = list.filter((interval) => !interval.declared).length
    if (pendingCount === 0) continue
    const lines = list
      .map((interval): LaunchLine => {
        const minutes = launchMinutes(interval, options)
        return { intervalId: interval.id, start: interval.start, text: detailLine(interval, minutes), minutes }
      })
      .sort((a, b) => parseISO(b.start).getTime() - parseISO(a.start).getTime())
    const minutes = lines.reduce((sum, line) => sum + line.minutes, 0)
    const first = lines[lines.length - 1].start
    const last = lines[0].start
    const monday = weekRange(dayKey(first)).start
    const lastMonday = weekRange(dayKey(last)).start
    tasks.push({
      taskId,
      minutes,
      hours: toDecimalHours(minutes),
      startDate: monday,
      targetDate: dayKey(addDays(parseISO(lastMonday), 4)),
      lines,
      intervalIds: lines.map((line) => line.intervalId),
      pendingCount,
    })
  }
  return { tasks, withoutTask: { count: withoutTaskCount, minutes: withoutTaskMinutes } }
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/** Detalhes do apontamento em HTML: uma linha por `<div>`, com o texto escapado. */
export function detailsHtml(lines: readonly LaunchLine[]): string {
  return lines.map((line) => `<div>${escapeHtml(line.text)}</div>`).join('')
}

/** Campos da organização que o usuário mapeou na aba Dados. `null` = não preencher. */
export interface CustomFields {
  activityType: string | null
  details: string | null
}

export type PatchOperation =
  | { op: 'test'; path: string; value: unknown }
  | { op: 'add'; path: string; value: unknown }

export interface PatchInput {
  rev: number
  task: TaskPlan
  fields: CustomFields
  /** Valor do Tipo de atividade; ignorado sem o campo mapeado. */
  activityType: string | null
  /** Conta do token, como o Azure DevOps aceita em `System.AssignedTo`. */
  assignedTo: string
  /** Estado a gravar; `null` mantém o atual. */
  state: string | null
}

const field = (name: string, value: unknown): PatchOperation => ({ op: 'add', path: `/fields/${name}`, value })

/** JSON Patch que preenche a task (spec 013, R11–R16 e R21–R22). */
export function buildPatch(input: PatchInput): PatchOperation[] {
  const { task, fields } = input
  const ops: PatchOperation[] = [
    { op: 'test', path: '/rev', value: input.rev },
    field(DEVOPS_FIELDS.originalEstimate, task.hours),
    field(DEVOPS_FIELDS.completedWork, task.hours),
    field(DEVOPS_FIELDS.startDate, dayStartInstant(task.startDate)),
    field(DEVOPS_FIELDS.targetDate, dayStartInstant(task.targetDate)),
    field(DEVOPS_FIELDS.assignedTo, input.assignedTo),
  ]
  if (fields.details !== null) ops.push(field(fields.details, detailsHtml(task.lines)))
  if (fields.activityType !== null && input.activityType !== null) ops.push(field(fields.activityType, input.activityType))
  if (input.state !== null) ops.push(field(DEVOPS_FIELDS.state, input.state))
  return ops
}

/** Ordem dos estados que o lançamento usa. Estados desconhecidos ficam depois de New. */
const STATE_ORDER: Record<string, number> = { New: 0, Active: 1, Resolved: 2, Closed: 3 }

/**
 * Estados que o lançamento grava, sem voltar para trás: `first` vai junto com os campos (Active, a
 * partir de New) e `second`, numa segunda requisição, fecha a task quando `close` está ligado.
 * `null` = não mudar. O processo pode não permitir ir de New direto para Closed, por isso são dois passos.
 */
export function launchStates(current: string, close: boolean): { first: string | null; second: string | null } {
  const now = STATE_ORDER[current] ?? 0
  return {
    first: now < STATE_ORDER.Active ? 'Active' : null,
    second: close && now < STATE_ORDER.Closed ? 'Closed' : null,
  }
}

/** Escolhe, entre os campos do tipo Task, o que tem o nome procurado (sem diferenciar acentos e caixa). */
export function guessField(fields: readonly { name: string; referenceName: string }[], name: string): string | null {
  const plain = (text: string) =>
    text
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .trim()
  return fields.find((candidate) => plain(candidate.name) === plain(name))?.referenceName ?? null
}
