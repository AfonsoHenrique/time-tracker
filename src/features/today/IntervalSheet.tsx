import { useEffect, useRef, useState, type FormEvent } from 'react'
import { formatShortDay, intervalToForm, readIntervalForm, type IntervalForm } from '../../lib/clock'
import type { Interval } from '../../lib/types'
import { errorMessage } from './errors'

export interface IntervalValues {
  start: Date
  end: Date | null
  note: string
}

interface Props {
  /** Dia mostrado na tela; um intervalo novo começa nele. */
  day: string
  /** Intervalo a editar. Sem ele, a folha adiciona um novo. */
  interval?: Interval
  onSave: (values: IntervalValues) => Promise<void>
  onDelete?: () => Promise<void>
  onClose: () => void
}

/** Folha para adicionar, editar ou apagar um intervalo. */
export function IntervalSheet({ day, interval, onSave, onDelete, onClose }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [form, setForm] = useState<IntervalForm>(() => intervalToForm(day, interval))
  const [error, setError] = useState<string | null>(null)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const dialog = dialogRef.current
    if (dialog && !dialog.open) dialog.showModal()
  }, [])

  const update = (patch: Partial<IntervalForm>) => {
    setForm((current) => ({ ...current, ...patch }))
    setError(null)
  }

  const attempt = async (action: () => Promise<void>) => {
    setBusy(true)
    try {
      await action()
      dialogRef.current?.close()
    } catch (caught) {
      setError(errorMessage(caught))
    } finally {
      setBusy(false)
    }
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const result = readIntervalForm(form)
    if (!result.ok) {
      setError(result.error)
      return
    }
    void attempt(() => onSave(result))
  }

  const endsOtherDay = form.endDay !== form.day

  return (
    <dialog ref={dialogRef} className="sheet" onClose={onClose} aria-labelledby="sheet-title">
      <form onSubmit={submit} noValidate>
        <h2 id="sheet-title">{interval ? 'Editar intervalo' : 'Adicionar intervalo'}</h2>

        <div className="sheet-times">
          <label>
            Início
            <input
              type="time"
              required
              value={form.start}
              onChange={(e) => update({ start: e.target.value })}
            />
          </label>
          <label>
            Fim{endsOtherDay && <span className="muted"> ({formatShortDay(form.endDay)})</span>}
            <input type="time" value={form.end} onChange={(e) => update({ end: e.target.value })} />
          </label>
        </div>
        <p className="sheet-hint">Deixe o fim vazio se o intervalo ainda está em andamento.</p>

        <label>
          Observação
          <input
            type="text"
            value={form.note}
            placeholder="Opcional"
            onChange={(e) => update({ note: e.target.value })}
          />
        </label>

        {error && (
          <p className="sheet-error" role="alert">
            {error}
          </p>
        )}

        {confirmingDelete && onDelete ? (
          <div className="sheet-actions">
            <span className="sheet-confirm">Apagar este intervalo?</span>
            <button type="button" className="button" onClick={() => setConfirmingDelete(false)} disabled={busy}>
              Cancelar
            </button>
            <button
              type="button"
              className="button button-danger"
              onClick={() => void attempt(onDelete)}
              disabled={busy}
            >
              Apagar
            </button>
          </div>
        ) : (
          <div className="sheet-actions">
            {onDelete && (
              <button
                type="button"
                className="button button-link-danger"
                onClick={() => setConfirmingDelete(true)}
                disabled={busy}
              >
                Apagar
              </button>
            )}
            <button type="button" className="button" onClick={() => dialogRef.current?.close()} disabled={busy}>
              Cancelar
            </button>
            <button type="submit" className="button button-primary" disabled={busy}>
              Salvar
            </button>
          </div>
        )}
      </form>
    </dialog>
  )
}
