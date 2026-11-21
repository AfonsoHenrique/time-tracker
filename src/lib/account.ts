/** Textos e regras puras do login (spec 008): provedores, erros e estado da sincronização. */
import { format, parseISO } from 'date-fns'

export type ProviderId = 'google' | 'microsoft'

export const PROVIDERS: readonly ProviderId[] = ['google', 'microsoft']

export const PROVIDER_LABELS: Record<ProviderId, string> = { google: 'Google', microsoft: 'Microsoft' }

/** Id do provedor no Firebase Auth. */
export const FIREBASE_PROVIDER_IDS: Record<ProviderId, string> = { google: 'google.com', microsoft: 'microsoft.com' }

export function providerFromFirebaseId(id: string): ProviderId | null {
  return PROVIDERS.find((p) => FIREBASE_PROVIDER_IDS[p] === id) ?? null
}

/**
 * Texto para a tela a partir do código de erro do Firebase Auth, ou `null` quando não há o que
 * mostrar (o usuário fechou a janela de login).
 */
export function authErrorMessage(code: string | undefined, provider?: ProviderId): string | null {
  const name = provider ? PROVIDER_LABELS[provider] : 'essa conta'
  switch (code) {
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
    case 'auth/user-cancelled':
      return null
    case 'auth/popup-blocked':
      return 'O navegador bloqueou a janela de login. Permita pop-ups para este site e tente de novo.'
    case 'auth/network-request-failed':
      return 'Sem internet. Tente de novo quando a conexão voltar.'
    case 'auth/credential-already-in-use':
      return `A conta ${name} já entrou no Ponto sozinha. Saia, entre com ela, e vincule a outra a partir dela.`
    case 'auth/account-exists-with-different-credential':
      return 'Já existe uma conta com este e-mail por outro provedor. Entre com ele e vincule este depois.'
    case 'auth/provider-already-linked':
      return `A conta ${name} já está vinculada.`
    case 'auth/unauthorized-domain':
      return 'Este endereço não está autorizado no Firebase (Authentication → Configurações → Domínios autorizados).'
    case 'auth/operation-not-allowed':
      return `O login com ${name} não está ativado no Firebase.`
    case 'auth/admin-restricted-operation':
      return 'O administrador da conta bloqueou este app. Use o login com o Google.'
    default:
      return `Não foi possível entrar${code ? ` (${code})` : ''}. Tente de novo.`
  }
}

export interface SyncStatusInput {
  running: boolean
  online: boolean
  pending: number
  lastSyncAt: string | null
  lastError: string | null
}

/** Estado da sincronização em uma linha (R10). */
export function describeSyncStatus({ running, online, pending, lastSyncAt, lastError }: SyncStatusInput): {
  kind: 'ok' | 'busy' | 'waiting' | 'error'
  text: string
} {
  if (running) return { kind: 'busy', text: 'Sincronizando…' }
  if (!online) {
    return {
      kind: 'waiting',
      text:
        pending > 0
          ? `Sem internet: ${pending} ${pending === 1 ? 'alteração esperando' : 'alterações esperando'}.`
          : 'Sem internet. As mudanças sobem quando a conexão voltar.',
    }
  }
  if (lastError) return { kind: 'error', text: `Erro na última sincronização: ${lastError}` }
  if (lastSyncAt === null) return { kind: 'waiting', text: 'Ainda não sincronizou.' }
  return { kind: 'ok', text: `Sincronizado às ${format(parseISO(lastSyncAt), 'HH:mm')}.` }
}
