import { describe, expect, it } from 'vitest'
import { formatDecimalHours, formatDuration, toDecimalHours } from './duration'

describe('formatDuration', () => {
  it('formata horas e minutos', () => {
    expect(formatDuration(285)).toBe('4:45')
    expect(formatDuration(480)).toBe('8:00')
    expect(formatDuration(5)).toBe('0:05')
  })

  it('mantém o sinal de valores negativos', () => {
    expect(formatDuration(-90)).toBe('-1:30')
  })
})

describe('toDecimalHours', () => {
  it('converte minutos para horas na escala de 100, com 2 casas (CA5)', () => {
    expect(toDecimalHours(30)).toBe(0.5)
    expect(toDecimalHours(45)).toBe(0.75)
    expect(toDecimalHours(35)).toBe(0.58)
    expect(toDecimalHours(90)).toBe(1.5)
    expect(toDecimalHours(120)).toBe(2)
    expect(toDecimalHours(1)).toBe(0.02)
    expect(toDecimalHours(0)).toBe(0)
  })

  it('arredonda para o centésimo mais próximo (CA6)', () => {
    expect(toDecimalHours(20)).toBe(0.33)
    expect(toDecimalHours(21)).toBe(0.35)
    expect(toDecimalHours(50)).toBe(0.83)
    expect(toDecimalHours(525)).toBe(8.75)
  })
})

describe('formatDecimalHours', () => {
  it('usa ponto, tira zeros à direita e põe " h"', () => {
    expect(formatDecimalHours(30)).toBe('0.5 h')
    expect(formatDecimalHours(45)).toBe('0.75 h')
    expect(formatDecimalHours(120)).toBe('2 h')
    expect(formatDecimalHours(0)).toBe('0 h')
  })
})
