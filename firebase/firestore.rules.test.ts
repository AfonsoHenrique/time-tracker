// Testes das regras do Firestore no emulador (spec 008, CA9 e CA10).
// Rodar com `npm run test:rules` (precisa de Java; baixa o emulador na primeira vez).
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { doc, getDoc, serverTimestamp, setDoc, deleteDoc, type Firestore } from 'firebase/firestore'
import { readFileSync } from 'node:fs'
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'

let env: RulesTestEnvironment

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'ponto-regras',
    firestore: { rules: readFileSync(new URL('./firestore.rules', import.meta.url), 'utf8') },
  })
})

afterAll(async () => {
  await env.cleanup()
})

beforeEach(async () => {
  await env.clearFirestore()
})

const db = (uid: string): Firestore => env.authenticatedContext(uid).firestore() as unknown as Firestore

const interval = (overrides: Record<string, unknown> = {}) => ({
  id: 'i1',
  start: '2026-11-09T11:00:00.000Z',
  end: '2026-11-09T15:00:00.000Z',
  note: 'Daily',
  workItemId: 123567,
  taskId: null,
  declared: false,
  project: 'IA',
  createdAt: '2026-11-09T11:00:00.000Z',
  updatedAt: '2026-11-09T15:00:00.000Z',
  ...overrides,
})

const envelope = (data: unknown, updatedAt = '2026-11-09T15:00:00.000Z', deletedAt: string | null = null) => ({
  data,
  updatedAt,
  deletedAt,
  syncedAt: serverTimestamp(),
})

const intervalDoc = (store: Firestore, uid = 'a', id = 'i1', envName = 'prod') =>
  doc(store, `users/${uid}/envs/${envName}/intervals/${id}`)

describe('dono dos dados (CA9)', () => {
  it('o usuário lê e grava os próprios dados', async () => {
    await assertSucceeds(setDoc(intervalDoc(db('a')), envelope(interval())))
    await assertSucceeds(getDoc(intervalDoc(db('a'))))
  })

  it('o usuário A não lê nem grava os dados de B', async () => {
    await assertSucceeds(setDoc(intervalDoc(db('b'), 'b'), envelope(interval())))
    await assertFails(getDoc(intervalDoc(db('a'), 'b')))
    await assertFails(setDoc(intervalDoc(db('a'), 'b'), envelope(interval(), '2026-11-09T16:00:00.000Z')))
  })

  it('sem login nada passa', async () => {
    const anon = env.unauthenticatedContext().firestore() as unknown as Firestore
    await assertFails(getDoc(intervalDoc(anon)))
    await assertFails(setDoc(intervalDoc(anon), envelope(interval())))
  })

  it('ambiente desconhecido e caminhos fora do esquema são negados', async () => {
    await assertFails(setDoc(intervalDoc(db('a'), 'a', 'i1', 'teste'), envelope(interval())))
    await assertFails(setDoc(doc(db('a'), 'users/a/outra/x'), { a: 1 }))
  })

  it('apagar o documento de verdade é negado: apagar é uma marca', async () => {
    await assertSucceeds(setDoc(intervalDoc(db('a')), envelope(interval())))
    await assertFails(deleteDoc(intervalDoc(db('a'))))
    await assertSucceeds(setDoc(intervalDoc(db('a')), envelope(null, '2026-11-09T16:00:00.000Z', '2026-11-09T16:00:00.000Z')))
  })
})

describe('validação (CA10)', () => {
  it('fim antes do início é negado', async () => {
    await assertFails(setDoc(intervalDoc(db('a')), envelope(interval({ end: '2026-11-09T10:00:00.000Z' }))))
  })

  it('projeto com mais de 15 caracteres é negado', async () => {
    await assertFails(setDoc(intervalDoc(db('a')), envelope(interval({ project: 'a'.repeat(16) }))))
  })

  it('id diferente do documento, campo a mais ou work item inválido são negados', async () => {
    await assertFails(setDoc(intervalDoc(db('a')), envelope(interval({ id: 'outro' }))))
    await assertFails(setDoc(intervalDoc(db('a')), envelope({ ...interval(), extra: 1 })))
    await assertFails(setDoc(intervalDoc(db('a')), envelope(interval({ workItemId: -1 }))))
  })

  it('syncedAt tem de ser a hora do servidor', async () => {
    await assertFails(setDoc(intervalDoc(db('a')), { ...envelope(interval()), syncedAt: '2026-11-09T15:00:00.000Z' }))
  })

  it('só uma versão mais nova substitui a da nuvem', async () => {
    await assertSucceeds(setDoc(intervalDoc(db('a')), envelope(interval(), '2026-11-09T15:00:00.000Z')))
    await assertFails(setDoc(intervalDoc(db('a')), envelope(interval({ note: 'velha' }), '2026-11-09T14:00:00.000Z')))
    await assertFails(setDoc(intervalDoc(db('a')), envelope(interval(), '2026-11-09T15:00:00.000Z')))
    await assertSucceeds(setDoc(intervalDoc(db('a')), envelope(interval({ note: 'nova' }), '2026-11-09T16:00:00.000Z')))
  })

  it('dia sem meta e configurações válidos passam; inválidos não', async () => {
    const day = (date: string, data: unknown) => setDoc(doc(db('a'), `users/a/envs/hml/daysOff/${date}`), envelope(data))
    await assertSucceeds(day('2026-11-10', { date: '2026-11-10', note: 'feriado' }))
    await assertFails(day('2026-11-11', { date: '2026-11-10', note: '' }))
    await assertFails(day('amanha', { date: 'amanha', note: '' }))

    const settings = (name: string, data: unknown) => setDoc(doc(db('a'), `users/a/envs/prod/meta/${name}`), envelope(data))
    await assertSucceeds(settings('settings', { dailyTargetMinutes: 480, workDays: [1, 2, 3, 4, 5], periodStartDay: 26 }))
    await assertFails(settings('settings2', { dailyTargetMinutes: 480, workDays: [1], periodStartDay: 26 }))
    await assertFails(
      setDoc(
        doc(db('a'), 'users/a/envs/prod/meta/settings'),
        envelope({ dailyTargetMinutes: 480, workDays: [1], periodStartDay: 31 }, '2026-11-09T16:00:00.000Z'),
      ),
    )
  })
})
