import type { Interval } from './types'

/** Instante UTC a partir de uma data e hora locais, ex.: `at('2026-11-09 08:30')`. */
export function at(local: string): string {
  return new Date(local.replace(' ', 'T')).toISOString()
}

let counter = 0

/** Intervalo de teste com horários locais; sem `end`, fica em andamento. */
export function iv(start: string, end: string | null = null, note = ''): Interval {
  counter += 1
  return {
    id: `iv-${counter}`,
    start: at(start),
    end: end === null ? null : at(end),
    note,
    createdAt: at(start),
    updatedAt: at(start),
  }
}
