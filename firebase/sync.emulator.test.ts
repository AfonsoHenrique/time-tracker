// Sincronização de ponta a ponta nos emuladores do Firebase (spec 008): dois aparelhos com
// IndexedDB simulado, o Firestore lite de verdade e as regras do repositório.
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb'
import { deleteApp, initializeApp, type FirebaseApp } from 'firebase/app'
import { connectAuthEmulator, GoogleAuthProvider, inMemoryPersistence, initializeAuth, signInWithCredential } from 'firebase/auth'
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore/lite'
import { afterEach, describe, expect, it } from 'vitest'
import { createRepository } from '../src/db/repository'
import { PontoDb } from '../src/db/schema'
import { at } from '../src/lib/test-helpers'
import { createSyncEngine } from '../src/sync/engine'
import { createFirestoreRemote } from '../src/sync/firestoreRemote'

const apps: FirebaseApp[] = []
let n = 0

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => deleteApp(app)))
})

/** Um aparelho logado com a conta `sub` no emulador de autenticação. */
async function device(sub: string, env: 'prod' | 'hml' = 'prod') {
  const app = initializeApp({ projectId: 'ponto-regras', apiKey: 'chave-do-emulador' }, `aparelho-${++n}`)
  apps.push(app)
  const auth = initializeAuth(app, { persistence: inMemoryPersistence })
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
  const token = JSON.stringify({ sub, email: `${sub}@example.com`, email_verified: true })
  const { user } = await signInWithCredential(auth, GoogleAuthProvider.credential(token))
  const firestore = getFirestore(app)
  connectFirestoreEmulator(firestore, '127.0.0.1', 8080)

  const repo = createRepository(new PontoDb(`e2e-${n}`, { indexedDB: new IDBFactory(), IDBKeyRange }))
  const remote = createFirestoreRemote(firestore, user.uid, env)
  const engine = createSyncEngine({ repo, remote, lock: (run) => run() })
  return { repo, remote, engine, uid: user.uid }
}

const day = (d: { repo: ReturnType<typeof createRepository> }) => d.repo.listIntervals('2026-11-09', '2026-11-09')

describe('sincronização com o Firestore', () => {
  it('CA3/CA7: o que o Mac grava aparece no Android, com edição e apagar', async () => {
    const sub = `conta-${Date.now()}`
    const mac = await device(sub)
    const android = await device(sub)
    expect(android.uid).toBe(mac.uid)

    const daily = await mac.repo.createInterval({ start: at('2026-11-09 09:00'), end: at('2026-11-09 09:30'), note: 'Daily', workItemId: 123567 })
    const lunch = await mac.repo.createInterval({ start: at('2026-11-09 12:00'), end: at('2026-11-09 13:00') })
    await mac.repo.setDayOff('2026-11-10', 'feriado')
    await mac.repo.saveSettings({ periodStartDay: 1 })
    expect(await mac.engine.plan(mac.uid)).toBe('upload')
    expect(await mac.engine.link(mac.uid, 'upload')).toMatchObject({ ok: true, pushed: 4 })

    expect(await android.engine.plan(android.uid)).toBe('download')
    expect(await android.engine.link(android.uid, 'cloud-only')).toMatchObject({ ok: true, pulled: 4 })
    expect(await day(android)).toEqual([daily, lunch])
    expect((await android.repo.getSettings()).periodStartDay).toBe(1)

    await android.repo.updateInterval(daily.id, { note: 'Daily equipe IA' })
    await android.repo.deleteInterval(lunch.id)
    expect(await android.engine.sync()).toMatchObject({ ok: true, pushed: 2 })
    expect(await mac.engine.sync()).toMatchObject({ ok: true, pulled: 2 })
    expect((await day(mac)).map((i) => i.note)).toEqual(['Daily equipe IA'])
  })

  it('CA4: a versão mais antiga não sobrescreve a mais nova na nuvem', async () => {
    const sub = `conta-conflito-${Date.now()}`
    const mac = await device(sub)
    const android = await device(sub)
    await mac.engine.link(mac.uid, 'upload')
    const interval = await mac.repo.createInterval({ start: at('2026-11-09 08:00'), end: at('2026-11-09 12:00') })
    await mac.engine.sync()
    await android.engine.link(android.uid, 'cloud-only')

    await mac.repo.updateInterval(interval.id, { note: 'do Mac' })
    await new Promise((resolve) => setTimeout(resolve, 5))
    await android.repo.updateInterval(interval.id, { note: 'do Android' })
    await android.engine.sync()
    await mac.engine.sync()
    expect((await day(mac))[0].note).toBe('do Android')
  })

  it('CA9/CA12: outra conta e o outro ambiente não veem os dados', async () => {
    const sub = `conta-isolada-${Date.now()}`
    const mac = await device(sub)
    await mac.repo.createInterval({ start: at('2026-11-09 08:00'), end: at('2026-11-09 12:00') })
    await mac.engine.link(mac.uid, 'upload')

    const stranger = await device(`${sub}-outra`)
    expect(await stranger.remote.countRecords()).toBe(0)
    const hml = await device(sub, 'hml')
    expect(await hml.remote.countRecords()).toBe(0)
    expect(await mac.remote.countRecords()).toBe(1)
  })
})
