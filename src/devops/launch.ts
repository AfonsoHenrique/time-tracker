import { buildPatch, launchStates, type CustomFields, type LaunchPlan, type TaskPlan } from '../lib/devopsLaunch'
import { DevOpsError, devOpsErrorText, type DevOpsClient, type WorkItem } from './client'

/** Uma task na prévia: o plano do app e o que o Azure DevOps tem agora. */
export type TaskPreview =
  | {
      ok: true
      plan: TaskPlan
      item: WorkItem
      /** Valor atual do Tipo de atividade na task (texto vazio quando não há). */
      currentActivityType: string
      /** Valores permitidos do Tipo de atividade; vazio quando o campo não está mapeado. */
      activityTypes: string[]
    }
  | { ok: false; plan: TaskPlan; reason: string }

/**
 * Lê as tasks do plano no Azure DevOps e os valores permitidos do Tipo de atividade, por projeto.
 * Uma task que não existe, que o token não lê ou que não é Task fica com o motivo (R20).
 */
export async function loadPreview(client: DevOpsClient, plan: LaunchPlan, fields: CustomFields): Promise<TaskPreview[]> {
  const custom = [fields.activityType, fields.details].filter((name): name is string => name !== null)
  const items = await client.getWorkItems(
    plan.tasks.map((task) => task.taskId),
    custom,
  )
  const byId = new Map(items.map((item) => [item.id, item]))
  const allowed = new Map<string, Promise<string[]>>()
  const allowedFor = (project: string): Promise<string[]> => {
    if (fields.activityType === null) return Promise.resolve([])
    let values = allowed.get(project)
    if (!values) {
      values = client.getAllowedValues(project, fields.activityType)
      allowed.set(project, values)
    }
    return values
  }

  return Promise.all(
    plan.tasks.map(async (task): Promise<TaskPreview> => {
      const item = byId.get(task.taskId)
      if (!item) return { ok: false, plan: task, reason: 'Não encontrada no Azure DevOps, ou o token não tem acesso.' }
      if (item.type !== 'Task') return { ok: false, plan: task, reason: `É um ${item.type || 'work item'}, não uma Task.` }
      const current = fields.activityType === null ? '' : item.custom[fields.activityType]
      return {
        ok: true,
        plan: task,
        item,
        currentActivityType: typeof current === 'string' ? current : '',
        activityTypes: await allowedFor(item.project),
      }
    }),
  )
}

export type LaunchResult =
  | { taskId: number; status: 'done'; state: string; declared: number }
  /** Gravou os campos, mas não conseguiu fechar (R24). */
  | { taskId: number; status: 'not-closed'; reason: string; declared: number }
  | { taskId: number; status: 'failed'; reason: string; code: DevOpsError['code'] | 'unknown' }

export interface LaunchInput {
  client: DevOpsClient
  tasks: readonly { preview: Extract<TaskPreview, { ok: true }>; activityType: string | null }[]
  fields: CustomFields
  assignedTo: string
  close: boolean
  /** Marca os intervalos como declarados (repositório). */
  markDeclared: (ids: readonly string[]) => Promise<number>
}

function failure(taskId: number, error: unknown): LaunchResult {
  return {
    taskId,
    status: 'failed',
    reason: devOpsErrorText(error),
    code: error instanceof DevOpsError ? error.code : 'unknown',
  }
}

/**
 * Grava cada task (campos e Active numa requisição; Closed numa segunda, quando configurado) e,
 * só depois de gravar, marca os intervalos dela como declarados (R21–R24). Uma task que falha não
 * impede as outras. Token recusado para tudo, porque as próximas falhariam igual.
 */
export async function runLaunch(input: LaunchInput): Promise<LaunchResult[]> {
  const results: LaunchResult[] = []
  for (const { preview, activityType } of input.tasks) {
    const { plan, item } = preview
    const states = launchStates(item.state, input.close)
    let saved: WorkItem
    try {
      saved = await input.client.patchWorkItem(
        plan.taskId,
        buildPatch({
          rev: item.rev,
          task: plan,
          fields: input.fields,
          activityType,
          assignedTo: input.assignedTo,
          state: states.first,
        }),
      )
    } catch (error) {
      results.push(failure(plan.taskId, error))
      if (error instanceof DevOpsError && error.code === 'unauthorized') break
      continue
    }

    if (states.second === null) {
      const declared = await input.markDeclared(plan.intervalIds)
      results.push({ taskId: plan.taskId, status: 'done', state: saved.state || states.first || item.state, declared })
      continue
    }

    try {
      const closed = await input.client.patchWorkItem(plan.taskId, [
        { op: 'test', path: '/rev', value: saved.rev },
        { op: 'add', path: '/fields/System.State', value: states.second },
      ])
      const declared = await input.markDeclared(plan.intervalIds)
      results.push({ taskId: plan.taskId, status: 'done', state: closed.state || states.second, declared })
    } catch (error) {
      const declared = await input.markDeclared(plan.intervalIds)
      results.push({
        taskId: plan.taskId,
        status: 'not-closed',
        reason: `Lançada, mas ficou em ${saved.state || 'Active'}: ${devOpsErrorText(error)}`,
        declared,
      })
    }
  }
  return results
}
