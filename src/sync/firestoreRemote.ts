import {
  collection,
  doc,
  getCount,
  getDocs,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  Timestamp,
  where,
  type DocumentReference,
  type Firestore,
} from 'firebase/firestore/lite'
import type { AppEnv } from '../lib/env'
import { docVersion, isNewer, parseRecordKey, recordKey, SETTINGS_DOC_ID, type SyncCollection, type SyncDoc } from '../lib/sync'
import type { RemoteStore } from './remote'

/** Quantos documentos por transação (o Firestore aceita até 500 gravações). */
const TRANSACTION_SIZE = 400

/**
 * Margem do cursor de leitura. A hora do servidor de uma gravação pode ficar um pouco antes da
 * de outra que terminou antes; reler os últimos minutos é barato e não perde nada, porque o
 * que já está igual no aparelho é ignorado.
 */
const CURSOR_OVERLAP_MS = 2 * 60_000

/** Nome da coleção no Firestore: as configurações ficam em `meta/settings`. */
const REMOTE_COLLECTION: Record<SyncCollection, string> = {
  intervals: 'intervals',
  daysOff: 'daysOff',
  settings: 'meta',
}

interface RemoteEnvelope {
  data: unknown
  updatedAt: string
  deletedAt: string | null
  syncedAt: Timestamp
}

const isEnvelope = (value: unknown): value is RemoteEnvelope =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as RemoteEnvelope).updatedAt === 'string' &&
  (value as RemoteEnvelope).syncedAt instanceof Timestamp

/**
 * A nuvem do Ponto no Firestore: `users/{uid}/envs/{env}/{intervals|daysOff|meta}/{id}`.
 * Usa o Firestore lite (sem cache nem listener), porque o cache do app é o Dexie (ADR 0004).
 */
export function createFirestoreRemote(firestore: Firestore, uid: string, env: AppEnv): RemoteStore {
  const base = `users/${uid}/envs/${env}`

  function refFor(key: string): DocumentReference {
    const target = parseRecordKey(key)
    if (!target) throw new Error(`Chave desconhecida: ${key}`)
    return doc(firestore, base, REMOTE_COLLECTION[target.collection], target.id)
  }

  return {
    async push(docs) {
      for (let i = 0; i < docs.length; i += TRANSACTION_SIZE) {
        const batch = docs.slice(i, i + TRANSACTION_SIZE)
        await runTransaction(firestore, async (tx) => {
          const refs = batch.map((d) => refFor(d.key))
          const current = await Promise.all(refs.map((ref) => tx.get(ref)))
          batch.forEach((local, n) => {
            const remote = current[n].data()
            const remoteVersion = isEnvelope(remote) ? docVersion(remote) : null
            if (!isNewer(docVersion(local), remoteVersion)) return
            tx.set(refs[n], {
              data: local.data,
              updatedAt: local.updatedAt,
              deletedAt: local.deletedAt,
              syncedAt: serverTimestamp(),
            })
          })
        })
      }
    },

    async pull(cursor) {
      const after = cursor === null ? null : Timestamp.fromMillis(Date.parse(cursor) - CURSOR_OVERLAP_MS)
      const docs: SyncDoc[] = []
      let newest = cursor === null ? null : Date.parse(cursor)

      for (const name of Object.keys(REMOTE_COLLECTION) as SyncCollection[]) {
        const ref = collection(firestore, base, REMOTE_COLLECTION[name])
        const snapshot = await getDocs(
          after === null ? query(ref, orderBy('syncedAt')) : query(ref, where('syncedAt', '>', after), orderBy('syncedAt')),
        )
        for (const item of snapshot.docs) {
          const value = item.data()
          if (!isEnvelope(value)) continue
          if (name === 'settings' && item.id !== SETTINGS_DOC_ID) continue
          docs.push({
            key: recordKey(name, item.id),
            data: value.data,
            updatedAt: value.updatedAt,
            deletedAt: value.deletedAt ?? null,
          })
          newest = Math.max(newest ?? 0, value.syncedAt.toMillis())
        }
      }
      return { docs, cursor: newest === null ? null : new Date(newest).toISOString() }
    },

    async countRecords() {
      const counts = await Promise.all(
        (['intervals', 'daysOff'] as const).map((name) =>
          getCount(query(collection(firestore, base, REMOTE_COLLECTION[name]), where('deletedAt', '==', null))),
        ),
      )
      return counts.reduce((sum, snapshot) => sum + snapshot.data().count, 0)
    },
  }
}
