/**
 * Conta e sincronização do aparelho (spec 008): entrar, primeiro login, vincular, sair e o
 * estado que a aba Dados mostra. Não usa React; as telas leem pelo `useAccount`.
 */
import { getRepository, type Repository } from '../db/repository'
import { authErrorMessage, type ProviderId } from '../lib/account'
import { dayKey } from '../lib/time'
import { startAutoSync, SYNCED_EVENT } from './autoSync'
import { createSyncEngine, type LinkMode, type SyncEngine } from './engine'
import type { AccountUser } from './firebase'
import type { RemoteStore } from './remote'

/** O que a sessão precisa do Firebase. A implementação real fica em `firebase.ts`. */
export interface AuthApi {
  currentUser(): Promise<AccountUser | null>
  signIn(provider: ProviderId): Promise<AccountUser>
  link(provider: ProviderId): Promise<AccountUser>
  signOut(): Promise<void>
  remote(uid: string): RemoteStore
}

/** Resumo dos dados do aparelho para a escolha do primeiro login (R14). */
export interface LocalSummary {
  intervals: number
  daysOff: number
  firstDay: string | null
  lastDay: string | null
}

export interface SyncStatus {
  running: boolean
  online: boolean
  pending: number
  lastSyncAt: string | null
  lastError: string | null
}

export type AccountState =
  /** Sem conta: o app funciona só no aparelho e o Firebase nem é carregado (R2, CA1). */
  | { phase: 'off' }
  | { phase: 'loading' }
  /** O aparelho sincronizava, mas a sessão acabou: precisa entrar de novo. */
  | { phase: 'expired' }
  /** Primeiro login com dados nos dois lados, ou com outra conta: a tela pergunta (R14, R15). */
  | { phase: 'choosing'; user: AccountUser; otherAccount: boolean; local: LocalSummary; remoteCount: number }
  | { phase: 'linked'; user: AccountUser; sync: SyncStatus }

export interface SessionOptions {
  repo: Repository
  loadAuth: () => Promise<AuthApi>
  /** Para os testes; padrão: `navigator.onLine` e os eventos da `window`. */
  isOnline?: () => boolean
  /** Para os testes; padrão: `startAutoSync` com `window` e `document`. */
  startAuto?: (engine: SyncEngine) => () => void
  /** Avisa as telas que dados vieram de outro aparelho. */
  notifyRemoteChange?: () => void
}

export type ActionResult = { ok: true } | { ok: false; error: string | null }

const errorCode = (error: unknown) =>
  typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : undefined

export function createAccountSession({
  repo,
  loadAuth,
  isOnline = () => (typeof navigator === 'undefined' ? true : navigator.onLine),
  startAuto,
  notifyRemoteChange = () => window.dispatchEvent(new Event(SYNCED_EVENT)),
}: SessionOptions) {
  let state: AccountState = { phase: 'off' }
  const listeners = new Set<() => void>()
  let auth: AuthApi | null = null
  let engine: SyncEngine | null = null
  let stopAuto: (() => void) | null = null
  let stopLocal: (() => void) | null = null
  let running = false

  function set(next: AccountState) {
    state = next
    listeners.forEach((listener) => listener())
  }

  async function getAuth(): Promise<AuthApi> {
    auth ??= await loadAuth()
    return auth
  }

  function engineFor(user: AccountUser): SyncEngine {
    const base = createSyncEngine({ repo, remote: auth!.remote(user.uid), onRemoteChange: notifyRemoteChange })
    // Guarda quando um ciclo está rodando, para a tela mostrar "Sincronizando…".
    return {
      ...base,
      async sync() {
        running = true
        void refresh()
        try {
          return await base.sync()
        } finally {
          running = false
          await refresh()
        }
      },
    }
  }

  async function refresh() {
    if (state.phase !== 'linked') return
    const [saved, pending] = await Promise.all([repo.sync.getState(), repo.sync.pendingCount()])
    if (state.phase !== 'linked') return
    set({
      ...state,
      sync: { running, online: isOnline(), pending, lastSyncAt: saved.lastSyncAt, lastError: saved.lastError },
    })
  }

  function stop() {
    stopAuto?.()
    stopLocal?.()
    stopAuto = stopLocal = null
    engine = null
  }

  /** Liga a sincronização automática para a conta já ligada a este aparelho. */
  async function activate(user: AccountUser) {
    stop()
    engine = engineFor(user)
    set({ phase: 'linked', user, sync: { running: false, online: isOnline(), pending: 0, lastSyncAt: null, lastError: null } })
    stopLocal = repo.onLocalChange(() => void refresh())
    const current = engine
    stopAuto = startAuto ? startAuto(current) : startAutoSync({ engine: current, repo })
    await refresh()
  }

  async function localSummary(): Promise<LocalSummary> {
    const data = await repo.exportAll()
    const days = data.intervals.map((interval) => dayKey(interval.start)).sort()
    return {
      intervals: data.intervals.length,
      daysOff: data.daysOff.length,
      firstDay: days[0] ?? null,
      lastDay: days[days.length - 1] ?? null,
    }
  }

  /** Liga o aparelho à conta conforme o plano do primeiro login (R12 a R15). */
  async function connect(user: AccountUser) {
    const preview = createSyncEngine({ repo, remote: auth!.remote(user.uid) })
    const plan = await preview.plan(user.uid)
    if (plan === 'ask' || plan === 'other-account') {
      const [local, remoteCount] = await Promise.all([localSummary(), auth!.remote(user.uid).countRecords()])
      set({ phase: 'choosing', user, otherAccount: plan === 'other-account', local, remoteCount })
      return
    }
    if (plan === 'upload') await preview.link(user.uid, 'upload')
    if (plan === 'download') await preview.link(user.uid, 'cloud-only')
    await activate(user)
  }

  return {
    getState: () => state,

    subscribe(listener: () => void): () => void {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },

    /**
     * Ao abrir o app: se o aparelho já sincroniza com uma conta, carrega o Firebase e retoma.
     * Sem conta ligada, não faz nada (o Firebase nem é baixado).
     */
    async init(): Promise<void> {
      const saved = await repo.sync.getState()
      if (saved.uid === null) return set({ phase: 'off' })
      set({ phase: 'loading' })
      try {
        const api = await getAuth()
        const user = await api.currentUser()
        if (user && user.uid === saved.uid) await activate(user)
        else set({ phase: 'expired' })
      } catch (error) {
        console.error(error)
        set({ phase: 'expired' })
      }
    },

    async signIn(provider: ProviderId): Promise<ActionResult> {
      const before = state
      try {
        const api = await getAuth()
        const user = await api.signIn(provider)
        set({ phase: 'loading' })
        await connect(user)
        return { ok: true }
      } catch (error) {
        console.error(error)
        set(before.phase === 'loading' ? { phase: 'off' } : before)
        return { ok: false, error: authErrorMessage(errorCode(error), provider) }
      }
    },

    /** Resposta da escolha do primeiro login: juntar ou usar só os dados da nuvem. */
    async choose(mode: Exclude<LinkMode, 'upload'>): Promise<ActionResult> {
      if (state.phase !== 'choosing') return { ok: false, error: null }
      const { user } = state
      try {
        set({ phase: 'loading' })
        await createSyncEngine({ repo, remote: auth!.remote(user.uid) }).link(user.uid, mode)
        await activate(user)
        return { ok: true }
      } catch (error) {
        console.error(error)
        await auth?.signOut().catch(() => undefined)
        set({ phase: 'off' })
        return { ok: false, error: 'Não foi possível ligar a sincronização. Nada foi apagado. Tente de novo.' }
      }
    },

    /** Cancelar a escolha: sai da conta e não muda nada em nenhum lado (CA8). */
    async cancel(): Promise<void> {
      await auth?.signOut().catch(() => undefined)
      const saved = await repo.sync.getState()
      set(saved.uid === null ? { phase: 'off' } : { phase: 'expired' })
    },

    async link(provider: ProviderId): Promise<ActionResult> {
      if (state.phase !== 'linked') return { ok: false, error: null }
      try {
        const user = await (await getAuth()).link(provider)
        if (state.phase === 'linked') set({ ...state, user })
        return { ok: true }
      } catch (error) {
        console.error(error)
        return { ok: false, error: authErrorMessage(errorCode(error), provider) }
      }
    },

    /** Sai da conta: para a sincronização e mantém os dados no aparelho (R16). */
    async signOut(): Promise<void> {
      stop()
      await repo.sync.setState({ uid: null, lastPulledAt: null, lastSyncAt: null, lastError: null })
      await auth?.signOut().catch(() => undefined)
      set({ phase: 'off' })
    },

    async syncNow(): Promise<void> {
      await engine?.sync()
    },

    /** Alterações que ainda não subiram, para o aviso antes de sair. */
    pendingCount: () => repo.sync.pendingCount(),
  }
}

export type AccountSession = ReturnType<typeof createAccountSession>

let shared: AccountSession | undefined

/** Sessão do app, sobre o repositório do ambiente. O Firebase só carrega quando precisa. */
export function getAccountSession(): AccountSession {
  if (!shared) {
    shared = createAccountSession({
      repo: getRepository(),
      loadAuth: async () => (await import('./firebase')).createFirebase(),
    })
  }
  return shared
}
