import { describe, expect, it } from 'vitest'
import { docVersion, isNewer, parseRecordKey, planFirstSync, recordKey } from './sync'

describe('chaves', () => {
  it('monta e lê a chave de um registro', () => {
    expect(recordKey('intervals', 'abc')).toBe('intervals/abc')
    expect(parseRecordKey('daysOff/2026-11-15')).toEqual({ collection: 'daysOff', id: '2026-11-15' })
  })

  it('recusa chave desconhecida', () => {
    expect(parseRecordKey('outra/1')).toBeNull()
    expect(parseRecordKey('intervals/')).toBeNull()
    expect(parseRecordKey('semBarra')).toBeNull()
  })
})

describe('conflito: última gravação vence', () => {
  it('CA4: a versão mais nova vence; empate não muda nada', () => {
    const mac = '2026-11-15T13:00:00.000Z'
    const android = '2026-11-15T13:05:00.000Z'
    expect(isNewer(android, mac)).toBe(true)
    expect(isNewer(mac, android)).toBe(false)
    expect(isNewer(mac, mac)).toBe(false)
    expect(isNewer(mac, null)).toBe(true)
  })

  it('apagar conta pela data do apagar', () => {
    expect(docVersion({ updatedAt: '2026-11-15T10:00:00.000Z', deletedAt: '2026-11-15T11:00:00.000Z' })).toBe(
      '2026-11-15T11:00:00.000Z',
    )
    expect(docVersion({ updatedAt: '2026-11-15T10:00:00.000Z', deletedAt: null })).toBe('2026-11-15T10:00:00.000Z')
  })
})

describe('primeiro login', () => {
  const base = { deviceUid: null, accountUid: 'a', localCount: 0, remoteCount: 0 }

  it('R12: só o aparelho tem dados, sobem', () => {
    expect(planFirstSync({ ...base, localCount: 20 })).toBe('upload')
  })

  it('R13: só a nuvem tem dados, descem', () => {
    expect(planFirstSync({ ...base, remoteCount: 20 })).toBe('download')
  })

  it('R14: os dois têm dados, pergunta', () => {
    expect(planFirstSync({ ...base, localCount: 1, remoteCount: 1 })).toBe('ask')
  })

  it('nenhum lado tem dados: liga sem perguntar', () => {
    expect(planFirstSync(base)).toBe('upload')
  })

  it('mesma conta de antes segue normalmente', () => {
    expect(planFirstSync({ ...base, deviceUid: 'a', localCount: 5, remoteCount: 5 })).toBe('resume')
  })

  it('R15: aparelho ligado a outra conta pede confirmação', () => {
    expect(planFirstSync({ ...base, deviceUid: 'b', localCount: 5 })).toBe('other-account')
  })
})
