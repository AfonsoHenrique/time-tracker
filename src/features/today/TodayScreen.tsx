import { addDays } from 'date-fns'
import { useState } from 'react'
import { BalanceStat, Stat } from '../../components/Stat'
import { getRepository } from '../../db/repository'
import { intervalMinutes, intervalsOfDay, summarizeDay, summarizeWeek } from '../../lib/balance'
import { formatDayTitle, formatElapsed, formatShortDay, formatTime } from '../../lib/clock'
import { formatDuration } from '../../lib/duration'
import { describeIrregularity, findIrregularities } from '../../lib/irregular'
import { dayKey, isWorkDay, parseDayKey } from '../../lib/time'
import type { Interval } from '../../lib/types'
import { errorMessage } from '../shared/errors'
import { useNow } from '../shared/useNow'
import { useWeekData, type WeekData } from '../shared/useWeekData'
import { IntervalSheet, type IntervalValues } from './IntervalSheet'
import './today.css'

type Editing = { kind: 'new' } | { kind: 'edit'; interval: Interval }
type Run = (action: () => Promise<unknown>) => Promise<void>

interface Props {
  /** Dia da rota. `null` segue o dia de hoje, inclusive quando a data vira com o app aberto. */
  day: string | null
  onChangeDay: (day: string | null) => void
}

export function TodayScreen({ day: selected, onChangeDay }: Props) {
  const now = useNow(1000)
  const today = dayKey(now)
  const day = selected ?? today
  const isToday = day === today
  const { data, run } = useWeekData(day)

  const goTo = (next: string) => onChangeDay(next === today ? null : next)
  const shift = (amount: number) => goTo(dayKey(addDays(parseDayKey(day), amount)))

  return (
    <main className="app today">
      <header className="day-nav">
        <button type="button" className="icon-button" aria-label="Dia anterior" onClick={() => shift(-1)}>
          ‹
        </button>
        <h1 className="day-title">{formatDayTitle(day, now)}</h1>
        <button type="button" className="icon-button" aria-label="Próximo dia" onClick={() => shift(1)}>
          ›
        </button>
      </header>
      {!isToday && (
        <button type="button" className="button back-today" onClick={() => goTo(today)}>
          Voltar para hoje
        </button>
      )}

      {data === null ? (
        <p className="muted loading">Carregando…</p>
      ) : (
        // A chave zera erros e a folha aberta ao trocar de dia.
        <DayView key={day} day={day} isToday={isToday} now={now} data={data} run={run} />
      )}
    </main>
  )
}

interface DayViewProps {
  day: string
  isToday: boolean
  now: Date
  data: WeekData
  run: Run
}

function DayView({ day, isToday, now, data, run }: DayViewProps) {
  const [editing, setEditing] = useState<Editing | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const repo = getRepository()

  const { settings, weekIntervals, daysOff, open } = data
  const intervals = intervalsOfDay(weekIntervals, day)
  const summary = summarizeDay(day, weekIntervals, daysOff, settings, now)
  const week = summarizeWeek(day, weekIntervals, daysOff, settings, now)
  const problems = findIrregularities({ date: day, intervals, target: summary.target, now })

  const act = (action: () => Promise<unknown>) => {
    setActionError(null)
    run(action).catch((error: unknown) => setActionError(errorMessage(error)))
  }

  const save = (target: Editing) => (values: IntervalValues) =>
    run(() =>
      target.kind === 'new' ? repo.createInterval(values) : repo.updateInterval(target.interval.id, values),
    )

  return (
    <>
      {isToday && (
        <section className="punch">
          <button
            type="button"
            className={`punch-button ${open ? 'punch-out' : 'punch-in'}`}
            onClick={() => act(() => (open ? repo.stopInterval(new Date()) : repo.startInterval(new Date())))}
          >
            {open ? 'Sair' : 'Entrar'}
          </button>
          {open && (
            <p className="timer">
              <span className="timer-value">{formatElapsed(open.start, now)}</span>
              <span className="muted">
                desde {formatTime(open.start)}
                {dayKey(open.start) !== day && ` de ${formatShortDay(dayKey(open.start))}`}
              </span>
            </p>
          )}
        </section>
      )}

      {actionError && (
        <p className="alert alert-error" role="alert">
          {actionError}
        </p>
      )}

      <section className="stats" aria-label="Resumo">
        <Stat label={isToday ? 'Trabalhado hoje' : 'Trabalhado'} minutes={summary.worked} />
        <BalanceStat label="no dia" remaining={summary.remaining} extra={summary.extra} />
        <BalanceStat label="na semana" remaining={week.remaining} extra={week.extra} />
      </section>
      <p className="target-line muted">
        Meta do dia {formatDuration(summary.target)} · da semana {formatDuration(week.target)}
      </p>

      {problems.length > 0 && (
        <div className="alert alert-warning" role="status">
          <strong>Dia irregular</strong>
          <ul>
            {problems.map((kind) => (
              <li key={kind}>{describeIrregularity(kind)}</li>
            ))}
          </ul>
        </div>
      )}

      {isWorkDay(day, settings) && (
        <label className="switch">
          <input
            type="checkbox"
            checked={summary.isDayOff}
            onChange={(e) => {
              const checked = e.target.checked
              act(() => (checked ? repo.setDayOff(day) : repo.removeDayOff(day)))
            }}
          />
          <span className="switch-text">
            Dia sem meta
            <span className="muted switch-hint">
              Feriado ou folga: tira {formatDuration(settings.dailyTargetMinutes)} da semana
            </span>
          </span>
        </label>
      )}

      <section className="intervals" aria-label="Intervalos">
        <h2>Intervalos</h2>
        {intervals.length === 0 ? (
          <p className="muted empty">Nenhum intervalo neste dia.</p>
        ) : (
          <ul>
            {intervals.map((interval) => (
              <li key={interval.id}>
                <button type="button" className="interval" onClick={() => setEditing({ kind: 'edit', interval })}>
                  <span className="interval-time">
                    {formatTime(interval.start)} – {interval.end === null ? 'agora' : formatTime(interval.end)}
                  </span>
                  <span className="interval-duration">{formatDuration(intervalMinutes(interval, now))}</span>
                  {interval.note && <span className="interval-note">{interval.note}</span>}
                </button>
              </li>
            ))}
          </ul>
        )}
        <button type="button" className="button add-interval" onClick={() => setEditing({ kind: 'new' })}>
          + Adicionar intervalo
        </button>
      </section>

      {editing && (
        <IntervalSheet
          day={day}
          interval={editing.kind === 'edit' ? editing.interval : undefined}
          onSave={save(editing)}
          onDelete={
            editing.kind === 'edit' ? () => run(() => repo.deleteInterval(editing.interval.id)) : undefined
          }
          onClose={() => setEditing(null)}
        />
      )}
    </>
  )
}
