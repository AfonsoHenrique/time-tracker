import { addWeeks } from 'date-fns'
import { BalanceStat, Stat } from '../../components/Stat'
import { intervalsOfDay, summarizeWeek, type DaySummary } from '../../lib/balance'
import { formatWeekdayShort, formatWeekTitle } from '../../lib/clock'
import { formatDuration } from '../../lib/duration'
import { findIrregularities } from '../../lib/irregular'
import { dayKey, parseDayKey, weekRange } from '../../lib/time'
import type { Interval } from '../../lib/types'
import { useNow } from '../shared/useNow'
import { useWeekData, type WeekData } from '../shared/useWeekData'
import './week.css'

interface Props {
  /** Algum dia da semana, vindo da rota. `null` segue a semana atual. */
  day: string | null
  onChangeWeek: (day: string | null) => void
  onOpenDay: (day: string | null) => void
}

export function WeekScreen({ day: selected, onChangeWeek, onOpenDay }: Props) {
  const now = useNow(1000)
  const today = dayKey(now)
  const range = weekRange(selected ?? today)
  const isCurrent = range.start === weekRange(today).start
  const { data } = useWeekData(range.start)

  const shift = (amount: number) => {
    const start = dayKey(addWeeks(parseDayKey(range.start), amount))
    onChangeWeek(start === weekRange(today).start ? null : start)
  }

  return (
    <main className="app week">
      <header className="day-nav">
        <button type="button" className="icon-button" aria-label="Semana anterior" onClick={() => shift(-1)}>
          ‹
        </button>
        <h1 className="day-title">{formatWeekTitle(range, now)}</h1>
        <button type="button" className="icon-button" aria-label="Próxima semana" onClick={() => shift(1)}>
          ›
        </button>
      </header>
      {!isCurrent && (
        <button type="button" className="button back-today" onClick={() => onChangeWeek(null)}>
          Esta semana
        </button>
      )}

      {data === null ? (
        <p className="muted loading">Carregando…</p>
      ) : (
        <WeekBody
          weekStart={range.start}
          data={data}
          now={now}
          today={today}
          onOpenDay={onOpenDay}
        />
      )}
    </main>
  )
}

interface WeekBodyProps {
  weekStart: string
  data: WeekData
  now: Date
  today: string
  onOpenDay: (day: string | null) => void
}

function WeekBody({ weekStart, data, now, today, onOpenDay }: WeekBodyProps) {
  const week = summarizeWeek(weekStart, data.weekIntervals, data.daysOff, data.settings, now)
  return (
    <>
      <ul className="week-days" aria-label="Dias da semana">
        {week.days.map((summary) => (
          <li key={summary.date}>
            <DayRow
              summary={summary}
              intervals={data.weekIntervals}
              now={now}
              isToday={summary.date === today}
              onOpen={() => onOpenDay(summary.date === today ? null : summary.date)}
            />
          </li>
        ))}
      </ul>

      <section className="stats" aria-label="Totais da semana">
        <Stat label="Trabalhado" minutes={week.worked} />
        <Stat label="Meta" minutes={week.target} />
        <BalanceStat label="na semana" remaining={week.remaining} extra={week.extra} />
      </section>
    </>
  )
}

interface DayRowProps {
  summary: DaySummary
  intervals: readonly Interval[]
  now: Date
  isToday: boolean
  onOpen: () => void
}

function DayRow({ summary, intervals, now, isToday, onOpen }: DayRowProps) {
  const irregular =
    findIrregularities({
      date: summary.date,
      intervals: intervalsOfDay(intervals, summary.date),
      target: summary.target,
      now,
    }).length > 0

  const target = summary.isDayOff ? 'sem meta' : summary.target > 0 ? `meta ${formatDuration(summary.target)}` : ''

  return (
    <button
      type="button"
      className={`week-day${isToday ? ' week-day-today' : ''}`}
      aria-current={isToday ? 'date' : undefined}
      onClick={onOpen}
    >
      <span className="week-day-name">{formatWeekdayShort(summary.date)}</span>
      <span className="week-day-flag">
        {irregular && (
          <span className="week-day-warning" role="img" aria-label="Dia irregular" title="Dia irregular">
            ⚠
          </span>
        )}
      </span>
      <span className="week-day-target muted">{target}</span>
      <span className="week-day-worked">{formatDuration(summary.worked)}</span>
    </button>
  )
}
