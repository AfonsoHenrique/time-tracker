import { RepositoryError } from '../../db/repository'

const MESSAGES: Partial<Record<RepositoryError['code'], string>> = {
  'open-interval-exists': 'Já existe um intervalo aberto. Feche-o antes de abrir outro.',
  'no-open-interval': 'Não há intervalo aberto para fechar.',
  'not-found': 'Esse intervalo não existe mais.',
}

/** Mensagem para a tela a partir de um erro do repositório ou inesperado. */
export function errorMessage(error: unknown): string {
  if (error instanceof RepositoryError) return MESSAGES[error.code] ?? error.message
  console.error(error)
  return 'Não foi possível salvar. Tente de novo.'
}
