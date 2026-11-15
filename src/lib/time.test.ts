import { describe, expect, it } from 'vitest'
import { dayKey, daysInRange, isWorkDay, periodRange, weekRange } from './time'
import { DEFAULT_SETTINGS } from './types'
import { at } from './test-helpers'

describe('weekRange', () => {
  it('CA7: a semana de um domingo vai da segunda anterior até ele', () => {
    expect(weekRange('2026-11-08')).toEqual({ start: '2026-11-02', end: '2026-11-08' })
  })

  it('uma segunda abre a própria semana', () => {
    expect(weekRange('2026-11-09')).toEqual({ start: '2026-11-09', end: '2026-11-15' })
  })

  it('atravessa a virada de mês e de ano', () => {
    expect(weekRange('2026-12-31')).toEqual({ start: '2026-12-28', end: '2027-01-03' })
  })
})

describe('periodRange', () => {
  it('CA6: dia 8 pertence ao período que começou no dia 26 do mês anterior', () => {
    expect(periodRange('2026-11-08', 26)).toEqual({ start: '2026-10-26', end: '2026-11-25' })
  })

  it('CA6: dia 26 abre um período novo', () => {
    expect(periodRange('2026-11-26', 26)).toEqual({ start: '2026-11-26', end: '2026-12-25' })
  })

  it('dia 25 ainda é do período anterior', () => {
    expect(periodRange('2026-11-25', 26)).toEqual({ start: '2026-10-26', end: '2026-11-25' })
  })

  it('vira o ano', () => {
    expect(periodRange('2026-12-30', 26)).toEqual({ start: '2026-12-26', end: '2027-01-25' })
    expect(periodRange('2027-01-10', 26)).toEqual({ start: '2026-12-26', end: '2027-01-25' })
  })

  it('fevereiro não quebra', () => {
    expect(periodRange('2027-02-10', 26)).toEqual({ start: '2027-01-26', end: '2027-02-25' })
  })

  it('período começando no dia 1 é o mês', () => {
    expect(periodRange('2026-11-08', 1)).toEqual({ start: '2026-11-01', end: '2026-11-30' })
  })
})

describe('dayKey e daysInRange', () => {
  it('converte um instante para o dia local', () => {
    expect(dayKey(at('2026-11-09 23:30'))).toBe('2026-11-09')
    expect(dayKey(at('2026-11-09 00:15'))).toBe('2026-11-09')
  })

  it('devolve igual uma chave de dia', () => {
    expect(dayKey('2026-11-09')).toBe('2026-11-09')
  })

  it('lista os dias do intervalo, incluindo as pontas', () => {
    expect(daysInRange({ start: '2026-11-08', end: '2026-11-10' })).toEqual(['2026-11-08', '2026-11-09', '2026-11-10'])
  })
})

describe('isWorkDay', () => {
  it('segunda a sexta são úteis; sábado e domingo não', () => {
    expect(isWorkDay('2026-11-09', DEFAULT_SETTINGS)).toBe(true)
    expect(isWorkDay('2026-11-13', DEFAULT_SETTINGS)).toBe(true)
    expect(isWorkDay('2026-11-07', DEFAULT_SETTINGS)).toBe(false)
    expect(isWorkDay('2026-11-08', DEFAULT_SETTINGS)).toBe(false)
  })
})
