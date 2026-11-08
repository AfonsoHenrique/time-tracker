import type { Screen } from '../lib/route'
import './TabBar.css'

const TABS: { screen: Screen; label: string }[] = [
  { screen: 'today', label: 'Hoje' },
  { screen: 'week', label: 'Semana' },
]

interface Props {
  current: Screen
  onSelect: (screen: Screen) => void
}

/** Abas fixas no rodapé. */
export function TabBar({ current, onSelect }: Props) {
  return (
    <nav className="tab-bar" aria-label="Telas">
      {TABS.map(({ screen, label }) => (
        <button
          key={screen}
          type="button"
          className="tab"
          aria-current={screen === current ? 'page' : undefined}
          onClick={() => onSelect(screen)}
        >
          {label}
        </button>
      ))}
    </nav>
  )
}
