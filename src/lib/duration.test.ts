import { describe, expect, it } from 'vitest'
import { formatDuration } from './duration'

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
