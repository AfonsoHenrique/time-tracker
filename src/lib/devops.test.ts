import { describe, expect, it } from 'vitest'
import {
  digitsOnly,
  formatDevOpsRefs,
  isDevOpsId,
  normalizeNote,
  normalizeProject,
  parseDevOpsId,
  withDevOpsDefaults,
} from './devops'
import { at } from './test-helpers'

describe('parseDevOpsId', () => {
  it('vazio vira null', () => {
    expect(parseDevOpsId('')).toEqual({ ok: true, value: null })
    expect(parseDevOpsId('   ')).toEqual({ ok: true, value: null })
  })

  it('aceita o número, com # na frente e espaços nas pontas', () => {
    expect(parseDevOpsId('123567')).toEqual({ ok: true, value: 123567 })
    expect(parseDevOpsId(' #123568 ')).toEqual({ ok: true, value: 123568 })
  })

  it('recusa texto, decimal, negativo, zero e número grande demais', () => {
    for (const text of ['abc', '12.5', '-3', '0', '1e5', '2147483648', '12 34']) {
      expect(parseDevOpsId(text)).toEqual({ ok: false })
    }
  })
})

describe('isDevOpsId', () => {
  it('só inteiros positivos de 32 bits', () => {
    expect(isDevOpsId(1)).toBe(true)
    expect(isDevOpsId(2_147_483_647)).toBe(true)
    expect(isDevOpsId(0)).toBe(false)
    expect(isDevOpsId(1.5)).toBe(false)
    expect(isDevOpsId('123')).toBe(false)
    expect(isDevOpsId(null)).toBe(false)
  })
})

describe('withDevOpsDefaults', () => {
  const old = {
    id: 'a',
    start: at('2026-11-09 08:00'),
    end: at('2026-11-09 12:00'),
    note: 'daily',
    createdAt: at('2026-11-09 08:00'),
    updatedAt: at('2026-11-09 12:00'),
  }

  it('spec 005 CA4: intervalo antigo fica sem work item, sem task e não declarado', () => {
    expect(withDevOpsDefaults(old)).toEqual({
      ...old,
      workItemId: null,
      taskId: null,
      declared: false,
      project: '',
    })
  })

  it('mantém os campos que já existem e descarta valores inválidos', () => {
    expect(withDevOpsDefaults({ ...old, workItemId: 123567, taskId: 123568, declared: true })).toMatchObject({
      workItemId: 123567,
      taskId: 123568,
      declared: true,
    })
    expect(withDevOpsDefaults({ ...old, workItemId: '123', taskId: -1, declared: 'sim' })).toMatchObject({
      workItemId: null,
      taskId: null,
      declared: false,
    })
  })
})

describe('formatDevOpsRefs', () => {
  it('mostra o que estiver preenchido', () => {
    expect(formatDevOpsRefs({ workItemId: 123567, taskId: 123568 })).toBe('WI 123567 · Task 123568')
    expect(formatDevOpsRefs({ workItemId: 123567, taskId: null })).toBe('WI 123567')
    expect(formatDevOpsRefs({ workItemId: null, taskId: 123568 })).toBe('Task 123568')
    expect(formatDevOpsRefs({ workItemId: null, taskId: null })).toBe('')
  })
})

describe('normalizeProject (spec 007)', () => {
  it('tira os espaços das pontas e aceita até 15 caracteres', () => {
    expect(normalizeProject('  Equipe IA ')).toEqual({ ok: true, value: 'Equipe IA' })
    expect(normalizeProject('')).toEqual({ ok: true, value: '' })
    expect(normalizeProject('a'.repeat(15))).toEqual({ ok: true, value: 'a'.repeat(15) })
  })

  it('CA2: recusa mais de 15 caracteres', () => {
    expect(normalizeProject('a'.repeat(16))).toEqual({ ok: false })
  })
})

describe('withDevOpsDefaults e projeto (spec 007)', () => {
  const base = {
    id: 'a',
    start: at('2026-11-09 08:00'),
    end: null,
    note: '',
    createdAt: at('2026-11-09 08:00'),
    updatedAt: at('2026-11-09 08:00'),
  }

  it('mantém o projeto, corta o longo demais e descarta o que não é texto', () => {
    expect(withDevOpsDefaults({ ...base, project: ' Equipe IA ' }).project).toBe('Equipe IA')
    expect(withDevOpsDefaults({ ...base, project: 'x'.repeat(20) }).project).toBe('x'.repeat(15))
    expect(withDevOpsDefaults({ ...base, project: 42 }).project).toBe('')
  })
})

describe('digitsOnly (spec 012)', () => {
  it('CA5: tira o que não é dígito e corta em 10', () => {
    expect(digitsOnly('#123 567a')).toBe('123567')
    expect(digitsOnly('abc')).toBe('')
    expect(digitsOnly('12345678901')).toBe('1234567890')
    expect(digitsOnly('')).toBe('')
  })
})

describe('normalizeNote (spec 012)', () => {
  it('aceita até 200 caracteres sem contar os espaços nas pontas', () => {
    expect(normalizeNote(`  ${'a'.repeat(200)}  `)).toEqual({ ok: true, value: 'a'.repeat(200) })
    expect(normalizeNote('a'.repeat(201))).toEqual({ ok: false })
  })

  it('uma observação antiga maior que não mudou continua valendo', () => {
    const old = 'a'.repeat(250)
    expect(normalizeNote(old, old)).toEqual({ ok: true, value: old })
    expect(normalizeNote(` ${old} `, old)).toEqual({ ok: true, value: old })
    expect(normalizeNote(`${old}b`, old)).toEqual({ ok: false })
  })
})
