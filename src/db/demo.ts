import type { DexieOptions } from 'dexie'
import { buildDemoData } from '../lib/demo'
import { DEMO_DB_NAME, DEMO_FLAG_KEY } from '../lib/env'
import { createRepository } from './repository'
import { PontoDb } from './schema'

/**
 * Modo demo da homologação (spec 010). Grava só no banco `DEMO_DB_NAME`: o banco real da
 * homologação nunca é aberto aqui. A tela importa este módulo com `import()`, só na homologação.
 */

/** Apaga o banco demo e grava os dados fictícios relativos a `now`. */
export async function fillDemoDb(now: Date, options?: DexieOptions): Promise<void> {
  const db = new PontoDb(DEMO_DB_NAME, options)
  try {
    await createRepository(db).replaceAll(buildDemoData(now))
  } finally {
    db.close()
  }
}

function reloadOnToday() {
  window.location.hash = '#/hoje'
  window.location.reload()
}

/** Liga o demo (ou recria os dados, se já estiver ligado) e abre a tela Hoje. */
export async function enterDemo(): Promise<void> {
  await fillDemoDb(new Date())
  localStorage.setItem(DEMO_FLAG_KEY, '1')
  reloadOnToday()
}

/** Volta aos dados reais da homologação, que ficaram como estavam. */
export function exitDemo(): void {
  localStorage.removeItem(DEMO_FLAG_KEY)
  reloadOnToday()
}
