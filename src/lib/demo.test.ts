import { describe, expect, it } from 'vitest'
import { buildBackup, parseBackup } from './backup'
import { targetMinutes, workedMinutes } from './balance'
import { buildDemoData } from './demo'
import { findIrregularities, isIrregularDay } from './irregular'
import { at } from './test-helpers'
import { dayKey, daysInRange } from './time'

const wednesday = new Date(at('2026-11-18 15:00'))

function irregularDays(now: Date) {
  const data = buildDemoData(now)
  const daysOff = new Set(data.daysOff.map((d) => d.date))
  return daysInRange({ start: '2026-11-09', end: dayKey(now) }).filter((date) =>
    isIrregularDay({ date, target: targetMinutes(date, data.settings, daysOff) }, data.intervals, now),
  )
}

describe('buildDemoData', () => {
  it('cobre da segunda da semana anterior até agora, com um só intervalo aberto começando meia hora antes (CA3)', () => {
    const { intervals } = buildDemoData(wednesday)
    const days = intervals.map((i) => dayKey(i.start))
    expect(days[0]).toBe('2026-11-09')
    expect(days[days.length - 1]).toBe('2026-11-18')
    for (const i of intervals) {
      expect(i.start <= wednesday.toISOString()).toBe(true)
      if (i.end !== null) expect(i.end <= wednesday.toISOString()).toBe(true)
    }
    const open = intervals.filter((i) => i.end === null)
    expect(open).toHaveLength(1)
    expect(open[0]).toBe(intervals[intervals.length - 1])
    expect(open[0].start).toBe(at('2026-11-18 14:30'))
  })

  it('é determinístico para o mesmo agora (CA4)', () => {
    expect(buildDemoData(wednesday)).toEqual(buildDemoData(new Date(wednesday)))
  })

  it('tem um dia sem meta e um único dia irregular, por sobreposição, na semana anterior (CA5)', () => {
    const data = buildDemoData(wednesday)
    expect(data.daysOff).toEqual([{ date: '2026-11-11', note: 'Feriado (demo)' }])
    expect(irregularDays(wednesday)).toEqual(['2026-11-12'])
    const thursday = data.intervals.filter((i) => dayKey(i.start) === '2026-11-12')
    expect(findIrregularities({ date: '2026-11-12', intervals: thursday, target: 480, now: wednesday })).toEqual([
      'overlap',
    ])
  })

  it('mistura os campos e passa nas validações do backup e do repositório (CA6)', () => {
    const data = buildDemoData(wednesday)
    const { intervals } = data
    expect(intervals.some((i) => i.taskId !== null)).toBe(true)
    expect(intervals.some((i) => i.taskId === null)).toBe(true)
    expect(intervals.some((i) => i.declared)).toBe(true)
    expect(intervals.some((i) => !i.declared)).toBe(true)
    expect(intervals.some((i) => i.project !== '')).toBe(true)
    expect(intervals.some((i) => i.project === '' && i.note === '')).toBe(true)
    expect(intervals.every((i) => !i.declared || i.taskId !== null)).toBe(true)
    expect(new Set(intervals.map((i) => i.id)).size).toBe(intervals.length)

    const parsed = parseBackup(JSON.stringify(buildBackup(data, wednesday, 'hml')))
    expect(parsed.ok).toBe(true)
  })

  it('mostra excedente e falta: um dia útil com mais de 8h e outro com menos', () => {
    const { intervals } = buildDemoData(wednesday)
    const worked = ['2026-11-09', '2026-11-10', '2026-11-12', '2026-11-13'].map((d) =>
      workedMinutes(intervals, d, wednesday),
    )
    expect(worked.some((m) => m > 480)).toBe(true)
    expect(worked.some((m) => m < 480)).toBe(true)
    // Sábado da semana anterior com horas.
    expect(workedMinutes(intervals, '2026-11-14', wednesday)).toBe(120)
  })

  it('na segunda cedo, a semana atual fica vazia e a anterior completa (CA7)', () => {
    const now = new Date(at('2026-11-16 07:00'))
    const { intervals } = buildDemoData(now)
    expect(intervals.filter((i) => i.start >= at('2026-11-16 00:00'))).toEqual([])
    expect(intervals.some((i) => dayKey(i.start) === '2026-11-13')).toBe(true)
    expect(intervals.every((i) => i.end !== null)).toBe(true)
    expect(irregularDays(now)).toEqual(['2026-11-12'])
  })

  it('no domingo à noite, a semana atual tem todos os dias úteis e nenhum intervalo aberto (CA7)', () => {
    const now = new Date(at('2026-11-22 20:00'))
    const { intervals } = buildDemoData(now)
    for (const day of ['2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19', '2026-11-20']) {
      expect(workedMinutes(intervals, day, now)).toBeGreaterThan(0)
    }
    expect(intervals.some((i) => dayKey(i.start) === '2026-11-21' || dayKey(i.start) === '2026-11-22')).toBe(false)
    expect(intervals.every((i) => i.end !== null)).toBe(true)
    expect(irregularDays(now)).toEqual(['2026-11-12'])
  })

  it('entre 08:00 e 08:30, hoje tem só o intervalo aberto desde as 08:00', () => {
    const now = new Date(at('2026-11-17 08:20'))
    const today = buildDemoData(now).intervals.filter((i) => dayKey(i.start) === '2026-11-17')
    expect(today).toHaveLength(1)
    expect(today[0]).toMatchObject({ start: at('2026-11-17 08:00'), end: null })
  })
})
