import { addDays, addMonths } from 'date-fns'
import { BalanceStat, Stat } from '../../components/Stat'
import { summarizeRange } from '../../lib/balance'
import { formatRangeTitle, formatShortDay } from '../../lib/clock'
import { formatDuration } from '../../lib/duration'
import { isIrregularDay } from '../../lib/irregular'
import { dayKey, parseDayKey, periodRange, weekRange } from '../../lib/time'
import type { DayRange } from '../../lib/types'
import { ExportPanel } from '../shared/ExportPanel'
import { useNow } from '../shared/useNow'
import { useRangeData, type RangeData } from '../shared/useRangeData'
import '../week/week.css'

interface Props {
  /** Algum dia do período, vindo da rota. `null` segue o período atual. */
  day: string | null
  onChangePeriod: (day: string | null) => void
  onOpenWeek: (weekStart: string) => void
}

export function PeriodScreen({ day: selected, onChangePeriod, onOpenWeek }: Props) {
  const now = useNow(1000)
  const today = dayKey(now)
  const { data } = useRangeData('period', selected ?? today)
  const range = data?.range
  const isCurrent = range ? today >= range.start && today <= range.end : true

  const shift = (amount: number) => {
    if (!data) return
    const anchor = dayKey(addMonths(parseDayKey(data.range.start), amount))
    const next = periodRange(anchor, data.settings.periodStartDay)
    onChangePeriod(today >= next.start && today <= next.end ? null : anchor)
  }

  return (
    <main className="app period">
      <header className="day-nav">
        <button type="button" className="icon-button" aria-label="Período anterior" onClick={() => shift(-1)}>
          ‹
        </button>
        <h1 className="day-title">{range ? formatRangeTitle(range, now) : ' '}</h1>
        <button type="button" className="icon-button" aria-label="Próximo período" onClick={() => shift(1)}>
          ›
        </button>
      </header>
      {!isCurrent && (
        <button type="button" className="button back-today" onClick={() => onChangePeriod(null)}>
          Este período
        </button>
      )}

      {data === null ? (
        <p className="muted loading">Carregando…</p>
      ) : (
        <PeriodBody data={data} now={now} today={today} onOpenWeek={onOpenWeek} />
      )}
    </main>
  )
}

/** Semanas que tocam o período, cada uma cortada aos dias de dentro dele. */
function weeksOf(range: DayRange): { week: DayRange; inside: DayRange }[] {
  const weeks = []
  for (let start = weekRange(range.start).start; start <= range.end; start = dayKey(addDays(parseDayKey(start), 7))) {
    const week = weekRange(start)
    weeks.push({
      week,
      inside: {
        start: week.start < range.start ? range.start : week.start,
        end: week.end > range.end ? range.end : week.end,
      },
    })
  }
  return weeks
}

interface BodyProps {
  data: RangeData
  now: Date
  today: string
  onOpenWeek: (weekStart: string) => void
}

function PeriodBody({ data, now, today, onOpenWeek }: BodyProps) {
  const { range, intervals, daysOff, settings } = data
  const total = summarizeRange(range, intervals, daysOff, settings, now)

  return (
    <>
      <section className="stats" aria-label="Totais do período">
        <Stat label="Trabalhado" minutes={total.worked} />
        <Stat label="Meta" minutes={total.target} />
        <BalanceStat label="no período" remaining={total.remaining} extra={total.extra} />
      </section>

      <ul className="week-days" aria-label="Semanas do período">
        {weeksOf(range).map(({ week, inside }) => {
          const summary = summarizeRange(inside, intervals, daysOff, settings, now)
          const irregular = summary.days.some((day) => isIrregularDay(day, intervals, now))
          const isCurrent = today >= week.start && today <= week.end
          return (
            <li key={week.start}>
              <button
                type="button"
                className={`week-day period-week${isCurrent ? ' week-day-today' : ''}`}
                aria-current={isCurrent ? 'date' : undefined}
                onClick={() => onOpenWeek(week.start)}
              >
                <span className="week-day-name">
                  {formatShortDay(inside.start)} a {formatShortDay(inside.end)}
                </span>
                <span className="week-day-flag">
                  {irregular && (
                    <span className="week-day-warning" role="img" aria-label="Semana com dia irregular" title="Dia irregular">
                      ⚠
                    </span>
                  )}
                </span>
                <span className="week-day-target muted">
                  {summary.target > 0 ? `meta ${formatDuration(summary.target)}` : ''}
                </span>
                <span className="week-day-worked">{formatDuration(summary.worked)}</span>
              </button>
            </li>
          )
        })}
      </ul>

      <ExportPanel range={range} intervals={intervals} />
    </>
  )
}
