import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import { getRepository } from '../../db/repository'
import { createDevOpsClient, devOpsErrorText } from '../../devops/client'
import type { DevOpsConnection } from '../../devops/connection'
import { updateConnection } from '../../devops/connection'
import { loadPreview, runLaunch, type LaunchResult, type TaskPreview } from '../../devops/launch'
import { launchStates, planLaunch, type LaunchPlan } from '../../lib/devopsLaunch'
import { formatShortDay } from '../../lib/clock'
import { formatDecimalHours, formatDuration } from '../../lib/duration'
import { IS_DEMO } from '../../lib/env'
import { weekRange } from '../../lib/time'
import type { DayRange, Interval, Settings } from '../../lib/types'
import { useDevOpsConnection } from './useDevOpsConnection'
import './devops.css'

interface Props {
  /** Semana ou período mostrado. */
  range: DayRange
  intervals: readonly Interval[]
  settings: Settings
  /** Executa a ação e recarrega a tela (`useRangeData().run`). */
  run: (action: () => Promise<unknown>) => Promise<void>
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

/** Botão "Lançar no Azure DevOps" da Semana e do Período (spec 013, R17–R18). */
export function LaunchPanel({ range, intervals, settings, run }: Props) {
  const connection = useDevOpsConnection()
  const [open, setOpen] = useState(false)
  const [offline, setOffline] = useState(false)
  const [stage, setStage] = useState<Stage>({ kind: 'loading' })
  const [types, setTypes] = useState<Record<number, string>>({})
  const request = useRef(0)
  const plan = planLaunch(intervals, { roundQuarter: settings.launchRoundQuarter })
  const pending = plan.tasks.length

  if (IS_DEMO) return null

  /** Lê as tasks no Azure DevOps. Uma leitura mais nova descarta a anterior. */
  const readPreview = async (current: DevOpsConnection) => {
    const id = ++request.current
    setStage({ kind: 'loading' })
    try {
      const full = await fullPlan(range, plan, settings.launchRoundQuarter)
      const previews = await loadPreview(createDevOpsClient(current.organization, current.pat), full, current.fields)
      if (request.current !== id) return
      setTypes(
        Object.fromEntries(
          previews
            .filter((p): p is OkPreview => p.ok)
            .map((p) => [p.plan.taskId, p.currentActivityType || current.lastActivityType || '']),
        ),
      )
      setStage({ kind: 'preview', previews })
    } catch (error) {
      if (request.current === id) setStage({ kind: 'error', text: devOpsErrorText(error) })
    }
  }

  const start = () => {
    if (!connection) return
    if (!navigator.onLine) {
      setOffline(true)
      return
    }
    setOffline(false)
    setOpen(true)
    void readPreview(connection)
  }

  const closeSheet = () => {
    request.current += 1
    setOpen(false)
  }

  return (
    <section className="launch" aria-label="Azure DevOps">
      <h2>Azure DevOps</h2>
      <p className="muted launch-summary">
        {pending === 0 ? 'Nenhuma task com horas para lançar.' : `${plural(pending, 'task', 'tasks')} com horas para lançar`}
        {plan.withoutTask.count > 0 &&
          ` · ${plural(plan.withoutTask.count, 'intervalo', 'intervalos')} sem task (${formatDuration(plan.withoutTask.minutes)})`}
      </p>
      {connection ? (
        <button type="button" className="button button-primary launch-button" disabled={pending === 0} onClick={start}>
          {pending === 0 ? 'Nada para lançar' : 'Lançar no Azure DevOps'}
        </button>
      ) : (
        <a className="button launch-button" href="#/dados">
          Conectar o Azure DevOps na aba Dados
        </a>
      )}
      {offline && (
        <p className="launch-error" role="alert">
          Sem conexão. O lançamento precisa de internet.
        </p>
      )}
      {open && connection && (
        <LaunchSheet
          connection={connection}
          withoutTask={plan.withoutTask}
          close={settings.launchClose}
          stage={stage}
          setStage={setStage}
          types={types}
          setTypes={setTypes}
          run={run}
          onReadAgain={() => void readPreview(connection)}
          onClose={closeSheet}
        />
      )}
    </section>
  )
}

type OkPreview = Extract<TaskPreview, { ok: true }>

/**
 * Como as horas e os detalhes da task são substituídos, cada task leva os seus intervalos das
 * semanas inteiras, mesmo os que ficam fora do período mostrado (o período 26–25 corta semanas).
 * Só entram as tasks do plano da tela.
 */
async function fullPlan(range: DayRange, plan: LaunchPlan, roundQuarter: boolean): Promise<LaunchPlan> {
  const ids = new Set(plan.tasks.map((task) => task.taskId))
  const all = await getRepository().listIntervals(weekRange(range.start).start, weekRange(range.end).end)
  const full = planLaunch(
    all.filter((interval) => interval.taskId !== null && ids.has(interval.taskId)),
    { roundQuarter },
  )
  return { tasks: full.tasks, withoutTask: plan.withoutTask }
}

type Stage =
  | { kind: 'loading' }
  | { kind: 'error'; text: string }
  | { kind: 'preview'; previews: TaskPreview[] }
  | { kind: 'sending'; previews: TaskPreview[] }
  | { kind: 'done'; results: LaunchResult[] }

interface SheetProps {
  connection: DevOpsConnection
  withoutTask: LaunchPlan['withoutTask']
  close: boolean
  stage: Stage
  setStage: (stage: Stage) => void
  types: Record<number, string>
  setTypes: Dispatch<SetStateAction<Record<number, string>>>
  run: Props['run']
  onReadAgain: () => void
  onClose: () => void
}

function LaunchSheet(props: SheetProps) {
  const { connection, withoutTask, close, stage, setStage, types, setTypes, run, onReadAgain, onClose } = props
  const dialogRef = useRef<HTMLDialogElement>(null)
  const client = createDevOpsClient(connection.organization, connection.pat)
  const mapped = connection.fields.activityType !== null

  useEffect(() => {
    const dialog = dialogRef.current
    if (dialog && !dialog.open) dialog.showModal()
  }, [])

  const ready = stage.kind === 'preview' ? stage.previews.filter((p): p is OkPreview => p.ok) : []
  const missingType = mapped && ready.some((p) => (types[p.plan.taskId] ?? '') === '')

  const confirm = async () => {
    if (stage.kind !== 'preview') return
    setStage({ kind: 'sending', previews: stage.previews })
    let results: LaunchResult[] = []
    await run(async () => {
      results = await runLaunch({
        client,
        tasks: ready.map((preview) => ({ preview, activityType: types[preview.plan.taskId] || null })),
        fields: connection.fields,
        assignedTo: connection.account.uniqueName,
        close,
        markDeclared: (ids) => getRepository().markDeclared(ids),
      })
    })
    const used = ready.map((p) => types[p.plan.taskId]).find((value) => value)
    if (used) updateConnection({ lastActivityType: used })
    setStage({ kind: 'done', results })
  }

  const busy = stage.kind === 'loading' || stage.kind === 'sending'

  return (
    <dialog ref={dialogRef} className="sheet launch-sheet" onClose={onClose} aria-labelledby="launch-title">
      <h2 id="launch-title">Lançar no Azure DevOps</h2>

      {stage.kind === 'loading' && <p className="muted">Lendo as tasks no Azure DevOps…</p>}
      {stage.kind === 'error' && (
        <p className="launch-error" role="alert">
          {stage.text}
        </p>
      )}

      {(stage.kind === 'preview' || stage.kind === 'sending') && (
        <>
          <ul className="launch-tasks">
            {stage.previews.map((preview) => (
              <li key={preview.plan.taskId}>
                <TaskCard
                  preview={preview}
                  close={close}
                  mapped={mapped}
                  type={types[preview.plan.taskId] ?? ''}
                  disabled={stage.kind === 'sending'}
                  onType={(value) => setTypes((current) => ({ ...current, [preview.plan.taskId]: value }))}
                />
              </li>
            ))}
          </ul>
          {withoutTask.count > 0 && (
            <p className="muted launch-note">
              {plural(withoutTask.count, 'intervalo sem task fica', 'intervalos sem task ficam')} de fora (
              {formatDuration(withoutTask.minutes)}).
            </p>
          )}
          {missingType && <p className="launch-note">Escolha o tipo de atividade de cada task.</p>}
        </>
      )}

      {stage.kind === 'done' && <Results results={stage.results} />}

      <div className="sheet-actions">
        {stage.kind === 'done' || stage.kind === 'error' ? (
          <>
            {(stage.kind === 'error' || stage.results.some((r) => r.status === 'failed')) && (
              <button type="button" className="button" onClick={onReadAgain}>
                Ler de novo
              </button>
            )}
            <button type="button" className="button button-primary" onClick={() => dialogRef.current?.close()}>
              Fechar
            </button>
          </>
        ) : (
          <>
            <button type="button" className="button" onClick={() => dialogRef.current?.close()} disabled={stage.kind === 'sending'}>
              Cancelar
            </button>
            <button
              type="button"
              className="button button-primary"
              onClick={() => void confirm()}
              disabled={busy || ready.length === 0 || missingType}
            >
              {stage.kind === 'sending'
                ? 'Lançando…'
                : ready.length > 1
                  ? `Lançar ${ready.length} tasks`
                  : 'Lançar'}
            </button>
          </>
        )}
      </div>
    </dialog>
  )
}

interface CardProps {
  preview: TaskPreview
  close: boolean
  mapped: boolean
  type: string
  disabled: boolean
  onType: (value: string) => void
}

function TaskCard({ preview, close, mapped, type, disabled, onType }: CardProps) {
  const { plan } = preview
  if (!preview.ok) {
    return (
      <article className="launch-task launch-task-off">
        <h3>Task {plan.taskId}</h3>
        <p className="launch-error">{preview.reason}</p>
        <p className="muted">{formatDecimalHours(plan.minutes)} ficam sem lançar.</p>
      </article>
    )
  }
  const { item } = preview
  const states = launchStates(item.state, close)
  const finalState = states.second ?? states.first
  const before = item.completedWork === null ? '0' : String(item.completedWork)
  const options = preview.activityTypes.includes(type) || type === '' ? preview.activityTypes : [type, ...preview.activityTypes]
  return (
    <article className="launch-task">
      <h3>
        {item.id} · {item.title}
      </h3>
      <dl className="launch-facts">
        <dt>Estado</dt>
        <dd>{finalState ? `${item.state} → ${finalState}` : item.state}</dd>
        <dt>Horas</dt>
        <dd>
          {before} → {formatDecimalHours(plan.minutes)}
        </dd>
        <dt>Datas</dt>
        <dd>
          {formatShortDay(plan.startDate)} a {formatShortDay(plan.targetDate)}
        </dd>
      </dl>
      {mapped && (
        <label className="launch-type">
          Tipo de atividade
          {options.length > 0 ? (
            <select value={type} onChange={(e) => onType(e.target.value)} disabled={disabled}>
              <option value="">Escolha…</option>
              {options.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          ) : (
            <input type="text" value={type} onChange={(e) => onType(e.target.value)} disabled={disabled} />
          )}
        </label>
      )}
      <details className="launch-lines">
        <summary>
          {plural(plan.lines.length, 'linha', 'linhas')} nos detalhes
          {plan.pendingCount < plan.lines.length && ` · ${plan.pendingCount} nova${plan.pendingCount === 1 ? '' : 's'}`}
        </summary>
        <ul>
          {plan.lines.map((line) => (
            <li key={line.intervalId}>{line.text}</li>
          ))}
        </ul>
      </details>
    </article>
  )
}

function Results({ results }: { results: LaunchResult[] }) {
  if (results.length === 0) return <p className="muted">Nada foi lançado.</p>
  return (
    <ul className="launch-results" role="status">
      {results.map((result) => (
        <li key={result.taskId} className={result.status === 'done' ? 'launch-ok' : 'launch-error'}>
          <strong>Task {result.taskId}</strong>:{' '}
          {result.status === 'done'
            ? `lançada em ${result.state}, ${plural(result.declared, 'intervalo marcado', 'intervalos marcados')} como declarado.`
            : result.reason}
        </li>
      ))}
    </ul>
  )
}
