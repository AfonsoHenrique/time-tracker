import { differenceInMinutes, parseISO } from 'date-fns'
import { daysInRange, dayKey, isWorkDay, weekRange } from './time'
import type { DayRange, Interval, Settings } from './types'

/** Minutos de um intervalo. Um intervalo em andamento conta até `now`. */
export function intervalMinutes(interval: Interval, now: Date): number {
  const end = interval.end === null ? now : parseISO(interval.end)
  return Math.max(0, differenceInMinutes(end, parseISO(interval.start)))
}

/** Intervalos que pertencem ao dia (pelo dia local do início). */
export function intervalsOfDay(intervals: readonly Interval[], key: string): Interval[] {
  return intervals.filter((interval) => dayKey(interval.start) === key)
}

export function workedMinutes(intervals: readonly Interval[], key: string, now: Date): number {
  return intervalsOfDay(intervals, key).reduce((sum, interval) => sum + intervalMinutes(interval, now), 0)
}

/** Meta do dia: a diária em dia útil que não é "dia sem meta"; zero nos demais. */
export function targetMinutes(
  key: string,
  settings: Pick<Settings, 'dailyTargetMinutes' | 'workDays'>,
  daysOff: ReadonlySet<string>,
): number {
  return isWorkDay(key, settings) && !daysOff.has(key) ? settings.dailyTargetMinutes : 0
}

export interface DaySummary {
  date: string
  worked: number
  target: number
  /** O que falta para a meta, nunca negativo. */
  remaining: number
  /** O que passou da meta, nunca negativo. */
  extra: number
  isDayOff: boolean
}

export function summarizeDay(
  key: string,
  intervals: readonly Interval[],
  daysOff: ReadonlySet<string>,
  settings: Settings,
  now: Date,
): DaySummary {
  const worked = workedMinutes(intervals, key, now)
  const target = targetMinutes(key, settings, daysOff)
  return {
    date: key,
    worked,
    target,
    remaining: Math.max(0, target - worked),
    extra: Math.max(0, worked - target),
    isDayOff: daysOff.has(key),
  }
}

export interface WeekSummary {
  range: DayRange
  days: DaySummary[]
  worked: number
  target: number
  remaining: number
  extra: number
}

/**
 * Resumo da semana (segunda a domingo) que contém o dia. A semana começa do zero: nada vem da anterior.
 * Horas a mais num dia, ou no fim de semana, abatem o que falta na semana.
 */
export function summarizeWeek(
  key: string,
  intervals: readonly Interval[],
  daysOff: ReadonlySet<string>,
  settings: Settings,
  now: Date,
): WeekSummary {
  const range = weekRange(key)
  const days = daysInRange(range).map((day) => summarizeDay(day, intervals, daysOff, settings, now))
  const worked = days.reduce((sum, day) => sum + day.worked, 0)
  const target = days.reduce((sum, day) => sum + day.target, 0)
  return {
    range,
    days,
    worked,
    target,
    remaining: Math.max(0, target - worked),
    extra: Math.max(0, worked - target),
  }
}
