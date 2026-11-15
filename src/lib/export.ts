import { format, getISODay, parseISO } from 'date-fns'
import { intervalMinutes } from './balance'
import { formatTime } from './clock'
import { formatDuration } from './duration'
import { dayKey } from './time'
import type { DayRange, Interval } from './types'

/** Colunas da aba SEMANA da planilha `HORAS.xlsx`. */
export const EXPORT_HEADER = ['SEMANA', 'DATA', 'INICIO', 'FIM', 'Soma', 'Descricao', 'TASK', 'Projeto', 'Detalhe']

const WEEKDAYS = ['seg', 'ter', 'qua', 'qui', 'sex', 'sáb', 'dom']

function inRange(interval: Interval, range: DayRange): boolean {
  const day = dayKey(interval.start)
  return day >= range.start && day <= range.end
}

/**
 * Linhas para a planilha: uma por intervalo fechado que começa na faixa, do mais recente para o
 * mais antigo. A linha fica no dia do início, mesmo que o intervalo passe da meia-noite.
 * TASK, Projeto e Detalhe ficam vazios para o usuário preencher.
 */
export function exportRows(intervals: readonly Interval[], range: DayRange): string[][] {
  return intervals
    .filter((interval) => interval.end !== null && inRange(interval, range))
    .sort((a, b) => parseISO(b.start).getTime() - parseISO(a.start).getTime())
    .map((interval) => {
      const start = parseISO(interval.start)
      return [
        WEEKDAYS[getISODay(start) - 1],
        format(start, 'dd/MM/yyyy'),
        formatTime(interval.start),
        formatTime(interval.end as string),
        formatDuration(intervalMinutes(interval, start)),
        interval.note,
        '',
        '',
        '',
      ]
    })
}

/** Quantos intervalos da faixa estão em andamento e por isso ficam fora da exportação. */
export function countOpenInRange(intervals: readonly Interval[], range: DayRange): number {
  return intervals.filter((interval) => interval.end === null && inRange(interval, range)).length
}

/** Texto para colar no Excel: colunas separadas por tabulação, sem cabeçalho. */
export function toTsv(rows: readonly string[][]): string {
  return rows.map((row) => row.map((cell) => cell.replace(/[\t\r\n]+/g, ' ')).join('\t')).join('\n')
}

function csvCell(cell: string): string {
  return /[;"\r\n]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell
}

/**
 * Arquivo CSV no formato que o Excel em português abre direto: cabeçalho, `;` entre colunas,
 * `\r\n` entre linhas e BOM no início para os acentos aparecerem certos.
 */
export function toCsv(rows: readonly string[][]): string {
  const lines = [EXPORT_HEADER, ...rows].map((row) => row.map(csvCell).join(';'))
  return `﻿${lines.join('\r\n')}\r\n`
}

export function exportFileName(range: DayRange): string {
  return `ponto-${range.start}-a-${range.end}.csv`
}
