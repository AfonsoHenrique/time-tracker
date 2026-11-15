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
  /** Work item do Azure DevOps ao qual o intervalo pertence (ex.: 123567). `null` = sem work item. */
  workItemId: number | null
  /** Task filha do work item, onde as horas são declaradas (ex.: 123568). `null` = sem task. */
  taskId: number | null
  /** As horas deste intervalo já foram lançadas no Azure DevOps. */
  declared: boolean
  createdAt: string
  updatedAt: string
}

/** Valores dos campos do Azure DevOps para um intervalo sem nenhum deles preenchido. */
export const EMPTY_DEVOPS_FIELDS: Readonly<Pick<Interval, 'workItemId' | 'taskId' | 'declared'>> = {
  workItemId: null,
  taskId: null,
  declared: false,
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
