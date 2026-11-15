import type { SyncDoc } from '../lib/sync'

/**
 * A nuvem, do ponto de vista do motor de sincronização. A implementação real usa o Firestore
 * (`users/{uid}/envs/{env}/…`); os testes usam `createMemoryRemote`.
 */
export interface RemoteStore {
  /**
   * Grava cada documento só se ele for mais novo que o da nuvem (última gravação vence).
   * Um documento mais antigo é ignorado sem erro: a versão da nuvem desce na leitura seguinte.
   */
  push(docs: readonly SyncDoc[]): Promise<void>
  /** Documentos gravados na nuvem depois do cursor, e o cursor novo (`null` = do começo). */
  pull(cursor: string | null): Promise<{ docs: SyncDoc[]; cursor: string | null }>
  /** Intervalos e dias sem meta que existem na nuvem, sem contar os apagados. */
  countRecords(): Promise<number>
}
