/** Tema escolhido na aba Dados (spec 012). `system` segue o tema do aparelho. */
export type ThemeChoice = 'system' | 'light' | 'dark'

export const THEME_CHOICES: readonly ThemeChoice[] = ['system', 'light', 'dark']

export const THEME_LABELS: Record<ThemeChoice, string> = { system: 'Sistema', light: 'Claro', dark: 'Escuro' }

/**
 * Chave do `localStorage` com o tema. É a mesma em produção e homologação, que dividem o endereço.
 * O script do `index.html` lê a mesma chave para aplicar o tema antes do primeiro quadro.
 */
export const THEME_KEY = 'ponto-theme'

/** Lê o valor guardado. Qualquer coisa desconhecida ou ausente vira `system`. */
export function parseThemeChoice(value: unknown): ThemeChoice {
  return value === 'light' || value === 'dark' ? value : 'system'
}
