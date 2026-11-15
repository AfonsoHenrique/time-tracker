import { describe, expect, it } from 'vitest'
import { forecastDayEnd } from './forecast'
import { formatTime } from './clock'
import { at, iv } from './test-helpers'
import type { Interval } from './types'

const DAY = '2026-11-09' // segunda
const TARGET = 8 * 60

function run(intervals: Interval[], now: string, target = TARGET, date = DAY) {
  return forecastDayEnd({ date, intervals, target, now: new Date(at(now)) })
}

function expectForecast(result: ReturnType<typeof run>, exit: string, lunch: number, returnBy: string | null = null) {
  expect(result.kind).toBe('forecast')
  if (result.kind !== 'forecast') return
  expect(formatTime(result.at.toISOString())).toBe(exit)
  expect(result.lunchMinutes).toBe(lunch)
  expect(result.returnBy === null ? null : formatTime(result.returnBy.toISOString())).toBe(returnBy)
}

describe('forecastDayEnd', () => {
  it('CA1: entrada 08:32, dentro às 09:00, prevê 17:32 com almoço', () => {
    expectForecast(run([iv(`${DAY} 08:32`)], `${DAY} 09:00`), '17:32', 60)
  })

  it('a previsão fica parada enquanto se trabalha', () => {
    expectForecast(run([iv(`${DAY} 08:32`)], `${DAY} 11:47`), '17:32', 60)
  })

  it('CA2: fora no almoço, prevê 17:00 e diz até quando voltar', () => {
    expectForecast(run([iv(`${DAY} 08:00`, `${DAY} 12:00`)], `${DAY} 12:20`), '17:00', 40, '13:00')
  })

  it('pausa que passou de 1h não reserva mais almoço e a previsão anda', () => {
    expectForecast(run([iv(`${DAY} 08:00`, `${DAY} 12:00`)], `${DAY} 13:15`), '17:15', 0)
  })

  it('CA3: almoço feito, prevê 17:32 sem almoço', () => {
    const intervals = [iv(`${DAY} 08:32`, `${DAY} 12:32`), iv(`${DAY} 13:32`)]
    expectForecast(run(intervals, `${DAY} 14:00`), '17:32', 0)
  })

  it('CA4: pausa curta não conta como almoço', () => {
    const intervals = [iv(`${DAY} 08:00`, `${DAY} 10:00`), iv(`${DAY} 10:10`)]
    expectForecast(run(intervals, `${DAY} 11:00`), '17:10', 60)
  })

  it('fora numa pausa curta, a pausa começa a contar como almoço', () => {
    expectForecast(run([iv(`${DAY} 08:00`, `${DAY} 10:00`)], `${DAY} 10:05`), '17:00', 55, '11:00')
  })

  it('CA5: sem pausa e depois das 14:00, não reserva almoço', () => {
    expectForecast(run([iv(`${DAY} 08:00`)], `${DAY} 14:30`), '16:00', 0)
  })

  it('pausa que começou antes das 14:00 continua contando como almoço depois delas', () => {
    expectForecast(run([iv(`${DAY} 08:00`, `${DAY} 13:50`)], `${DAY} 14:10`), '17:00', 40, '14:50')
  })

  it('CA6: primeira entrada depois do meio-dia, sem almoço', () => {
    expectForecast(run([iv(`${DAY} 13:00`)], `${DAY} 13:30`), '21:00', 0)
  })

  it('CA7: meta cumprida mostra o minuto em que fechou', () => {
    const intervals = [iv(`${DAY} 08:00`, `${DAY} 12:00`), iv(`${DAY} 13:00`, `${DAY} 17:10`)]
    const result = run(intervals, `${DAY} 18:00`)
    expect(result.kind).toBe('done')
    if (result.kind === 'done') expect(formatTime(result.at.toISOString())).toBe('17:00')
  })

  it('meta cumprida com intervalo aberto também fecha no minuto certo', () => {
    const result = run([iv(`${DAY} 08:00`)], `${DAY} 16:30`)
    expect(result.kind).toBe('done')
    if (result.kind === 'done') expect(formatTime(result.at.toISOString())).toBe('16:00')
  })

  it('CA8: sem meta ou sem intervalo, não há previsão', () => {
    expect(run([iv(`${DAY} 08:00`)], `${DAY} 09:00`, 0).kind).toBe('none')
    expect(run([], `${DAY} 09:00`).kind).toBe('none')
  })

  it('CA9: outro dia que não hoje não tem previsão', () => {
    expect(run([iv(`${DAY} 08:00`, `${DAY} 12:00`)], '2026-11-10 09:00').kind).toBe('none')
  })

  it('intervalo aberto de outro dia tira a previsão', () => {
    const intervals = [iv('2026-11-08 22:00'), iv(`${DAY} 08:00`, `${DAY} 09:00`)]
    expect(run(intervals, `${DAY} 10:00`).kind).toBe('none')
  })

  it('ignora os segundos do relógio', () => {
    const now = new Date(new Date(at(`${DAY} 09:00`)).getTime() + 59_000)
    const result = forecastDayEnd({ date: DAY, intervals: [iv(`${DAY} 08:32`)], target: TARGET, now })
    expect(result.kind === 'forecast' && formatTime(result.at.toISOString())).toBe('17:32')
  })
})
