import { describe, expect, it } from 'vitest'
import { authErrorMessage, describeSyncStatus, providerFromFirebaseId } from './account'

describe('erros do login', () => {
  it('fechar a janela não mostra nada', () => {
    expect(authErrorMessage('auth/popup-closed-by-user')).toBeNull()
    expect(authErrorMessage('auth/cancelled-popup-request')).toBeNull()
  })

  it('explica os erros conhecidos', () => {
    expect(authErrorMessage('auth/popup-blocked')).toMatch(/pop-ups/)
    expect(authErrorMessage('auth/credential-already-in-use', 'microsoft')).toMatch(/Microsoft já entrou/)
    expect(authErrorMessage('auth/unauthorized-domain')).toMatch(/Domínios autorizados/)
  })

  it('erro desconhecido mostra o código', () => {
    expect(authErrorMessage('auth/xyz')).toBe('Não foi possível entrar (auth/xyz). Tente de novo.')
  })
})

describe('provedores', () => {
  it('lê o id do Firebase', () => {
    expect(providerFromFirebaseId('google.com')).toBe('google')
    expect(providerFromFirebaseId('microsoft.com')).toBe('microsoft')
    expect(providerFromFirebaseId('password')).toBeNull()
  })
})

describe('estado da sincronização (R10)', () => {
  const base = { running: false, online: true, pending: 0, lastSyncAt: null, lastError: null }

  it('mostra a hora do último ciclo', () => {
    const at = new Date(2026, 10, 21, 14, 32).toISOString()
    expect(describeSyncStatus({ ...base, lastSyncAt: at })).toEqual({ kind: 'ok', text: 'Sincronizado às 14:32.' })
  })

  it('sincronizando, sem internet com pendências e erro', () => {
    expect(describeSyncStatus({ ...base, running: true }).text).toBe('Sincronizando…')
    expect(describeSyncStatus({ ...base, online: false, pending: 3 }).text).toBe('Sem internet: 3 alterações esperando.')
    expect(describeSyncStatus({ ...base, online: false, pending: 1 }).text).toBe('Sem internet: 1 alteração esperando.')
    expect(describeSyncStatus({ ...base, lastError: 'falhou' })).toEqual({
      kind: 'error',
      text: 'Erro na última sincronização: falhou',
    })
  })
})
