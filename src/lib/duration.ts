/** Formata minutos como H:MM (ex.: 285 → "4:45"). Valores negativos ganham "-". */
export function formatDuration(totalMinutes: number): string {
  const sign = totalMinutes < 0 ? '-' : ''
  const abs = Math.abs(Math.round(totalMinutes))
  const hours = Math.floor(abs / 60)
  const minutes = abs % 60
  return `${sign}${hours}:${String(minutes).padStart(2, '0')}`
}
