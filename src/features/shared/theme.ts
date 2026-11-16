import { parseThemeChoice, THEME_KEY, type ThemeChoice } from '../../lib/theme'

/** Tema guardado neste aparelho. Sem `localStorage` (aba privada), segue o sistema. */
export function readThemeChoice(): ThemeChoice {
  try {
    return parseThemeChoice(localStorage.getItem(THEME_KEY))
  } catch {
    return 'system'
  }
}

export function saveThemeChoice(choice: ThemeChoice): void {
  try {
    if (choice === 'system') localStorage.removeItem(THEME_KEY)
    else localStorage.setItem(THEME_KEY, choice)
  } catch {
    // Sem localStorage, a escolha vale só até fechar a aba.
  }
}

/** Fixa o tema no `<html>` (`data-theme`), ou tira a marca para seguir o sistema. */
export function applyTheme(choice: ThemeChoice): void {
  const root = document.documentElement
  if (choice === 'system') root.removeAttribute('data-theme')
  else root.dataset.theme = choice
}
