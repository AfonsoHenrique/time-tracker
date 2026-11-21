import type { Settings } from './types'

/** O que há de errado nas configurações, em texto para a tela, ou `null` se estão válidas. */
export function settingsProblem(settings: Settings): string | null {
  const { dailyTargetMinutes, workDays, periodStartDay } = settings
  if (!Number.isInteger(dailyTargetMinutes) || dailyTargetMinutes < 0) {
    return 'A meta diária deve ser um número inteiro de minutos, zero ou mais.'
  }
  if (
    !Array.isArray(workDays) ||
    new Set(workDays).size !== workDays.length ||
    workDays.some((d) => !Number.isInteger(d) || d < 1 || d > 7)
  ) {
    return 'Os dias úteis devem ser números de 1 (segunda) a 7 (domingo), sem repetir.'
  }
  if (!Number.isInteger(periodStartDay) || periodStartDay < 1 || periodStartDay > 28) {
    return 'O período mensal deve começar entre os dias 1 e 28.'
  }
  if (typeof settings.launchRoundQuarter !== 'boolean' || typeof settings.launchClose !== 'boolean') {
    return 'As opções de lançamento no Azure DevOps devem ser sim ou não.'
  }
  return null
}
