import { describe, expect, it } from 'vitest'
import { intervalMinutes, summarizeDay, summarizeRange, summarizeWeek, targetMinutes, workedMinutes } from './balance'
import { DEFAULT_SETTINGS } from './types'
import { at, iv } from './test-helpers'

const settings = { ...DEFAULT_SETTINGS, workDays: [...DEFAULT_SETTINGS.workDays] }
const noDaysOff = new Set<string>()
const now = new Date('2026-11-13T09:00')

describe('dia', () => {
  it('CA1: 08:00–12:00 e 13:00–17:30 dão 8:30, sem falta e com 0:30 a mais', () => {
    const intervals = [iv('2026-11-10 08:00', '2026-11-10 12:00'), iv('2026-11-10 13:00', '2026-11-10 17:30')]
    expect(summarizeDay('2026-11-10', intervals, noDaysOff, settings, now)).toEqual({
      date: '2026-11-10',
      worked: 510,
      target: 480,
      remaining: 0,
      extra: 30,
      isDayOff: false,
    })
  })

  it('CA2: sábado tem meta 0 e conta o que foi trabalhado', () => {
    const intervals = [iv('2026-11-07 09:30', '2026-11-07 10:45')]
    const day = summarizeDay('2026-11-07', intervals, noDaysOff, settings, now)
    expect(day.target).toBe(0)
    expect(day.worked).toBe(75)
    expect(day.remaining).toBe(0)
    expect(day.extra).toBe(75)
  })

  it('dia útil com menos de 8h mostra o que falta', () => {
    const day = summarizeDay('2026-11-10', [iv('2026-11-10 09:00', '2026-11-10 13:00')], noDaysOff, settings, now)
    expect(day.remaining).toBe(240)
    expect(day.extra).toBe(0)
  })

  it('dia sem meta zera a meta do dia útil', () => {
    expect(targetMinutes('2026-11-02', settings, new Set(['2026-11-02']))).toBe(0)
    expect(targetMinutes('2026-11-03', settings, new Set(['2026-11-02']))).toBe(480)
  })

  it('só conta os intervalos que começam no dia', () => {
    const intervals = [iv('2026-11-09 08:00', '2026-11-09 09:00'), iv('2026-11-10 08:00', '2026-11-10 10:00')]
    expect(workedMinutes(intervals, '2026-11-10', now)).toBe(120)
  })
})

describe('intervalo em andamento', () => {
  it('CA5: aberto às 14:00, com agora 15:20, conta 1:20', () => {
    const open = iv('2026-11-13 14:00')
    expect(intervalMinutes(open, new Date('2026-11-13T15:20'))).toBe(80)
  })

  it('ignora os segundos de agora', () => {
    const open = iv('2026-11-13 14:00')
    expect(intervalMinutes(open, new Date('2026-11-13T15:20:59'))).toBe(80)
  })

  it('nunca fica negativo', () => {
    expect(intervalMinutes(iv('2026-11-13 14:00'), new Date('2026-11-13T13:00'))).toBe(0)
  })
})

describe('semana', () => {
  it('CA3: segunda marcada como sem meta dá 32h de meta', () => {
    const week = summarizeWeek('2026-11-04', [], new Set(['2026-11-02']), settings, now)
    expect(week.target).toBe(32 * 60)
    expect(week.range).toEqual({ start: '2026-11-02', end: '2026-11-08' })
    expect(week.days).toHaveLength(7)
  })

  it('CA4: 9h na segunda, 8h de terça a quinta e sexta em andamento deixam 7h', () => {
    const intervals = [
      iv('2026-11-09 08:00', '2026-11-09 17:00'),
      iv('2026-11-10 08:00', '2026-11-10 16:00'),
      iv('2026-11-11 08:00', '2026-11-11 16:00'),
      iv('2026-11-12 08:00', '2026-11-12 16:00'),
      iv('2026-11-13 09:00'),
    ]
    const week = summarizeWeek('2026-11-13', intervals, noDaysOff, settings, now)
    expect(week.worked).toBe(33 * 60)
    expect(week.target).toBe(40 * 60)
    expect(week.remaining).toBe(7 * 60)
    expect(week.extra).toBe(0)
  })

  it('horas de fim de semana abatem o que falta na semana', () => {
    const intervals = [iv('2026-11-09 08:00', '2026-11-09 16:00'), iv('2026-11-14 10:00', '2026-11-14 12:00')]
    const week = summarizeWeek('2026-11-09', intervals, noDaysOff, settings, new Date('2026-11-15T12:00'))
    expect(week.worked).toBe(10 * 60)
    expect(week.remaining).toBe(30 * 60)
  })

  it('passar da meta mostra o excedente e nenhuma falta', () => {
    const intervals = ['09', '10', '11', '12', '13'].map((d) => iv(`2026-11-${d} 08:00`, `2026-11-${d} 17:00`))
    const week = summarizeWeek('2026-11-09', intervals, noDaysOff, settings, new Date('2026-11-14T08:00'))
    expect(week.remaining).toBe(0)
    expect(week.extra).toBe(5 * 60)
  })

  it('a semana começa do zero: horas de outra semana não entram', () => {
    const intervals = [iv('2026-11-06 08:00', '2026-11-06 20:00')]
    const week = summarizeWeek('2026-11-09', intervals, noDaysOff, settings, now)
    expect(week.worked).toBe(0)
    expect(week.remaining).toBe(40 * 60)
  })
})

describe('summarizeRange', () => {
  const now = new Date(at('2026-11-30 12:00'))
  const period = { start: '2026-10-26', end: '2026-11-25' }

  it('meta do período: 23 dias úteis menos um dia sem meta (CA2)', () => {
    const summary = summarizeRange(period, [], new Set(['2026-11-02']), settings, now)
    expect(summary.days).toHaveLength(31)
    expect(summary.target).toBe(22 * 480)
  })

  it('soma só os dias dentro da faixa (CA3)', () => {
    const intervals = [iv('2026-10-25 09:00', '2026-10-25 10:00'), iv('2026-10-26 08:00', '2026-10-26 12:00')]
    const firstWeekInPeriod = { start: '2026-10-26', end: '2026-11-01' }
    expect(summarizeRange(firstWeekInPeriod, intervals, new Set(), settings, now).worked).toBe(240)
  })
})
