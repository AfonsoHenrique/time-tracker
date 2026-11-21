import { getRepository } from '../../db/repository'
import { backupFileName, buildBackup } from '../../lib/backup'
import { APP_ENV, IS_DEMO } from '../../lib/env'
import { saveLastBackup } from '../shared/lastBackup'

/** Baixa o backup de tudo o que está no aparelho. Devolve quando foi feito e quantos intervalos levou. */
export async function downloadBackup(): Promise<{ exportedAt: Date; intervals: number }> {
  const exportedAt = new Date()
  const data = await getRepository().exportAll()
  const json = JSON.stringify(buildBackup(data, exportedAt, APP_ENV), null, 2)
  const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }))
  const link = document.createElement('a')
  link.href = url
  link.download = backupFileName(exportedAt, IS_DEMO)
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  saveLastBackup(exportedAt)
  return { exportedAt, intervals: data.intervals.length }
}
