import { describe, expect, it } from 'vitest'
import { describeIrregularity, findIrregularities, isIrregularDay, type IrregularityKind } from './irregular'
import { iv } from './test-helpers'

const now = new Date('2026-11-13T09:00')

describe('findIrregularities', () => {
  it('CA8: intervalo aberto em dia anterior', () => {
    const intervals = [iv('2026-11-12 08:00')]
    expect(findIrregularities({ date: '2026-11-12', intervals, target: 480, now })).toContain('open-past')
  })

  it('intervalo aberto hoje é normal', () => {
    const intervals = [iv('2026-11-13 08:00')]
    expect(findIrregularities({ date: '2026-11-13', intervals, target: 480, now })).toEqual([])
  })

  it('CA8: intervalo com mais de 12h', () => {
    const intervals = [iv('2026-11-12 06:00', '2026-11-12 18:01')]
    expect(findIrregularities({ date: '2026-11-12', intervals, target: 480, now })).toEqual(['too-long'])
  })

  it('exatamente 12h ainda é aceito', () => {
    const intervals = [iv('2026-11-12 06:00', '2026-11-12 18:00')]
    expect(findIrregularities({ date: '2026-11-12', intervals, target: 480, now })).toEqual([])
  })

  it('CA8: intervalo que passa da meia-noite', () => {
    const intervals = [iv('2026-11-11 22:00', '2026-11-12 01:00')]
    expect(findIrregularities({ date: '2026-11-11', intervals, target: 480, now })).toEqual(['crosses-midnight'])
  })

  it('CA8: intervalos sobrepostos', () => {
    const intervals = [iv('2026-11-12 08:00', '2026-11-12 12:00'), iv('2026-11-12 11:30', '2026-11-12 15:00')]
    expect(findIrregularities({ date: '2026-11-12', intervals, target: 480, now })).toEqual(['overlap'])
  })

  it('intervalos que se encostam não se sobrepõem', () => {
    const intervals = [iv('2026-11-12 08:00', '2026-11-12 12:00'), iv('2026-11-12 12:00', '2026-11-12 17:00')]
    expect(findIrregularities({ date: '2026-11-12', intervals, target: 480, now })).toEqual([])
  })

  it('CA8: dia útil passado com 0h', () => {
    expect(findIrregularities({ date: '2026-11-12', intervals: [], target: 480, now })).toEqual(['empty-workday'])
  })

  it('dia sem meta, fim de semana e dia de hoje sem horas não são irregulares', () => {
    expect(findIrregularities({ date: '2026-11-12', intervals: [], target: 0, now })).toEqual([])
    expect(findIrregularities({ date: '2026-11-13', intervals: [], target: 480, now })).toEqual([])
  })

  it('CA8: dia útil com 4h não é irregular', () => {
    const intervals = [iv('2026-11-12 09:00', '2026-11-12 13:00')]
    expect(findIrregularities({ date: '2026-11-12', intervals, target: 480, now })).toEqual([])
  })

  it('junta vários problemas, sem repetir e na mesma ordem', () => {
    const intervals = [iv('2026-11-11 08:00'), iv('2026-11-11 09:00', '2026-11-11 10:00')]
    expect(findIrregularities({ date: '2026-11-11', intervals, target: 480, now })).toEqual([
      'open-past',
      'too-long',
      'overlap',
    ])
  })
})

describe('describeIrregularity', () => {
  it('tem um texto para cada tipo', () => {
    const kinds: IrregularityKind[] = ['open-past', 'too-long', 'crosses-midnight', 'overlap', 'empty-workday']
    const texts = kinds.map(describeIrregularity)
    expect(texts.every((text) => text.length > 0)).toBe(true)
    expect(new Set(texts).size).toBe(kinds.length)
    expect(describeIrregularity('open-past')).toBe('Intervalo aberto de um dia anterior: falta bater a saída.')
  })
})

describe('isIrregularDay', () => {
  it('olha só os intervalos do dia', () => {
    const intervals = [iv('2026-11-09 08:00', '2026-11-09 12:00'), iv('2026-11-10 08:00', '2026-11-10 12:00'), iv('2026-11-10 11:00', '2026-11-10 13:00')]
    expect(isIrregularDay({ date: '2026-11-09', target: 480 }, intervals, now)).toBe(false)
    expect(isIrregularDay({ date: '2026-11-10', target: 480 }, intervals, now)).toBe(true)
  })
})
