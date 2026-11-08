import { useState } from 'react'
import { countOpenInRange, exportFileName, exportRows, toCsv, toTsv } from '../../lib/export'
import type { DayRange, Interval } from '../../lib/types'
import './ExportPanel.css'

interface Props {
  range: DayRange
  /** Intervalos carregados; só os que começam na faixa entram. */
  intervals: readonly Interval[]
}

type Feedback = { kind: 'ok' | 'error'; text: string } | null

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

/** Copiar para o Excel (TSV sem cabeçalho) e baixar CSV, no formato da aba SEMANA. */
export function ExportPanel({ range, intervals }: Props) {
  const [feedback, setFeedback] = useState<Feedback>(null)
  const rows = exportRows(intervals, range)
  const open = countOpenInRange(intervals, range)
  const empty = rows.length === 0

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(toTsv(rows))
      setFeedback({ kind: 'ok', text: `${plural(rows.length, 'linha copiada', 'linhas copiadas')}.` })
    } catch (error) {
      console.error(error)
      setFeedback({ kind: 'error', text: 'Não foi possível copiar. Use "Baixar CSV".' })
    }
  }

  const download = () => {
    const blob = new Blob([toCsv(rows)], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = exportFileName(range)
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    setFeedback({ kind: 'ok', text: 'Arquivo baixado.' })
  }

  return (
    <section className="export" aria-label="Exportar">
      <h2>Exportar</h2>
      <p className="muted export-summary">
        {empty ? 'Nenhum intervalo fechado nestes dias.' : plural(rows.length, 'intervalo', 'intervalos')}
        {open > 0 && ` · ${plural(open, 'intervalo em andamento ficou de fora', 'intervalos em andamento ficaram de fora')}`}
      </p>
      <div className="export-actions">
        <button type="button" className="button button-primary" onClick={() => void copy()} disabled={empty}>
          Copiar para o Excel
        </button>
        <button type="button" className="button" onClick={download} disabled={empty}>
          Baixar CSV
        </button>
      </div>
      {feedback && (
        <p className={feedback.kind === 'ok' ? 'export-ok' : 'export-error'} role="status">
          {feedback.text}
        </p>
      )}
    </section>
  )
}
