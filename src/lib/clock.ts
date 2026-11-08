import { differenceInSeconds, format, getISODay, parseISO } from 'date-fns'
import { dayKey, parseDayKey } from './time'
import type { DayRange } from './types'

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
 * Título de uma semana, ex.: "2 a 8 de novembro" ou "30 de novembro a 6 de dezembro".
 * Os anos aparecem quando a semana vira o ano ou não é do ano de `now`.
 */
export function formatWeekTitle(range: DayRange, now: Date): string {
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
}

export type IntervalFormResult =
  | { ok: true; start: Date; end: Date | null; note: string }
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
  return { ok: true, start, end, note: form.note.trim() }
}

/** Formulário preenchido com um intervalo existente, ou vazio para um novo no dia. */
export function intervalToForm(
  day: string,
  interval?: { start: string; end: string | null; note: string },
): IntervalForm {
  if (!interval) return { day, endDay: day, start: '', end: '', note: '' }
  return {
    day: dayKey(interval.start),
    endDay: interval.end === null ? dayKey(interval.start) : dayKey(interval.end),
    start: formatTime(interval.start),
    end: interval.end === null ? '' : formatTime(interval.end),
    note: interval.note,
  }
}
