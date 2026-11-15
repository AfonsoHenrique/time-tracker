import type { Repository } from '../db/repository'
import { planFirstSync, type FirstSyncPlan } from '../lib/sync'
import type { RemoteStore } from './remote'

/** Quantos documentos sobem por vez (limite de um lote do Firestore). */
export const PUSH_BATCH_SIZE = 500

export type SyncResult =
  | { ok: true; pushed: number; pulled: number; rejected: number }
  | { ok: false; error: string }

export interface SyncEngineOptions {
  repo: Repository
  remote: RemoteStore
  /** Relógio, para os testes. */
  now?: () => Date
  /**
   * Garante um ciclo por vez entre abas. Padrão: `navigator.locks`, quando existe.
   * Dentro da mesma aba os ciclos já ficam em fila.
   */
  lock?: <T>(run: () => Promise<T>) => Promise<T>
  /** Chamado quando um ciclo muda dados do aparelho, para as telas recarregarem. */
  onRemoteChange?: () => void
}

function defaultLock<T>(run: () => Promise<T>): Promise<T> {
  const locks = typeof navigator === 'undefined' ? undefined : navigator.locks
  return locks ? (locks.request('ponto-sync', run) as Promise<T>) : run()
}

/** Como o aparelho fica ligado a uma conta no primeiro login (spec 008, R12 a R15). */
export type LinkMode = 'upload' | 'merge' | 'cloud-only'

/**
 * Motor de sincronização: envia a fila do aparelho e depois recebe o que mudou na nuvem.
 * Conflitos se resolvem registro a registro pela última gravação (`lib/sync.ts`).
 */
export function createSyncEngine({ repo, remote, now = () => new Date(), lock = defaultLock, onRemoteChange }: SyncEngineOptions) {
  let queue: Promise<unknown> = Promise.resolve()

  async function cycle(): Promise<SyncResult> {
    try {
      const pending = await repo.sync.pending()
      for (let i = 0; i < pending.length; i += PUSH_BATCH_SIZE) {
        const batch = pending.slice(i, i + PUSH_BATCH_SIZE)
        await remote.push(batch)
        await repo.sync.markPushed(batch)
      }

      const state = await repo.sync.getState()
      const { docs, cursor } = await remote.pull(state.lastPulledAt)
      const applied = await repo.sync.applyRemote(docs)
      await repo.sync.setState({
        lastPulledAt: cursor ?? state.lastPulledAt,
        lastSyncAt: now().toISOString(),
        lastError: applied.rejected.length > 0 ? `${applied.rejected.length} registro(s) da nuvem recusado(s).` : null,
      })
      if (applied.applied > 0) onRemoteChange?.()
      return { ok: true, pushed: pending.length, pulled: applied.applied, rejected: applied.rejected.length }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      await repo.sync.setState({ lastError: message })
      return { ok: false, error: message }
    }
  }

  /** Roda um ciclo. Pedidos ao mesmo tempo esperam o anterior terminar. */
  function sync(): Promise<SyncResult> {
    const next = queue.then(() => lock(cycle))
    queue = next.catch(() => undefined)
    return next
  }

  return {
    sync,

    /** O que fazer quando a conta `uid` entra neste aparelho. */
    async plan(uid: string): Promise<FirstSyncPlan> {
      const [state, localCount, remoteCount] = await Promise.all([
        repo.sync.getState(),
        repo.sync.recordCount(),
        remote.countRecords(),
      ])
      return planFirstSync({ deviceUid: state.uid, accountUid: uid, localCount, remoteCount })
    },

    /**
     * Liga o aparelho à conta e sincroniza. `upload` e `merge` colocam tudo do aparelho na fila
     * (repetidos se resolvem pela última gravação); `cloud-only` descarta o aparelho e baixa a nuvem.
     */
    async link(uid: string, mode: LinkMode): Promise<SyncResult> {
      if (mode === 'cloud-only') await repo.sync.clearForDownload()
      else await repo.sync.enqueueAll()
      await repo.sync.setState({ uid, lastPulledAt: null, lastSyncAt: null, lastError: null })
      return sync()
    },

    /** Sai da conta: os dados ficam no aparelho e a sincronização para (R16). */
    async unlink(): Promise<void> {
      await repo.sync.setState({ uid: null, lastPulledAt: null, lastSyncAt: null, lastError: null })
    },
  }
}

export type SyncEngine = ReturnType<typeof createSyncEngine>
