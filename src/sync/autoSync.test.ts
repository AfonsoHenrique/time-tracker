import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { startAutoSync } from './autoSync'

function setup(visible = true) {
  const sync = vi.fn(async () => ({ ok: true as const, pushed: 0, pulled: 0, rejected: 0 }))
  let local: (() => void) | undefined
  const repo = {
    onLocalChange: (listener: () => void) => {
      local = listener
      return () => (local = undefined)
    },
  }
  const documentTarget = new EventTarget()
  const windowTarget = new EventTarget()
  const state = { visible }
  const stop = startAutoSync({
    engine: { sync },
    repo,
    documentTarget,
    windowTarget,
    isVisible: () => state.visible,
    debounceMs: 3000,
    intervalMs: 60_000,
  })
  return { sync, stop, documentTarget, windowTarget, state, write: () => local?.() }
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('gatilhos da sincronização (R7)', () => {
  it('sincroniza ao começar', () => {
    expect(setup().sync).toHaveBeenCalledTimes(1)
  })

  it('junta várias gravações num ciclo, alguns segundos depois', () => {
    const { sync, write } = setup()
    write()
    vi.advanceTimersByTime(1000)
    write()
    vi.advanceTimersByTime(2999)
    expect(sync).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(1)
    expect(sync).toHaveBeenCalledTimes(2)
  })

  it('a cada minuto só com o app visível', () => {
    const { sync, state } = setup()
    vi.advanceTimersByTime(60_000)
    expect(sync).toHaveBeenCalledTimes(2)
    state.visible = false
    vi.advanceTimersByTime(60_000)
    expect(sync).toHaveBeenCalledTimes(2)
  })

  it('ao voltar para o primeiro plano e quando a rede volta', () => {
    const { sync, documentTarget, windowTarget } = setup()
    documentTarget.dispatchEvent(new Event('visibilitychange'))
    windowTarget.dispatchEvent(new Event('online'))
    expect(sync).toHaveBeenCalledTimes(3)
  })

  it('parar desliga todos os gatilhos', () => {
    const { sync, stop, write, windowTarget } = setup()
    stop()
    write()
    windowTarget.dispatchEvent(new Event('online'))
    vi.advanceTimersByTime(120_000)
    expect(sync).toHaveBeenCalledTimes(1)
  })
})
