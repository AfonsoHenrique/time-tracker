import { EMPTY_DEVOPS_FIELDS, type Interval } from './types'

/** Maior id aceito: os ids de work item do Azure DevOps são inteiros de 32 bits. */
const MAX_ID = 2_147_483_647

/** Diz se o valor é um id de work item válido: inteiro de 1 até o limite de 32 bits. */
export function isDevOpsId(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= MAX_ID
}

export type DevOpsIdInput = { ok: true; value: number | null } | { ok: false }

/**
 * Lê um id digitado no formulário. Vazio vira `null`. Aceita `#` na frente, como o Azure DevOps
 * mostra os ids (`#123567`), e espaços nas pontas.
 */
export function parseDevOpsId(text: string): DevOpsIdInput {
  const trimmed = text.trim().replace(/^#\s*/, '')
  if (trimmed === '') return { ok: true, value: null }
  if (!/^\d+$/.test(trimmed)) return { ok: false }
  const value = Number(trimmed)
  return isDevOpsId(value) ? { ok: true, value } : { ok: false }
}

/** Id para mostrar num campo de texto: vazio quando não há. */
export function devOpsIdToText(value: number | null): string {
  return value === null ? '' : String(value)
}

type StoredInterval = Omit<Interval, 'workItemId' | 'taskId' | 'declared'> &
  Partial<Record<'workItemId' | 'taskId' | 'declared', unknown>>

/**
 * Completa um intervalo gravado antes dos campos do Azure DevOps (banco na versão 1 ou backup
 * antigo): sem work item, sem task e não declarado. Valores inválidos também viram o padrão.
 */
export function withDevOpsDefaults(row: StoredInterval): Interval {
  return {
    ...row,
    workItemId: isDevOpsId(row.workItemId) ? row.workItemId : EMPTY_DEVOPS_FIELDS.workItemId,
    taskId: isDevOpsId(row.taskId) ? row.taskId : EMPTY_DEVOPS_FIELDS.taskId,
    declared: row.declared === true,
  }
}

/** Resumo curto para a lista de intervalos, ex.: `WI 123567 · Task 123568`. Vazio sem nenhum id. */
export function formatDevOpsRefs(interval: Pick<Interval, 'workItemId' | 'taskId'>): string {
  const parts: string[] = []
  if (interval.workItemId !== null) parts.push(`WI ${interval.workItemId}`)
  if (interval.taskId !== null) parts.push(`Task ${interval.taskId}`)
  return parts.join(' · ')
}
