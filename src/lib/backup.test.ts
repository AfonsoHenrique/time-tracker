import { describe, expect, it } from 'vitest'
import {
  backupFileName,
  buildBackup,
  formatBytes,
  formatDayBr,
  formatExportedAt,
  formatLastBackup,
  isBackupDue,
  parseBackup,
  type BackupData,
} from './backup'
import { at, iv } from './test-helpers'
import { DEFAULT_SETTINGS } from './types'

const now = new Date(at('2026-11-15 18:00'))

function sampleData(): BackupData {
  return {
    intervals: [
      { ...iv('2026-11-09 08:00', '2026-11-09 12:00', 'daily'), workItemId: 123567, taskId: 123568, declared: true },
      iv('2026-11-09 13:00', '2026-11-09 17:30'),
      iv('2026-11-14 09:00'),
    ],
    daysOff: [{ date: '2026-11-02', note: 'feriado' }],
    settings: { ...DEFAULT_SETTINGS, workDays: [...DEFAULT_SETTINGS.workDays] },
  }
}

const text = (value: unknown) => JSON.stringify(value)

describe('buildBackup e parseBackup', () => {
  it('ida e volta mantém os dados, com os mesmos ids (CA1)', () => {
    const data = sampleData()
    const file = buildBackup(data, now, 'prod')
    expect(file).toMatchObject({ app: 'ponto', version: 1, env: 'prod', exportedAt: now.toISOString() })
    const result = parseBackup(text(file))
    expect(result.ok && result.data).toEqual(data)
    expect(result.ok && result.summary).toEqual({
      env: 'prod',
      exportedAt: now.toISOString(),
      intervals: 3,
      firstDay: '2026-11-09',
      lastDay: '2026-11-14',
      daysOff: 1,
    })
  })

  it('JSON qualquer não é backup (CA2)', () => {
    expect(parseBackup('{"a":1}')).toEqual({ ok: false, error: 'Não é um backup do Ponto.' })
    expect(parseBackup('[]')).toEqual({ ok: false, error: 'Não é um backup do Ponto.' })
    expect(parseBackup('não é json')).toEqual({ ok: false, error: 'O arquivo não é um JSON válido.' })
  })

  it('versão desconhecida', () => {
    const file = { ...buildBackup(sampleData(), now, 'prod'), version: 2 }
    expect(parseBackup(text(file))).toEqual({
      ok: false,
      error: 'Versão de backup desconhecida (2). Atualize o app e tente de novo.',
    })
  })

  it('fim antes do início, com o número do intervalo (CA3)', () => {
    const file = buildBackup(sampleData(), now, 'prod')
    file.intervals[1] = { ...file.intervals[1], end: at('2026-11-09 12:59') }
    expect(parseBackup(text(file))).toEqual({ ok: false, error: 'Intervalo 2 com fim antes do início.' })
  })

  it('outros problemas de intervalo', () => {
    const base = buildBackup(sampleData(), now, 'prod')
    const withInterval = (patch: Record<string, unknown>) =>
      parseBackup(text({ ...base, intervals: [{ ...base.intervals[0], ...patch }] }))
    expect(withInterval({ start: 'ontem' })).toEqual({ ok: false, error: 'Intervalo 1 com início inválido.' })
    expect(withInterval({ id: '' })).toEqual({ ok: false, error: 'Intervalo 1 sem id.' })
    expect(withInterval({ taskId: 1.5 })).toEqual({ ok: false, error: 'Intervalo 1 com task inválida.' })
    expect(withInterval({ workItemId: '123' })).toEqual({ ok: false, error: 'Intervalo 1 com work item inválido.' })
  })

  it('ids repetidos e dois intervalos em andamento', () => {
    const base = buildBackup(sampleData(), now, 'prod')
    expect(parseBackup(text({ ...base, intervals: [base.intervals[0], base.intervals[0]] }))).toEqual({
      ok: false,
      error: 'Intervalo 2 repetido.',
    })
    const open2 = { ...base.intervals[1], id: 'outro', end: null }
    expect(parseBackup(text({ ...base, intervals: [...base.intervals, open2] }))).toEqual({
      ok: false,
      error: 'O backup tem mais de um intervalo em andamento.',
    })
  })

  it('dia sem meta e configurações inválidos', () => {
    const base = buildBackup(sampleData(), now, 'prod')
    expect(parseBackup(text({ ...base, daysOff: [{ date: '2026-02-30' }] }))).toEqual({
      ok: false,
      error: 'Dia sem meta 1 inválido.',
    })
    expect(parseBackup(text({ ...base, settings: { periodStartDay: 31 } }))).toEqual({
      ok: false,
      error: 'Configurações inválidas: O período mensal deve começar entre os dias 1 e 28.',
    })
  })

  it('backup da homologação é aceito e o resumo diz de onde veio (CA4)', () => {
    const result = parseBackup(text(buildBackup(sampleData(), now, 'hml')))
    expect(result.ok && result.summary.env).toBe('hml')
  })

  it('backup sem os campos do Azure DevOps fica com null, null e false (CA8)', () => {
    const old = {
      app: 'ponto',
      version: 1,
      exportedAt: now.toISOString(),
      env: 'prod',
      intervals: [{ id: 'a', start: at('2026-11-09 08:00'), end: at('2026-11-09 09:00'), note: '' }],
      daysOff: [],
    }
    const result = parseBackup(text(old))
    expect(result.ok && result.data.intervals[0]).toMatchObject({ workItemId: null, taskId: null, declared: false })
    expect(result.ok && result.data.settings).toEqual(DEFAULT_SETTINGS)
  })

  it('normaliza instantes para UTC no minuto', () => {
    const base = buildBackup(sampleData(), now, 'prod')
    const result = parseBackup(text({ ...base, intervals: [{ ...base.intervals[0], start: '2026-11-09T08:00:59-03:00', end: '2026-11-09T12:00:00Z' }] }))
    expect(result.ok && result.data.intervals[0].start).toBe('2026-11-09T11:00:00.000Z')
  })
})

describe('isBackupDue e formatLastBackup', () => {
  it('avisa depois de 14 dias (CA6)', () => {
    expect(isBackupDue(at('2026-11-12 10:00'), true, now)).toBe(false)
    expect(isBackupDue(at('2026-11-01 10:00'), true, now)).toBe(false)
    expect(isBackupDue(at('2026-10-31 10:00'), true, now)).toBe(true)
    // CA6: há 15 dias avisa; há 3 dias, não.
    expect(isBackupDue(at('2026-10-31 18:00'), true, now)).toBe(true)
    expect(isBackupDue(at('2026-11-12 18:00'), true, now)).toBe(false)
  })

  it('sem backup, avisa só se já há dados', () => {
    expect(isBackupDue(null, false, now)).toBe(false)
    expect(isBackupDue(null, true, now)).toBe(true)
  })

  it('texto do último backup', () => {
    expect(formatLastBackup(null, now)).toBe('nunca')
    expect(formatLastBackup(at('2026-11-15 08:00'), now)).toBe('hoje')
    expect(formatLastBackup(at('2026-11-14 23:00'), now)).toBe('ontem')
    expect(formatLastBackup(at('2026-11-12 10:00'), now)).toBe('há 3 dias')
  })
})

describe('nomes e datas', () => {
  it('nome do arquivo e data brasileira', () => {
    expect(backupFileName(now)).toBe('ponto-backup-2026-11-15.json')
    expect(formatDayBr('2026-11-09')).toBe('09/11/2026')
    expect(formatExportedAt(at('2026-11-15 18:05'))).toBe('15/11/2026 às 18:05')
    expect(formatExportedAt('')).toBe('')
  })

  it('tamanho usado', () => {
    expect(formatBytes(850)).toBe('850 B')
    expect(formatBytes(2048)).toBe('2 KB')
    expect(formatBytes(1536)).toBe('1,5 KB')
    expect(formatBytes(12.4 * 1024)).toBe('12 KB')
    expect(formatBytes(1.5 * 1024 * 1024)).toBe('1,5 MB')
  })
})
