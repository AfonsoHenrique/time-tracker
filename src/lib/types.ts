/**
 * Um período trabalhado. `start` e `end` são instantes em ISO 8601 UTC com precisão de minuto
 * (ex.: `2026-11-09T11:00:00.000Z`). `end` é `null` enquanto o intervalo está em andamento.
 * O dia de um intervalo é o dia local do seu `start`.
 */
export interface Interval {
  id: string
  start: string
  end: string | null
  note: string
  createdAt: string
  updatedAt: string
}

/** Dia sem meta (feriado, folga): tira a meta diária da semana. `date` é `AAAA-MM-DD` no fuso local. */
export interface DayOff {
  date: string
  note: string
}

export interface Settings {
  /** Meta de um dia útil, em minutos. */
  dailyTargetMinutes: number
  /** Dias úteis, numerados como no ISO 8601: 1 = segunda … 7 = domingo. */
  workDays: number[]
  /** Dia do mês em que o período mensal começa (1 a 28). O período vai até o dia anterior do mês seguinte. */
  periodStartDay: number
}

export const DEFAULT_SETTINGS: Readonly<Settings> = {
  dailyTargetMinutes: 8 * 60,
  workDays: [1, 2, 3, 4, 5],
  periodStartDay: 26,
}

/** Intervalo fechado de dias, em chaves `AAAA-MM-DD` (as duas pontas incluídas). */
export interface DayRange {
  start: string
  end: string
}
