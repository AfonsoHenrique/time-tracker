import { DB_NAME } from '../../lib/env'

/**
 * Data do último backup baixado neste aparelho. Fica no `localStorage`, com uma chave por
 * ambiente, porque é só uma informação do aparelho e não faz parte dos dados.
 */
const KEY = `${DB_NAME}:lastBackupAt`

export function readLastBackup(): string | null {
  try {
    return localStorage.getItem(KEY)
  } catch {
    return null
  }
}

export function saveLastBackup(at: Date): void {
  try {
    localStorage.setItem(KEY, at.toISOString())
  } catch {
    // Sem localStorage (aba privada, por exemplo), o app só deixa de lembrar a data.
  }
}
