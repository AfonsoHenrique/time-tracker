import { useSyncExternalStore } from 'react'
import { getAccountSession, type AccountState } from '../../sync/session'

/** Estado da conta e da sincronização (spec 008), atualizado quando muda. */
export function useAccount(): AccountState {
  const session = getAccountSession()
  return useSyncExternalStore(session.subscribe, session.getState)
}
