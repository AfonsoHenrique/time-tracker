import { DEVOPS_FIELDS, type PatchOperation } from '../lib/devopsLaunch'

/**
 * Cliente mínimo da API REST do Azure DevOps (spec 013). Fala direto do navegador com
 * `dev.azure.com`, que aceita CORS com o cabeçalho `Authorization` (ADR 0005).
 */

const API_VERSION = '7.1'

export type DevOpsErrorCode = 'unauthorized' | 'not-found' | 'conflict' | 'rule' | 'offline' | 'unknown'

export class DevOpsError extends Error {
  readonly code: DevOpsErrorCode

  constructor(code: DevOpsErrorCode, message: string) {
    super(message)
    this.name = 'DevOpsError'
    this.code = code
  }
}

/** Texto para a tela de cada erro. `rule` e `unknown` levam a mensagem do Azure DevOps. */
export function devOpsErrorText(error: unknown): string {
  if (!(error instanceof DevOpsError)) return 'Erro inesperado ao falar com o Azure DevOps.'
  switch (error.code) {
    case 'unauthorized':
      return 'O token do Azure DevOps não vale mais. Gere outro e cole na aba Dados.'
    case 'not-found':
      return 'Não encontrada no Azure DevOps, ou o token não tem acesso.'
    case 'conflict':
      return 'A task mudou no Azure DevOps desde a prévia.'
    case 'offline':
      return 'Sem conexão com o Azure DevOps.'
    default:
      return error.message
  }
}

export interface DevOpsAccount {
  displayName: string
  /** E-mail ou login da conta, o valor que vai em `System.AssignedTo`. */
  uniqueName: string
}

export interface DevOpsField {
  name: string
  referenceName: string
}

export interface WorkItem {
  id: number
  rev: number
  type: string
  title: string
  state: string
  project: string
  completedWork: number | null
  /** Valores dos campos da organização pedidos na leitura, pelo nome de referência. */
  custom: Record<string, unknown>
}

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>

export interface DevOpsClient {
  getAccount(): Promise<DevOpsAccount>
  listFields(): Promise<DevOpsField[]>
  getAllowedValues(project: string, field: string): Promise<string[]>
  /** Lê as tasks. Ids que não existem (ou que o token não lê) ficam fora do resultado. */
  getWorkItems(ids: readonly number[], customFields: readonly string[]): Promise<WorkItem[]>
  patchWorkItem(id: number, patch: readonly PatchOperation[]): Promise<WorkItem>
}

function basicAuth(pat: string): string {
  return `Basic ${btoa(`:${pat}`)}`
}

async function errorMessage(response: Response): Promise<string> {
  try {
    const body: unknown = await response.json()
    if (body && typeof body === 'object' && 'message' in body && typeof body.message === 'string') return body.message
  } catch {
    // Corpo sem JSON: fica a mensagem genérica.
  }
  return `O Azure DevOps respondeu ${response.status}.`
}

function str(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function toWorkItem(raw: unknown, customFields: readonly string[]): WorkItem {
  const item = (raw ?? {}) as { id?: unknown; rev?: unknown; fields?: Record<string, unknown> }
  const fields = item.fields ?? {}
  const completed = fields[DEVOPS_FIELDS.completedWork]
  return {
    id: Number(item.id),
    rev: Number(item.rev),
    type: str(fields['System.WorkItemType']),
    title: str(fields['System.Title']),
    state: str(fields[DEVOPS_FIELDS.state]),
    project: str(fields['System.TeamProject']),
    completedWork: typeof completed === 'number' ? completed : null,
    custom: Object.fromEntries(customFields.map((name) => [name, fields[name]])),
  }
}

export function createDevOpsClient(organization: string, pat: string, fetchImpl: FetchLike = fetch): DevOpsClient {
  const base = `https://dev.azure.com/${encodeURIComponent(organization)}`

  async function request(path: string, init: RequestInit = {}, version = API_VERSION): Promise<unknown> {
    const separator = path.includes('?') ? '&' : '?'
    let response: Response
    try {
      response = await fetchImpl(`${base}/${path}${separator}api-version=${version}`, {
        ...init,
        headers: { Authorization: basicAuth(pat), Accept: 'application/json', ...init.headers },
      })
    } catch {
      throw new DevOpsError('offline', 'Sem conexão com o Azure DevOps.')
    }
    // Com credencial inválida, o Azure DevOps às vezes responde 203 com a página de login.
    if (response.status === 401 || response.status === 403 || response.status === 203) {
      throw new DevOpsError('unauthorized', 'Token recusado pelo Azure DevOps.')
    }
    if (response.status === 404) throw new DevOpsError('not-found', await errorMessage(response))
    if (response.status === 409 || response.status === 412) throw new DevOpsError('conflict', await errorMessage(response))
    if (response.status === 400) {
      const message = await errorMessage(response)
      // A operação `test` em `/rev` que falha pode voltar como 400 com o código TF401289.
      throw new DevOpsError(/TF401289/.test(message) ? 'conflict' : 'rule', message)
    }
    if (!response.ok) throw new DevOpsError('unknown', await errorMessage(response))
    return response.json()
  }

  return {
    async getAccount() {
      const data = (await request('_apis/connectionData', {}, '7.1-preview')) as {
        authenticatedUser?: { providerDisplayName?: string; properties?: { Account?: { $value?: string } } }
      }
      const user = data.authenticatedUser ?? {}
      const uniqueName = user.properties?.Account?.$value ?? ''
      return { displayName: user.providerDisplayName ?? uniqueName, uniqueName }
    },

    async listFields() {
      const data = (await request('_apis/wit/fields')) as { value?: DevOpsField[] }
      return (data.value ?? [])
        .map((field) => ({ name: field.name, referenceName: field.referenceName }))
        .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
    },

    async getAllowedValues(project, field) {
      const data = (await request(
        `${encodeURIComponent(project)}/_apis/wit/workitemtypes/Task/fields/${encodeURIComponent(field)}?$expand=allowedValues`,
      )) as { allowedValues?: unknown[] }
      return (data.allowedValues ?? []).filter((value): value is string => typeof value === 'string')
    },

    async getWorkItems(ids, customFields) {
      if (ids.length === 0) return []
      const fields = [
        'System.Title',
        'System.WorkItemType',
        DEVOPS_FIELDS.state,
        'System.TeamProject',
        DEVOPS_FIELDS.completedWork,
        ...customFields,
      ]
      const items: WorkItem[] = []
      for (let i = 0; i < ids.length; i += 200) {
        const batch = ids.slice(i, i + 200)
        const data = (await request(
          `_apis/wit/workitems?ids=${batch.join(',')}&fields=${fields.map(encodeURIComponent).join(',')}&errorPolicy=omit`,
        )) as { value?: unknown[] }
        for (const raw of data.value ?? []) if (raw) items.push(toWorkItem(raw, customFields))
      }
      return items
    },

    async patchWorkItem(id, patch) {
      const data = await request(`_apis/wit/workitems/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json-patch+json' },
        body: JSON.stringify(patch),
      })
      return toWorkItem(data, [])
    },
  }
}
