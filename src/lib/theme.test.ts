import { describe, expect, it } from 'vitest'
import html from '../../index.html?raw'
import { parseThemeChoice, THEME_KEY } from './theme'

describe('parseThemeChoice (spec 012)', () => {
  it('aceita claro e escuro e cai em sistema para o resto', () => {
    expect(parseThemeChoice('light')).toBe('light')
    expect(parseThemeChoice('dark')).toBe('dark')
    expect(parseThemeChoice('system')).toBe('system')
    expect(parseThemeChoice(null)).toBe('system')
    expect(parseThemeChoice('azul')).toBe('system')
  })

  it('o script do index.html usa a mesma chave', () => {
    expect(html).toContain(`localStorage.getItem('${THEME_KEY}')`)
  })
})
