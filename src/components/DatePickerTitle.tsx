import { useRef } from 'react'
import './DatePickerTitle.css'

interface Props {
  /** Título mostrado (ex.: "Segunda, 9 de novembro"). */
  title: string
  /** Dia que o calendário abre marcado, `AAAA-MM-DD`. */
  value: string
  onPick: (day: string) => void
}

/** Título de tela que abre o calendário nativo ao ser tocado. Sem regra de negócio: só devolve o dia. */
export function DatePickerTitle({ title, value, onPick }: Props) {
  const input = useRef<HTMLInputElement>(null)

  const open = () => {
    const element = input.current
    if (!element) return
    try {
      element.showPicker()
    } catch {
      // Navegadores sem showPicker (ou que recusam a chamada): o foco no campo abre o seletor.
      element.focus()
      element.click()
    }
  }

  return (
    <h1 className="day-title date-picker-title">
      <button type="button" className="date-picker-button" onClick={open}>
        {title}
        <span className="date-picker-icon" aria-hidden="true">
          📅
        </span>
      </button>
      <input
        ref={input}
        type="date"
        className="date-picker-input"
        aria-label="Escolher data"
        tabIndex={-1}
        value={value}
        onChange={(e) => {
          if (e.target.value) onPick(e.target.value)
        }}
      />
    </h1>
  )
}
