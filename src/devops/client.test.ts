import { describe, expect, it } from 'vitest'
import { createDevOpsClient, DevOpsError, devOpsErrorText, type FetchLike } from './client'

interface Call {
  url: string
  init: RequestInit
}

function fakeFetch(responses: (Response | Error)[]): { fetch: FetchLike; calls: Call[] } {
  const calls: Call[] = []
  const fetch: FetchLike = (url, init = {}) => {
    calls.push({ url, init })
    const next = responses.shift()
    if (!next) throw new Error('chamada a mais')
    return next instanceof Error ? Promise.reject(next) : Promise.resolve(next)
  }
  return { fetch, calls }
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

async function expectCode(promise: Promise<unknown>, code: string) {
  await expect(promise).rejects.toMatchObject({ name: 'DevOpsError', code })
}

describe('cliente do Azure DevOps', () => {
  it('autentica com o PAT em Basic e lê a conta do token', async () => {
    const { fetch, calls } = fakeFetch([
      json({ authenticatedUser: { providerDisplayName: 'Afonso', properties: { Account: { $value: 'afonso@exemplo.com' } } } }),
    ])
    const client = createDevOpsClient('minha-org', 'segredo', fetch)
    expect(await client.getAccount()).toEqual({ displayName: 'Afonso', uniqueName: 'afonso@exemplo.com' })
    expect(calls[0].url).toBe('https://dev.azure.com/minha-org/_apis/connectionData?api-version=7.1-preview')
    expect((calls[0].init.headers as Record<string, string>).Authorization).toBe(`Basic ${btoa(':segredo')}`)
  })

  it('401, 403 e 203 viram token recusado (CA8)', async () => {
    for (const status of [401, 403, 203]) {
      const { fetch } = fakeFetch([new Response('<html>login</html>', { status })])
      await expectCode(createDevOpsClient('o', 'p', fetch).getAccount(), 'unauthorized')
    }
    expect(devOpsErrorText(new DevOpsError('unauthorized', ''))).toBe(
      'O token do Azure DevOps não vale mais. Gere outro e cole na aba Dados.',
    )
  })

  it('sem rede vira offline', async () => {
    const { fetch } = fakeFetch([new TypeError('Failed to fetch')])
    await expectCode(createDevOpsClient('o', 'p', fetch).getAccount(), 'offline')
  })

  it('lê as tasks com os campos da organização e ignora as que não existem', async () => {
    const { fetch, calls } = fakeFetch([
      json({
        count: 2,
        value: [
          {
            id: 120022,
            rev: 12,
            fields: {
              'System.Title': 'Reunioes e atividades 16 a 19 nov',
              'System.WorkItemType': 'Task',
              'System.State': 'New',
              'System.TeamProject': 'Plataforma Super App Yuni',
              'Custom.Tipo': 'Reuniões',
            },
          },
          null,
        ],
      }),
    ])
    const items = await createDevOpsClient('o', 'p', fetch).getWorkItems([120022, 999], ['Custom.Tipo'])
    expect(items).toEqual([
      {
        id: 120022,
        rev: 12,
        type: 'Task',
        title: 'Reunioes e atividades 16 a 19 nov',
        state: 'New',
        project: 'Plataforma Super App Yuni',
        completedWork: null,
        custom: { 'Custom.Tipo': 'Reuniões' },
      },
    ])
    expect(calls[0].url).toContain('ids=120022,999')
    expect(calls[0].url).toContain('errorPolicy=omit')
    expect(calls[0].url).toContain('Custom.Tipo')
  })

  it('envia o PATCH como json-patch e separa conflito de regra do processo (CA2, CA7)', async () => {
    const patch = [{ op: 'test' as const, path: '/rev', value: 12 }]
    const ok = fakeFetch([json({ id: 1, rev: 13, fields: { 'System.State': 'Active' } })])
    const saved = await createDevOpsClient('o', 'p', ok.fetch).patchWorkItem(1, patch)
    expect(saved).toMatchObject({ id: 1, rev: 13, state: 'Active' })
    expect(ok.calls[0].init.method).toBe('PATCH')
    expect((ok.calls[0].init.headers as Record<string, string>)['Content-Type']).toBe('application/json-patch+json')
    expect(JSON.parse(ok.calls[0].init.body as string)).toEqual(patch)

    const conflict = fakeFetch([json({ message: 'TF401289: rev mismatch' }, 400)])
    await expectCode(createDevOpsClient('o', 'p', conflict.fetch).patchWorkItem(1, patch), 'conflict')

    const rule = fakeFetch([json({ message: "TF401320: Rule Error for field Tipo de atividade. Error code: Required." }, 400)])
    const error = await createDevOpsClient('o', 'p', rule.fetch)
      .patchWorkItem(1, patch)
      .catch((e: unknown) => e)
    expect(error).toMatchObject({ code: 'rule' })
    expect(devOpsErrorText(error)).toContain('Tipo de atividade')

    const missing = fakeFetch([json({ message: 'not found' }, 404)])
    await expectCode(createDevOpsClient('o', 'p', missing.fetch).patchWorkItem(1, patch), 'not-found')
  })

  it('lista os valores permitidos de um campo no projeto da task', async () => {
    const { fetch, calls } = fakeFetch([json({ allowedValues: ['Reuniões', 'Desenvolvimento'] })])
    const values = await createDevOpsClient('o', 'p', fetch).getAllowedValues('Plataforma Super App', 'Custom.Tipo')
    expect(values).toEqual(['Reuniões', 'Desenvolvimento'])
    expect(calls[0].url).toBe(
      'https://dev.azure.com/o/Plataforma%20Super%20App/_apis/wit/workitemtypes/Task/fields/Custom.Tipo?$expand=allowedValues&api-version=7.1',
    )
  })
})
