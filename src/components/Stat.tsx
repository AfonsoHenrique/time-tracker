import { formatDuration } from '../lib/duration'
import './Stat.css'

/** Um número de resumo com rótulo, ex.: "Trabalhado hoje 5:30". */
export function Stat({ label, minutes }: { label: string; minutes: number }) {
  return (
    <div className="stat">
      <span className="stat-label">{label}</span>
      <span className="stat-value">{formatDuration(minutes)}</span>
    </div>
  )
}

/** "Falta …" enquanto não bateu a meta; "Excedente …", em verde, quando passou dela. */
export function BalanceStat({ label, remaining, extra }: { label: string; remaining: number; extra: number }) {
  return extra > 0 ? (
    <div className="stat stat-extra">
      <span className="stat-label">Excedente {label}</span>
      <span className="stat-value">+{formatDuration(extra)}</span>
    </div>
  ) : (
    <Stat label={`Falta ${label}`} minutes={remaining} />
  )
}
