/** Formata minutos como H:MM (ex.: 285 → "4:45"). Valores negativos ganham "-". */
export function formatDuration(totalMinutes: number): string {
  const sign = totalMinutes < 0 ? '-' : ''
  const abs = Math.abs(Math.round(totalMinutes))
  const hours = Math.floor(abs / 60)
  const minutes = abs % 60
  return `${sign}${hours}:${String(minutes).padStart(2, '0')}`
}

/**
 * Minutos em horas decimais (escala de 100), como se declara no Azure DevOps, com 2 casas e meio para
 * cima. Com minutos inteiros o valor exato nunca cai num meio. Ex.: 35 → 0.58, 90 → 1.5.
 */
export function toDecimalHours(totalMinutes: number): number {
  return Math.round((Math.round(totalMinutes) * 100) / 60) / 100
}

/** Horas decimais com ponto e sem zeros à direita, ex.: 45 → "0.75 h", 120 → "2 h". */
export function formatDecimalHours(totalMinutes: number): string {
  return `${String(toDecimalHours(totalMinutes))} h`
}
