import { differenceInSeconds, format, getISODay, parseISO } from 'date-fns'
import { devOpsIdToText, normalizeProject, parseDevOpsId } from './devops'
import { formatDuration } from './duration'
import type { DayForecast } from './forecast'
import { dayKey, parseDayKey } from './time'
import { PROJECT_MAX_LENGTH, type DayRange, type Interval } from './types'

const WEEKDAYS = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo']
const MONTHS = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
]

/** Cronômetro de um intervalo em andamento: `H:MM:SS` desde o início. Nunca negativo. */
export function formatElapsed(start: string, now: Date): string {
  const total = Math.max(0, differenceInSeconds(now, parseISO(start)))
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const seconds = total % 60
  return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

/**
 * Título do dia, ex.: "Segunda, 9 de novembro". O ano só aparece quando é diferente do ano de `now`.
 */
export function formatDayTitle(key: string, now: Date): string {
  const date = parseDayKey(key)
  const base = `${WEEKDAYS[getISODay(date) - 1]}, ${date.getDate()} de ${MONTHS[date.getMonth()]}`
  return date.getFullYear() === now.getFullYear() ? base : `${base} de ${date.getFullYear()}`
}

const SHORT_WEEKDAYS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']

/** Dia curto com o dia da semana, ex.: "Seg 09/11". */
export function formatWeekdayShort(key: string): string {
  const date = parseDayKey(key)
  return `${SHORT_WEEKDAYS[getISODay(date) - 1]} ${format(date, 'dd/MM')}`
}

/**
 * Título de uma faixa de dias (semana ou período), ex.: "2 a 8 de novembro" ou
 * "26 de outubro a 25 de novembro". Os anos aparecem quando a faixa vira o ano ou não é do ano de `now`.
 */
export function formatRangeTitle(range: DayRange, now: Date): string {
  const start = parseDayKey(range.start)
  const end = parseDayKey(range.end)
  const sameYear = start.getFullYear() === end.getFullYear()
  const showYear = !sameYear || end.getFullYear() !== now.getFullYear()
  const endText = `${end.getDate()} de ${MONTHS[end.getMonth()]}${showYear ? ` de ${end.getFullYear()}` : ''}`
  if (start.getMonth() === end.getMonth() && sameYear) return `${start.getDate()} a ${endText}`
  const startText = `${start.getDate()} de ${MONTHS[start.getMonth()]}${sameYear ? '' : ` de ${start.getFullYear()}`}`
  return `${startText} a ${endText}`
}

/** Hora local de um instante, `HH:MM`. É o formato de `<input type="time">`. */
export function formatTime(instant: string): string {
  return format(parseISO(instant), 'HH:mm')
}

/** Dia e mês curtos, ex.: "10/11". */
export function formatShortDay(key: string): string {
  return format(parseDayKey(key), 'dd/MM')
}

const TIME = /^([01]\d|2[0-3]):([0-5]\d)$/

/** Instante local do dia na hora `HH:MM`, ou `null` se o texto não for uma hora válida. */
export function parseTimeInput(key: string, text: string): Date | null {
  const match = TIME.exec(text.trim())
  if (!match) return null
  const date = parseDayKey(key)
  date.setHours(Number(match[1]), Number(match[2]), 0, 0)
  return date
}

export interface IntervalForm {
  /** Dia do início (`AAAA-MM-DD`). */
  day: string
  /** Dia do fim. Normalmente é o mesmo do início; só muda num intervalo que já passava da meia-noite. */
  endDay: string
  start: string
  /** Vazio deixa o intervalo em andamento. */
  end: string
  note: string
  /** Id do work item do Azure DevOps, como digitado. Vazio = sem work item. */
  workItem: string
  /** Id da task filha, como digitado. Vazio = sem task. */
  task: string
  declared: boolean
  project: string
}

export type IntervalFormResult =
  | {
      ok: true
      start: Date
      end: Date | null
      note: string
      workItemId: number | null
      taskId: number | null
      declared: boolean
      project: string
    }
  | { ok: false; error: string }

/** Lê o formulário de intervalo. Não arredonda nada: grava o minuto digitado. */
export function readIntervalForm(form: IntervalForm): IntervalFormResult {
  const start = parseTimeInput(form.day, form.start)
  if (!start) return { ok: false, error: 'Informe a hora de início.' }
  let end: Date | null = null
  if (form.end.trim() !== '') {
    end = parseTimeInput(form.endDay, form.end)
    if (!end) return { ok: false, error: 'Hora de fim inválida.' }
    if (end < start) return { ok: false, error: 'O fim não pode ser antes do início.' }
  }
  const workItem = parseDevOpsId(form.workItem)
  if (!workItem.ok) return { ok: false, error: 'O work item deve ser um número, ex.: 123567.' }
  const task = parseDevOpsId(form.task)
  if (!task.ok) return { ok: false, error: 'A task deve ser um número, ex.: 123568.' }
  const project = normalizeProject(form.project)
  if (!project.ok) return { ok: false, error: `O projeto deve ter no máximo ${PROJECT_MAX_LENGTH} caracteres.` }
  return {
    ok: true,
    start,
    end,
    note: form.note.trim(),
    workItemId: workItem.value,
    taskId: task.value,
    declared: form.declared,
    project: project.value,
  }
}

/** Formulário preenchido com um intervalo existente, ou vazio para um novo no dia. */
export function intervalToForm(
  day: string,
  interval?: Pick<Interval, 'start' | 'end' | 'note' | 'workItemId' | 'taskId' | 'declared' | 'project'>,
): IntervalForm {
  if (!interval) {
    return { day, endDay: day, start: '', end: '', note: '', workItem: '', task: '', declared: false, project: '' }
  }
  return {
    day: dayKey(interval.start),
    endDay: interval.end === null ? dayKey(interval.start) : dayKey(interval.end),
    start: formatTime(interval.start),
    end: interval.end === null ? '' : formatTime(interval.end),
    note: interval.note,
    workItem: devOpsIdToText(interval.workItemId),
    task: devOpsIdToText(interval.taskId),
    declared: interval.declared,
    project: interval.project,
  }
}

/**
 * Texto da previsão de saída do dia, ex.: "Saída prevista 17:32 · com 1:00 de almoço".
 * `null` quando não há previsão. Uma hora de outro dia ganha "(amanhã)".
 */
export function formatForecast(forecast: DayForecast, date: string): string | null {
  if (forecast.kind === 'none') return null
  const time = (instant: Date) => `${format(instant, 'HH:mm')}${dayKey(instant) === date ? '' : ' (amanhã)'}`
  if (forecast.kind === 'done') return `Meta fechada às ${time(forecast.at)}`
  const base = `Saída prevista ${time(forecast.at)}`
  if (forecast.returnBy !== null) return `${base} · se voltar até ${time(forecast.returnBy)}`
  if (forecast.lunchMinutes > 0) return `${base} · com ${formatDuration(forecast.lunchMinutes)} de almoço`
  return base
}
