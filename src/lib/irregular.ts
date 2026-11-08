import { parseISO } from 'date-fns'
import { intervalMinutes } from './balance'
import { dayKey } from './time'
import type { Interval } from './types'

export type IrregularityKind =
  /** Intervalo ainda aberto de um dia anterior: esqueceu de bater a saída. */
  | 'open-past'
  /** Intervalo com mais de 12h. */
  | 'too-long'
  /** Intervalo que termina em outro dia. */
  | 'crosses-midnight'
  /** Dois intervalos do dia se sobrepõem. */
  | 'overlap'
  /** Dia útil com meta, já passado, sem nenhuma hora. */
  | 'empty-workday'

export const MAX_INTERVAL_MINUTES = 12 * 60

const DESCRIPTIONS: Record<IrregularityKind, string> = {
  'open-past': 'Intervalo aberto de um dia anterior: falta bater a saída.',
  'too-long': 'Intervalo com mais de 12h.',
  'crosses-midnight': 'Intervalo que passa da meia-noite.',
  overlap: 'Intervalos sobrepostos.',
  'empty-workday': 'Dia útil sem nenhuma hora registrada.',
}

/** Motivo de uma irregularidade, em texto para a tela. */
export function describeIrregularity(kind: IrregularityKind): string {
  return DESCRIPTIONS[kind]
}

export interface IrregularityInput {
  /** Dia avaliado (`AAAA-MM-DD`). */
  date: string
  /** Intervalos do dia (pelo início). */
  intervals: readonly Interval[]
  /** Meta do dia, em minutos (zero em fim de semana ou dia sem meta). */
  target: number
  now: Date
}

/**
 * Problemas de um dia, sem repetir, sempre na ordem de `IrregularityKind`.
 * Dia útil com menos de 8h não é irregular: o que importa é o saldo da semana.
 */
export function findIrregularities({ date, intervals, target, now }: IrregularityInput): IrregularityKind[] {
  const found = new Set<IrregularityKind>()
  const today = dayKey(now)

  for (const interval of intervals) {
    if (interval.end === null && dayKey(interval.start) < today) found.add('open-past')
    if (intervalMinutes(interval, now) > MAX_INTERVAL_MINUTES) found.add('too-long')
    if (interval.end !== null && dayKey(interval.end) !== dayKey(interval.start)) found.add('crosses-midnight')
  }

  const byStart = [...intervals].sort((a, b) => parseISO(a.start).getTime() - parseISO(b.start).getTime())
  for (let i = 1; i < byStart.length; i++) {
    const previous = byStart[i - 1]
    const previousEnd = previous.end === null ? now : parseISO(previous.end)
    // Um intervalo que termina exatamente quando o próximo começa não é sobreposição.
    if (previousEnd.getTime() > parseISO(byStart[i].start).getTime()) found.add('overlap')
  }

  const worked = intervals.reduce((sum, interval) => sum + intervalMinutes(interval, now), 0)
  if (target > 0 && date < today && worked === 0) found.add('empty-workday')

  const order: IrregularityKind[] = ['open-past', 'too-long', 'crosses-midnight', 'overlap', 'empty-workday']
  return order.filter((kind) => found.has(kind))
}
