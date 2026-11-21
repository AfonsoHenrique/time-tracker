import { describe, expect, it } from 'vitest'
import { planLaunch, type PatchOperation } from '../lib/devopsLaunch'
import { iv } from '../lib/test-helpers'
import { DevOpsError, type DevOpsClient, type WorkItem } from './client'
import { loadPreview, runLaunch, type TaskPreview } from './launch'

const fields = { activityType: 'Custom.Tipo', details: 'Custom.Detalhes' }

function item(id: number, patch: Partial<WorkItem> = {}): WorkItem {
  return { id, rev: 5, type: 'Task', title: `Task ${id}`, state: 'New', project: 'Proj', completedWork: null, custom: {}, ...patch }
}

interface FakeOptions {
  items?: WorkItem[]
  /** Erro para o PATCH de cada task, na ordem das chamadas. */
  patchErrors?: Record<number, (DevOpsError | null)[]>
}

function fakeClient(options: FakeOptions = {}) {
  const patches: { id: number; ops: readonly PatchOperation[] }[] = []
  const allowedCalls: string[] = []
  const errors = options.patchErrors ?? {}
  const client: DevOpsClient = {
    getAccount: () => Promise.resolve({ displayName: 'A', uniqueName: 'a@x.com' }),
    listFields: () => Promise.resolve([]),
    getAllowedValues: (project) => {
      allowedCalls.push(project)
      return Promise.resolve(['Reuniões', 'Desenvolvimento'])
    },
    getWorkItems: (ids) => Promise.resolve((options.items ?? []).filter((i) => ids.includes(i.id))),
    patchWorkItem: (id, ops) => {
      patches.push({ id, ops })
      const error = errors[id]?.shift()
      if (error) return Promise.reject(error)
      const state = ops.find((op) => op.path === '/fields/System.State')?.value
      return Promise.resolve(item(id, { rev: 6, state: typeof state === 'string' ? state : 'Active' }))
    },
  }
  return { client, patches, allowedCalls }
}

const plan = () =>
  planLaunch(
    [
      iv('2026-11-16 10:30', '2026-11-16 11:00', 'Daily', { taskId: 1 }),
      iv('2026-11-16 11:00', '2026-11-16 12:00', 'Dev', { taskId: 2 }),
      iv('2026-11-16 13:00', '2026-11-16 14:00', 'Bug', { taskId: 3 }),
    ],
    { roundQuarter: false },
  )

const okPreviews = (previews: TaskPreview[]) =>
  previews.filter((p): p is Extract<TaskPreview, { ok: true }> => p.ok).map((preview) => ({ preview, activityType: 'Reuniões' }))

function declaredLog() {
  const calls: string[][] = []
  return {
    calls,
    markDeclared: (ids: readonly string[]) => {
      calls.push([...ids])
      return Promise.resolve(ids.length)
    },
  }
}

describe('loadPreview', () => {
  it('marca a task que não existe ou não é Task e lê os valores do tipo uma vez por projeto (R20)', async () => {
    const { client, allowedCalls } = fakeClient({
      items: [item(1, { custom: { 'Custom.Tipo': 'Reuniões' } }), item(2, { type: 'Bug' })],
    })
    const previews = await loadPreview(client, plan(), fields)
    expect(previews.map((p) => (p.ok ? 'ok' : p.reason))).toEqual([
      'ok',
      'É um Bug, não uma Task.',
      'Não encontrada no Azure DevOps, ou o token não tem acesso.',
    ])
    const first = previews[0]
    expect(first.ok && first.currentActivityType).toBe('Reuniões')
    expect(first.ok && first.activityTypes).toEqual(['Reuniões', 'Desenvolvimento'])
    expect(allowedCalls).toEqual(['Proj'])
  })

  it('sem o campo mapeado não busca os valores do tipo', async () => {
    const { client, allowedCalls } = fakeClient({ items: [item(1), item(2), item(3)] })
    const previews = await loadPreview(client, plan(), { activityType: null, details: null })
    expect(previews.every((p) => p.ok && p.activityTypes.length === 0)).toBe(true)
    expect(allowedCalls).toEqual([])
  })
})

describe('runLaunch', () => {
  it('grava em Active e marca os intervalos (CA2)', async () => {
    const { client, patches } = fakeClient({ items: [item(1), item(2), item(3)] })
    const previews = await loadPreview(client, plan(), fields)
    const log = declaredLog()
    const results = await runLaunch({ client, tasks: okPreviews(previews), fields, assignedTo: 'a@x.com', close: false, markDeclared: log.markDeclared })
    expect(results.map((r) => [r.taskId, r.status])).toEqual([
      [1, 'done'],
      [2, 'done'],
      [3, 'done'],
    ])
    expect(patches).toHaveLength(3)
    expect(patches[0].ops).toContainEqual({ op: 'add', path: '/fields/System.State', value: 'Active' })
    expect(patches[0].ops).toContainEqual({ op: 'add', path: '/fields/Custom.Tipo', value: 'Reuniões' })
    expect(log.calls).toHaveLength(3)
  })

  it('com fechar, faz um segundo PATCH para Closed; se ele falha, marca e avisa (CA3)', async () => {
    const { client, patches } = fakeClient({
      items: [item(1), item(2), item(3)],
      patchErrors: { 2: [null, new DevOpsError('rule', 'Transição não permitida')] },
    })
    const previews = await loadPreview(client, plan(), fields)
    const log = declaredLog()
    const results = await runLaunch({ client, tasks: okPreviews(previews), fields, assignedTo: 'a', close: true, markDeclared: log.markDeclared })
    expect(results[0]).toMatchObject({ taskId: 1, status: 'done', state: 'Closed' })
    expect(results[1]).toMatchObject({ taskId: 2, status: 'not-closed' })
    expect(results[1].status === 'not-closed' && results[1].reason).toContain('Transição não permitida')
    expect(patches.filter((p) => p.id === 1).map((p) => p.ops.at(-1))).toEqual([
      { op: 'add', path: '/fields/System.State', value: 'Active' },
      { op: 'add', path: '/fields/System.State', value: 'Closed' },
    ])
    expect(patches.find((p) => p.id === 1 && p.ops.length === 2)?.ops[0]).toEqual({ op: 'test', path: '/rev', value: 6 })
    expect(log.calls).toHaveLength(3)
  })

  it('task que falha não marca nada e as outras seguem (CA7)', async () => {
    const { client } = fakeClient({
      items: [item(1), item(2), item(3)],
      patchErrors: { 2: [new DevOpsError('conflict', 'rev')], 3: [new DevOpsError('rule', 'Campo obrigatório')] },
    })
    const previews = await loadPreview(client, plan(), fields)
    const log = declaredLog()
    const results = await runLaunch({ client, tasks: okPreviews(previews), fields, assignedTo: 'a', close: false, markDeclared: log.markDeclared })
    expect(results.map((r) => r.status)).toEqual(['done', 'failed', 'failed'])
    expect(results[1]).toMatchObject({ code: 'conflict', reason: 'A task mudou no Azure DevOps desde a prévia.' })
    expect(results[2]).toMatchObject({ code: 'rule', reason: 'Campo obrigatório' })
    expect(log.calls).toEqual([[previews[0].plan.intervalIds[0]]])
  })

  it('token recusado para o lançamento sem marcar nada (CA8)', async () => {
    const { client, patches } = fakeClient({
      items: [item(1), item(2), item(3)],
      patchErrors: { 1: [new DevOpsError('unauthorized', '')] },
    })
    const previews = await loadPreview(client, plan(), fields)
    const log = declaredLog()
    const results = await runLaunch({ client, tasks: okPreviews(previews), fields, assignedTo: 'a', close: false, markDeclared: log.markDeclared })
    expect(results).toHaveLength(1)
    expect(results[0]).toMatchObject({ status: 'failed', code: 'unauthorized' })
    expect(patches).toHaveLength(1)
    expect(log.calls).toEqual([])
  })

  it('task já Closed não volta para Active nem recebe segundo PATCH', async () => {
    const { client, patches } = fakeClient({ items: [item(1, { state: 'Closed' }), item(2), item(3)] })
    const previews = await loadPreview(client, plan(), fields)
    const log = declaredLog()
    await runLaunch({ client, tasks: okPreviews(previews).slice(0, 1), fields, assignedTo: 'a', close: true, markDeclared: log.markDeclared })
    expect(patches).toHaveLength(1)
    expect(patches[0].ops.some((op) => op.path === '/fields/System.State')).toBe(false)
  })
})
