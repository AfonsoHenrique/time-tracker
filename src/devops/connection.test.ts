import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { CONNECTION_KEY, clearConnection, readConnection, saveConnection, type DevOpsConnection } from './connection'

const store = new Map<string, string>()

beforeEach(() => {
  store.clear()
  Object.assign(globalThis, {
    localStorage: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => store.set(key, value),
      removeItem: (key: string) => store.delete(key),
    },
    window: { dispatchEvent: () => true, addEventListener: () => undefined, removeEventListener: () => undefined },
  })
})

afterEach(() => {
  Reflect.deleteProperty(globalThis, 'localStorage')
  Reflect.deleteProperty(globalThis, 'window')
})

const connection: DevOpsConnection = {
  organization: 'yuni',
  pat: 'segredo',
  account: { displayName: 'Afonso', uniqueName: 'afonso@exemplo.com' },
  fields: { activityType: 'Custom.Tipo', details: null },
  lastActivityType: null,
}

describe('conexão guardada no aparelho (ADR 0005, CA9)', () => {
  it('fica só no localStorage, numa chave do ambiente', () => {
    expect(CONNECTION_KEY).toBe('ponto:devops')
    expect(saveConnection(connection)).toBe(true)
    expect([...store.keys()]).toEqual(['ponto:devops'])
    expect(readConnection()).toEqual(connection)
  })

  it('desconectar apaga tudo', () => {
    saveConnection(connection)
    clearConnection()
    expect(readConnection()).toBeNull()
    expect(store.size).toBe(0)
  })

  it('ignora um valor corrompido', () => {
    store.set(CONNECTION_KEY, '{"organization":1}')
    expect(readConnection()).toBeNull()
    store.set(CONNECTION_KEY, 'não é json')
    expect(readConnection()).toBeNull()
  })
})
