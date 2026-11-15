/**
 * Regras puras da sincronização (spec 008): chaves dos registros, conflito e primeiro login.
 * Nada aqui fala com o banco ou com a nuvem.
 */

/** Coleções sincronizadas. `settings` tem um documento só. */
export type SyncCollection = 'intervals' | 'daysOff' | 'settings'

export const SYNC_COLLECTIONS: readonly SyncCollection[] = ['intervals', 'daysOff', 'settings']

/** Id do único documento de configurações. */
export const SETTINGS_DOC_ID = 'settings'

/** Chave de um registro: `intervals/{id}`, `daysOff/{AAAA-MM-DD}` ou `settings/settings`. */
export function recordKey(collection: SyncCollection, id: string): string {
  return `${collection}/${id}`
}

export function parseRecordKey(key: string): { collection: SyncCollection; id: string } | null {
  const slash = key.indexOf('/')
  if (slash <= 0) return null
  const collection = key.slice(0, slash)
  const id = key.slice(slash + 1)
  if (!(SYNC_COLLECTIONS as readonly string[]).includes(collection) || id === '') return null
  return { collection: collection as SyncCollection, id }
}

/**
 * Um registro como viaja entre o aparelho e a nuvem. Apagar também é uma mudança:
 * `data` fica `null` e `deletedAt` diz quando.
 */
export interface SyncDoc {
  key: string
  /** O registro, ou `null` quando foi apagado. */
  data: unknown
  /** Instante da última mudança no aparelho que a fez (ISO 8601 UTC). */
  updatedAt: string
  /** Quando foi apagado, ou `null`. */
  deletedAt: string | null
}

/** Versão de um documento para decidir conflitos: a data do apagar ou da última mudança. */
export function docVersion(doc: Pick<SyncDoc, 'updatedAt' | 'deletedAt'>): string {
  return doc.deletedAt ?? doc.updatedAt
}

/**
 * Se a versão que chegou deve substituir a que já existe. Vence a gravada por último; empate
 * não muda nada, porque é a mesma versão voltando. Instantes vêm de `toISOString()`, então a
 * ordem do texto é a ordem do tempo.
 */
export function isNewer(incoming: string, existing: string | null): boolean {
  return existing === null || incoming > existing
}

export interface FirstSyncInput {
  /** Conta com que este aparelho já sincronizou, ou `null`. */
  deviceUid: string | null
  /** Conta que acabou de entrar. */
  accountUid: string
  /** Intervalos e dias sem meta no aparelho. */
  localCount: number
  /** Intervalos e dias sem meta na nuvem (sem contar os apagados). */
  remoteCount: number
}

/**
 * O que fazer quando uma conta entra neste aparelho (R12 a R15):
 * - `resume`: o aparelho já sincroniza com esta conta, segue normalmente;
 * - `upload`: só o aparelho tem dados (ou nenhum lado tem), sobem sem perguntar;
 * - `download`: só a nuvem tem dados, descem sem perguntar;
 * - `ask`: os dois lados têm dados, a tela pergunta (Juntar, Usar só os da nuvem, Cancelar);
 * - `other-account`: o aparelho sincronizava com outra conta, a tela confirma antes de misturar.
 */
export type FirstSyncPlan = 'resume' | 'upload' | 'download' | 'ask' | 'other-account'

export function planFirstSync({ deviceUid, accountUid, localCount, remoteCount }: FirstSyncInput): FirstSyncPlan {
  if (deviceUid === accountUid) return 'resume'
  if (deviceUid !== null) return 'other-account'
  if (localCount > 0 && remoteCount > 0) return 'ask'
  if (remoteCount > 0) return 'download'
  return 'upload'
}
