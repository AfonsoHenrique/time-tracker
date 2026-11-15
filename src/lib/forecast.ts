import { addMinutes, differenceInMinutes, parseISO, startOfMinute } from 'date-fns'
import { intervalMinutes, intervalsOfDay } from './balance'
import { dayKey } from './time'
import type { Interval } from './types'

/** Almoço reservado na previsão enquanto ele ainda é provável. */
export const LUNCH_MINUTES = 60
/** Uma pausa encerrada com pelo menos isto conta como o almoço do dia. */
export const LONG_BREAK_MINUTES = 45
/** Depois desta hora (minutos do dia) o almoço não é mais esperado. */
export const LUNCH_LATEST_START = 14 * 60
/** O almoço só é esperado se a primeira entrada do dia veio antes desta hora (minutos do dia). */
export const LUNCH_FIRST_ENTRY_BEFORE = 12 * 60

export type DayForecast =
  | { kind: 'none' }
  /** A meta já foi cumprida, no minuto `at`. */
  | { kind: 'done'; at: Date }
  /**
   * Saída prevista em `at`, com `lunchMinutes` de almoço reservado.
   * `returnBy` só vem quando se está fora e a pausa atual conta como almoço: é a volta que mantém a previsão.
   */
  | { kind: 'forecast'; at: Date; lunchMinutes: number; returnBy: Date | null }

export interface ForecastInput {
  /** Dia (`AAAA-MM-DD`). Só há previsão quando é o dia de `now`. */
  date: string
  intervals: readonly Interval[]
  /** Meta do dia em minutos. */
  target: number
  now: Date
}

function minutesOfDay(date: Date): number {
  return date.getHours() * 60 + date.getMinutes()
}

/** Previsão do horário em que a meta do dia fecha. Regras na spec 009. */
export function forecastDayEnd({ date, intervals, target, now }: ForecastInput): DayForecast {
  if (target <= 0) return { kind: 'none' }
  const current = startOfMinute(now)
  if (dayKey(current) !== date) return { kind: 'none' }
  if (intervals.some((interval) => interval.end === null && dayKey(interval.start) !== date)) return { kind: 'none' }

  const day = intervalsOfDay(intervals, date).sort((a, b) => a.start.localeCompare(b.start))
  const first = day[0]
  const last = day[day.length - 1]
  if (first === undefined || last === undefined) return { kind: 'none' }

  let worked = 0
  for (const interval of day) {
    const minutes = intervalMinutes(interval, current)
    if (worked + minutes >= target) return { kind: 'done', at: addMinutes(parseISO(interval.start), target - worked) }
    worked += minutes
  }
  const remaining = target - worked

  const tookLongBreak = day.some((interval, index) => {
    const next = day[index + 1]
    if (next === undefined || interval.end === null) return false
    return differenceInMinutes(parseISO(next.start), parseISO(interval.end)) >= LONG_BREAK_MINUTES
  })
  const inside = last.end === null
  const breakStart = last.end === null ? current : parseISO(last.end)
  const ongoingBreak = Math.max(0, differenceInMinutes(current, breakStart))
  const lunchExpected =
    !tookLongBreak &&
    minutesOfDay(parseISO(first.start)) < LUNCH_FIRST_ENTRY_BEFORE &&
    minutesOfDay(breakStart) < LUNCH_LATEST_START
  const lunchMinutes = lunchExpected ? Math.max(0, LUNCH_MINUTES - ongoingBreak) : 0

  return {
    kind: 'forecast',
    at: addMinutes(current, remaining + lunchMinutes),
    lunchMinutes,
    returnBy: !inside && lunchMinutes > 0 ? addMinutes(current, lunchMinutes) : null,
  }
}
