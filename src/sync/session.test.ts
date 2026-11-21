import { IDBFactory, IDBKeyRange } from 'fake-indexeddb'
import { describe, expect, it, vi } from 'vitest'
import { createRepository } from '../db/repository'
import { PontoDb } from '../db/schema'
import type { ProviderId } from '../lib/account'
import { at } from '../lib/test-helpers'
import { createMemoryRemote } from './memoryRemote'
import { createAccountSession, type AuthApi } from './session'

let n = 0

function setup(options: { signInError?: string; remote?: ReturnType<typeof createMemoryRemote>; uid?: string } = {}) {
  const repo = createRepository(new PontoDb(`sessao-${++n}`, { indexedDB: new IDBFactory(), IDBKeyRange }))
  const remote = options.remote ?? createMemoryRemote()
  const uid = options.uid ?? 'conta-a'
  let current: { uid: string; providers: ProviderId[] } | null = null
  const auth: AuthApi = {
    currentUser: vi.fn(async () => (current ? { ...current, name: 'Afonso', email: 'a@example.com' } : null)),
    signIn: vi.fn(async (provider: ProviderId) => {
      if (options.signInError) throw Object.assign(new Error('falhou'), { code: options.signInError })
      current = { uid, providers: [provider] }
      return { ...current, name: 'Afonso', email: 'a@example.com' }
    }),
    link: vi.fn(async (provider: ProviderId) => {
      current = { uid, providers: [...current!.providers, provider] }
      return { ...current, name: 'Afonso', email: 'a@example.com' }
    }),
    signOut: vi.fn(async () => {
      current = null
    }),
    remote: () => remote,
  }
  const loadAuth = vi.fn(async () => auth)
  const stopAuto = vi.fn()
  const startAuto = vi.fn(() => stopAuto)
  const session = createAccountSession({ repo, loadAuth, startAuto, isOnline: () => true, notifyRemoteChange: () => {} })
  return { repo, remote, auth, loadAuth, startAuto, stopAuto, session }
}

describe('sem login (CA1)', () => {
  it('abrir o app sem conta não carrega o Firebase', async () => {
    const { session, loadAuth } = setup()
    await session.init()
    expect(session.getState()).toEqual({ phase: 'off' })
    expect(loadAuth).not.toHaveBeenCalled()
  })
})

describe('primeiro login', () => {
  it('R12: com dados só no aparelho, sobe e liga a sincronização', async () => {
    const { session, repo, remote, startAuto } = setup()
    await repo.createInterval({ start: at('2026-11-09 08:00'), end: at('2026-11-09 09:00') })
    expect(await session.signIn('google')).toEqual({ ok: true })
    expect(session.getState()).toMatchObject({ phase: 'linked', user: { uid: 'conta-a', providers: ['google'] } })
    expect(await remote.countRecords()).toBe(1)
    expect((await repo.sync.getState()).uid).toBe('conta-a')
    expect(startAuto).toHaveBeenCalledTimes(1)
  })

  it('R14/CA8: com dados nos dois lados, pergunta; Juntar une', async () => {
    const remote = createMemoryRemote()
    const mac = setup({ remote })
    await mac.repo.createInterval({ start: at('2026-11-09 08:00'), end: at('2026-11-09 09:00') })
    await mac.session.signIn('google')

    const android = setup({ remote })
    await android.repo.createInterval({ start: at('2026-11-09 10:00'), end: at('2026-11-09 11:00') })
    await android.session.signIn('google')
    expect(android.session.getState()).toMatchObject({
      phase: 'choosing',
      otherAccount: false,
      local: { intervals: 1, firstDay: '2026-11-09', lastDay: '2026-11-09' },
      remoteCount: 1,
    })
    expect(await android.session.choose('merge')).toEqual({ ok: true })
    expect(await android.repo.listIntervals('2026-11-09', '2026-11-09')).toHaveLength(2)
  })

  it('CA8: Cancelar sai da conta e não muda nada', async () => {
    const remote = createMemoryRemote()
    const mac = setup({ remote })
    await mac.repo.createInterval({ start: at('2026-11-09 08:00'), end: at('2026-11-09 09:00') })
    await mac.session.signIn('google')

    const android = setup({ remote })
    await android.repo.createInterval({ start: at('2026-11-09 10:00'), end: at('2026-11-09 11:00') })
    await android.session.signIn('google')
    await android.session.cancel()
    expect(android.session.getState()).toEqual({ phase: 'off' })
    expect(android.auth.signOut).toHaveBeenCalled()
    expect(await remote.countRecords()).toBe(1)
    expect((await android.repo.sync.getState()).uid).toBeNull()
  })

  it('erro no login volta ao estado anterior com a mensagem', async () => {
    const { session } = setup({ signInError: 'auth/popup-blocked' })
    const result = await session.signIn('microsoft')
    expect(result).toMatchObject({ ok: false, error: expect.stringMatching(/pop-ups/) })
    expect(session.getState()).toEqual({ phase: 'off' })
  })

  it('fechar a janela de login não mostra erro', async () => {
    const { session } = setup({ signInError: 'auth/popup-closed-by-user' })
    expect(await session.signIn('google')).toEqual({ ok: false, error: null })
  })
})

describe('depois do login', () => {
  it('ao abrir o app de novo, retoma com a sessão guardada', async () => {
    const remote = createMemoryRemote()
    const first = setup({ remote })
    await first.session.signIn('google')

    // Mesmo banco e mesmo Firebase, sessão nova (app reaberto).
    const reopened = createAccountSession({
      repo: first.repo,
      loadAuth: async () => first.auth,
      startAuto: () => () => {},
      isOnline: () => true,
      notifyRemoteChange: () => {},
    })
    await reopened.init()
    expect(reopened.getState()).toMatchObject({ phase: 'linked', user: { uid: 'conta-a' } })
  })

  it('sem sessão guardada, pede para entrar de novo', async () => {
    const { session, repo } = setup()
    await repo.sync.setState({ uid: 'conta-a' })
    await session.init()
    expect(session.getState()).toEqual({ phase: 'expired' })
  })

  it('R4: vincular a Microsoft mantém a conta e mostra os dois provedores', async () => {
    const { session } = setup()
    await session.signIn('google')
    expect(await session.link('microsoft')).toEqual({ ok: true })
    expect(session.getState()).toMatchObject({ phase: 'linked', user: { providers: ['google', 'microsoft'] } })
  })

  it('o estado mostra as alterações esperando e a hora do último ciclo', async () => {
    const { session, repo } = setup()
    await session.signIn('google')
    await repo.createInterval({ start: at('2026-11-09 08:00'), end: at('2026-11-09 09:00') })
    await vi.waitFor(() => expect(session.getState()).toMatchObject({ sync: { pending: 1 } }))
    await session.syncNow()
    expect(session.getState()).toMatchObject({ sync: { pending: 0, running: false, lastSyncAt: expect.any(String) } })
  })

  it('R16: sair para a sincronização e mantém os dados', async () => {
    const { session, repo, stopAuto } = setup()
    await repo.createInterval({ start: at('2026-11-09 08:00'), end: at('2026-11-09 09:00') })
    await session.signIn('google')
    await session.signOut()
    expect(stopAuto).toHaveBeenCalled()
    expect(session.getState()).toEqual({ phase: 'off' })
    expect(await repo.listIntervals('2026-11-09', '2026-11-09')).toHaveLength(1)
    expect((await repo.sync.getState()).uid).toBeNull()
  })
})
