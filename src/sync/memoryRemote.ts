import { docVersion, isNewer, type SyncDoc } from '../lib/sync'
import type { RemoteStore } from './remote'

/** Nuvem em memória, com a mesma regra do Firestore: só grava o que é mais novo. Para testes. */
export function createMemoryRemote() {
  const docs = new Map<string, { doc: SyncDoc; syncedAt: number }>()
  let clock = 0
  const cursorOf = (n: number) => String(n).padStart(12, '0')

  const remote: RemoteStore & { docs: typeof docs; write(doc: SyncDoc): void } = {
    docs,
    /** Grava direto, como se outro aparelho tivesse enviado. */
    write(doc: SyncDoc) {
      const current = docs.get(doc.key)
      if (current && !isNewer(docVersion(doc), docVersion(current.doc))) return
      docs.set(doc.key, { doc: structuredClone(doc), syncedAt: ++clock })
    },
    async push(batch) {
      for (const doc of batch) remote.write(doc)
    },
    async pull(cursor) {
      const after = cursor === null ? 0 : Number(cursor)
      const found = [...docs.values()].filter((entry) => entry.syncedAt > after)
      if (found.length === 0) return { docs: [], cursor }
      const last = Math.max(...found.map((entry) => entry.syncedAt))
      return { docs: found.map((entry) => structuredClone(entry.doc)), cursor: cursorOf(last) }
    },
    async countRecords() {
      return [...docs.values()].filter(({ doc }) => doc.deletedAt === null && !doc.key.startsWith('settings/')).length
    },
  }
  return remote
}
