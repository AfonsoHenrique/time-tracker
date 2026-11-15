import type { Repository } from '../db/repository'
import type { SyncEngine } from './engine'

/** Evento disparado na `window` quando a sincronização muda dados do aparelho. */
export const SYNCED_EVENT = 'ponto:synced'

export interface AutoSyncOptions {
  engine: Pick<SyncEngine, 'sync'>
  repo: Pick<Repository, 'onLocalChange'>
  /** Espera depois de uma gravação, para juntar várias num ciclo só. */
  debounceMs?: number
  /** Intervalo dos ciclos com o app aberto e visível. */
  intervalMs?: number
  /** Para os testes; padrão: `document` (visibilidade) e `window` (rede). */
  documentTarget?: Pick<Document, 'addEventListener' | 'removeEventListener'>
  windowTarget?: Pick<Window, 'addEventListener' | 'removeEventListener'>
  isVisible?: () => boolean
}

/**
 * Gatilhos da sincronização (spec 008, R7): ao começar, ao voltar para o primeiro plano,
 * quando a rede volta, alguns segundos depois de cada gravação e a cada minuto com o app visível.
 * Devolve a função que para tudo.
 */
export function startAutoSync({
  engine,
  repo,
  debounceMs = 3000,
  intervalMs = 60_000,
  documentTarget = document,
  windowTarget = window,
  isVisible = () => document.visibilityState === 'visible',
}: AutoSyncOptions): () => void {
  let debounce: ReturnType<typeof setTimeout> | undefined
  const run = () => void engine.sync()
  const runIfVisible = () => {
    if (isVisible()) run()
  }
  const soon = () => {
    clearTimeout(debounce)
    debounce = setTimeout(run, debounceMs)
  }

  const stopListening = repo.onLocalChange(soon)
  documentTarget.addEventListener('visibilitychange', runIfVisible)
  windowTarget.addEventListener('online', run)
  const timer = setInterval(runIfVisible, intervalMs)
  run()

  return () => {
    stopListening()
    clearTimeout(debounce)
    clearInterval(timer)
    documentTarget.removeEventListener('visibilitychange', runIfVisible)
    windowTarget.removeEventListener('online', run)
  }
}
