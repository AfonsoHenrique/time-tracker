import { DB_NAME } from '../lib/env'

/**
 * Conexão com o Azure DevOps guardada só neste aparelho (ADR 0005): fica no `localStorage`, com
 * uma chave por ambiente, fora do banco sincronizado, do Firestore e do backup.
 */
export interface DevOpsConnection {
  organization: string
  pat: string
  /** Conta do token, para mostrar e para `System.AssignedTo`. */
  account: { displayName: string; uniqueName: string }
  /** Campos da organização. `null` = não preencher. */
  fields: { activityType: string | null; details: string | null }
  /** Último tipo de atividade usado, para vir preenchido na prévia. */
  lastActivityType: string | null
}

export const CONNECTION_KEY = `${DB_NAME}:devops`

const EVENT = 'ponto:devops-connection'

function isConnection(value: unknown): value is DevOpsConnection {
  if (!value || typeof value !== 'object') return false
  const v = value as Partial<DevOpsConnection>
  return (
    typeof v.organization === 'string' &&
    typeof v.pat === 'string' &&
    typeof v.account?.uniqueName === 'string' &&
    typeof v.account.displayName === 'string' &&
    typeof v.fields === 'object' &&
    v.fields !== null
  )
}

export function readConnection(): DevOpsConnection | null {
  try {
    const raw = localStorage.getItem(CONNECTION_KEY)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (!isConnection(parsed)) return null
    return {
      ...parsed,
      fields: { activityType: parsed.fields.activityType ?? null, details: parsed.fields.details ?? null },
      lastActivityType: parsed.lastActivityType ?? null,
    }
  } catch {
    return null
  }
}

/** Grava a conexão. Sem `localStorage` (aba privada), devolve `false`. */
export function saveConnection(connection: DevOpsConnection): boolean {
  try {
    localStorage.setItem(CONNECTION_KEY, JSON.stringify(connection))
    window.dispatchEvent(new Event(EVENT))
    return true
  } catch {
    return false
  }
}

export function updateConnection(patch: Partial<DevOpsConnection>): void {
  const current = readConnection()
  if (current) saveConnection({ ...current, ...patch })
}

export function clearConnection(): void {
  try {
    localStorage.removeItem(CONNECTION_KEY)
    window.dispatchEvent(new Event(EVENT))
  } catch {
    // Sem localStorage não há nada guardado.
  }
}

/** Avisa quando a conexão muda nesta aba ou em outra. Devolve a função que para de escutar. */
export function onConnectionChange(listener: () => void): () => void {
  const onStorage = (event: StorageEvent) => {
    if (event.key === CONNECTION_KEY) listener()
  }
  window.addEventListener(EVENT, listener)
  window.addEventListener('storage', onStorage)
  return () => {
    window.removeEventListener(EVENT, listener)
    window.removeEventListener('storage', onStorage)
  }
}
