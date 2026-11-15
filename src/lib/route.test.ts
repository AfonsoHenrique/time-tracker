import { describe, expect, it } from 'vitest'
import { HOME, parseRoute, routeHash } from './route'

describe('parseRoute', () => {
  it('lê tela e dia', () => {
    expect(parseRoute('#/hoje/2026-11-09')).toEqual({ screen: 'today', day: '2026-11-09' })
    expect(parseRoute('#/semana/2026-11-04')).toEqual({ screen: 'week', day: '2026-11-04' })
    expect(parseRoute('#/periodo/2026-11-10')).toEqual({ screen: 'period', day: '2026-11-10' })
  })

  it('sem dia segue hoje ou a semana atual', () => {
    expect(parseRoute('#/semana')).toEqual({ screen: 'week', day: null })
    expect(parseRoute('#/hoje/')).toEqual({ screen: 'today', day: null })
  })

  it('hash vazio ou tela desconhecida abre Hoje', () => {
    expect(parseRoute('')).toEqual(HOME)
    expect(parseRoute('#')).toEqual(HOME)
    expect(parseRoute('#/outra/2026-11-09')).toEqual(HOME)
  })

  it('data inválida vira nula (CA6)', () => {
    expect(parseRoute('#/semana/2026-13-40')).toEqual({ screen: 'week', day: null })
    expect(parseRoute('#/semana/ontem')).toEqual({ screen: 'week', day: null })
  })
})

describe('routeHash', () => {
  it('é o inverso de parseRoute', () => {
    expect(routeHash({ screen: 'today', day: null })).toBe('#/hoje')
    expect(routeHash({ screen: 'week', day: '2026-11-02' })).toBe('#/semana/2026-11-02')
    for (const hash of ['#/hoje', '#/hoje/2026-11-09', '#/semana', '#/semana/2026-11-02', '#/periodo']) {
      expect(routeHash(parseRoute(hash))).toBe(hash)
    }
  })
})
