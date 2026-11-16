import { DEVOPS_ID_MAX_DIGITS, EMPTY_DEVOPS_FIELDS, NOTE_MAX_LENGTH, PROJECT_MAX_LENGTH, type Interval } from './types'

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

/**
 * O que o campo de id deixa ficar enquanto se digita ou cola: só dígitos, até
 * `DEVOPS_ID_MAX_DIGITS`. Ex.: `#123 567a` vira `123567`.
 */
export function digitsOnly(text: string): string {
  return text.replace(/\D/g, '').slice(0, DEVOPS_ID_MAX_DIGITS)
}

/**
 * Observação sem espaços nas pontas. Só uma observação diferente de `original` precisa caber em
 * `NOTE_MAX_LENGTH`: uma antiga maior continua valendo enquanto não for alterada (spec 012).
 */
export function normalizeNote(text: string, original = ''): { ok: true; value: string } | { ok: false } {
  const value = text.trim()
  if (value.length <= NOTE_MAX_LENGTH || value === original.trim()) return { ok: true, value }
  return { ok: false }
}

/** Id para mostrar num campo de texto: vazio quando não há. */
export function devOpsIdToText(value: number | null): string {
  return value === null ? '' : String(value)
}

/** Projeto sem espaços nas pontas. Diz se cabe no limite de `PROJECT_MAX_LENGTH` caracteres. */
export function normalizeProject(text: string): { ok: true; value: string } | { ok: false } {
  const value = text.trim()
  return value.length <= PROJECT_MAX_LENGTH ? { ok: true, value } : { ok: false }
}

type DevOpsField = 'workItemId' | 'taskId' | 'declared' | 'project'
type StoredInterval = Omit<Interval, DevOpsField> & Partial<Record<DevOpsField, unknown>>

/**
 * Completa um intervalo gravado antes dos campos do Azure DevOps (banco na versão 1 ou 2, ou backup
 * antigo): sem work item, sem task, não declarado e sem projeto. Valores inválidos também viram o
 * padrão, e um projeto longo demais é cortado no limite.
 */
export function withDevOpsDefaults(row: StoredInterval): Interval {
  return {
    ...row,
    workItemId: isDevOpsId(row.workItemId) ? row.workItemId : EMPTY_DEVOPS_FIELDS.workItemId,
    taskId: isDevOpsId(row.taskId) ? row.taskId : EMPTY_DEVOPS_FIELDS.taskId,
    declared: row.declared === true,
    project:
      typeof row.project === 'string'
        ? row.project.trim().slice(0, PROJECT_MAX_LENGTH)
        : EMPTY_DEVOPS_FIELDS.project,
  }
}

/** Resumo curto para a lista de intervalos, ex.: `WI 123567 · Task 123568`. Vazio sem nenhum id. */
export function formatDevOpsRefs(interval: Pick<Interval, 'workItemId' | 'taskId'>): string {
  const parts: string[] = []
  if (interval.workItemId !== null) parts.push(`WI ${interval.workItemId}`)
  if (interval.taskId !== null) parts.push(`Task ${interval.taskId}`)
  return parts.join(' · ')
}
