import {
  addDays,
  addMonths,
  eachDayOfInterval,
  format,
  getISODay,
  parseISO,
  setDate,
  startOfWeek,
  subDays,
  subMonths,
} from 'date-fns'
import type { DayRange, Settings } from './types'

const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/

export function isDayKey(value: string): boolean {
  return DAY_KEY.test(value) && !Number.isNaN(parseISO(value).getTime())
}

/**
 * Chave do dia local (`AAAA-MM-DD`). Aceita um `Date`, um instante ISO (convertido para o fuso local)
 * ou uma chave de dia, que volta igual.
 */
export function dayKey(value: Date | string): string {
  const date = typeof value === 'string' ? parseISO(value) : value
  return format(date, 'yyyy-MM-dd')
}

/** Meia-noite local do dia. */
export function parseDayKey(key: string): Date {
  if (!isDayKey(key)) throw new Error(`Dia inválido: ${key}`)
  return parseISO(key)
}

/** Semana de segunda a domingo que contém o dia. */
export function weekRange(key: string): DayRange {
  const start = startOfWeek(parseDayKey(key), { weekStartsOn: 1 })
  return { start: dayKey(start), end: dayKey(addDays(start, 6)) }
}

/**
 * Período mensal que contém o dia. Com `periodStartDay` 26, vai do dia 26 de um mês ao dia 25 do seguinte.
 * Use de 1 a 28 para o dia existir em todos os meses.
 */
export function periodRange(key: string, periodStartDay: number): DayRange {
  const day = parseDayKey(key)
  const start =
    day.getDate() >= periodStartDay
      ? setDate(day, periodStartDay)
      : setDate(subMonths(day, 1), periodStartDay)
  const end = subDays(addMonths(start, 1), 1)
  return { start: dayKey(start), end: dayKey(end) }
}

export function daysInRange(range: DayRange): string[] {
  return eachDayOfInterval({
    start: parseDayKey(range.start),
    end: parseDayKey(range.end),
  }).map(dayKey)
}

/** Primeiro instante (UTC) do dia local. */
export function dayStartInstant(key: string): string {
  return parseDayKey(key).toISOString()
}

/** Primeiro instante (UTC) do dia local seguinte: limite superior, exclusivo, de um dia. */
export function dayEndInstant(key: string): string {
  return addDays(parseDayKey(key), 1).toISOString()
}

export function isWorkDay(key: string, settings: Pick<Settings, 'workDays'>): boolean {
  return settings.workDays.includes(getISODay(parseDayKey(key)))
}
