import { useEffect, useState, type FormEvent } from 'react'
import { getRepository } from '../../db/repository'
import { createDevOpsClient, devOpsErrorText, type DevOpsField } from '../../devops/client'
import { clearConnection, saveConnection, updateConnection, type DevOpsConnection } from '../../devops/connection'
import { guessField, parseOrganization } from '../../lib/devopsLaunch'
import { IS_DEMO } from '../../lib/env'
import type { Settings } from '../../lib/types'
import { useDevOpsConnection } from './useDevOpsConnection'
import './devops.css'

type Feedback = { kind: 'ok' | 'error'; text: string } | null

/** Aba Dados: conexão com o Azure DevOps (só neste aparelho) e opções do lançamento (spec 013). */
export function DevOpsSection() {
  const connection = useDevOpsConnection()
  const [editing, setEditing] = useState(false)

  return (
    <section className="data-block" aria-labelledby="devops-title">
      <h2 id="devops-title">Azure DevOps</h2>
      {IS_DEMO ? (
        <p className="muted">No modo demo o app não fala com o Azure DevOps.</p>
      ) : connection && !editing ? (
        <Connected connection={connection} onChangeToken={() => setEditing(true)} />
      ) : (
        <ConnectForm
          initial={connection}
          onDone={() => setEditing(false)}
          onCancel={connection ? () => setEditing(false) : undefined}
        />
      )}
      {!IS_DEMO && <LaunchOptions />}
    </section>
  )
}

interface ConnectFormProps {
  initial: DevOpsConnection | null
  onDone: () => void
  onCancel?: () => void
}

function ConnectForm({ initial, onDone, onCancel }: ConnectFormProps) {
  const [organization, setOrganization] = useState(initial?.organization ?? '')
  const [pat, setPat] = useState('')
  const [feedback, setFeedback] = useState<Feedback>(null)
  const [busy, setBusy] = useState(false)
  const parsed = parseOrganization(organization)
  const tokensUrl = parsed.ok ? `https://dev.azure.com/${encodeURIComponent(parsed.value)}/_usersSettings/tokens` : null

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!parsed.ok) {
      setFeedback({ kind: 'error', text: 'Organização inválida. Use o nome que aparece em dev.azure.com/…' })
      return
    }
    if (pat.trim() === '') {
      setFeedback({ kind: 'error', text: 'Cole o token de acesso pessoal.' })
      return
    }
    setBusy(true)
    setFeedback(null)
    try {
      const client = createDevOpsClient(parsed.value, pat.trim())
      const account = await client.getAccount()
      let fields = initial?.organization === parsed.value ? initial.fields : null
      if (!fields) {
        const all = await client.listFields().catch(() => [])
        fields = {
          activityType: guessField(all, 'Tipo de atividade'),
          details: guessField(all, 'Detalhes do apontamento'),
        }
      }
      const saved = saveConnection({
        organization: parsed.value,
        pat: pat.trim(),
        account,
        fields,
        lastActivityType: initial?.lastActivityType ?? null,
      })
      if (!saved) {
        setFeedback({ kind: 'error', text: 'Este navegador não deixou guardar a conexão (aba privada?).' })
        return
      }
      onDone()
    } catch (error) {
      setFeedback({ kind: 'error', text: devOpsErrorText(error) })
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="devops-form" onSubmit={(event) => void submit(event)} noValidate>
      <p className="muted">
        Para lançar as horas nas tasks. Fica só neste aparelho: não vai para o backup nem para a sincronização.
      </p>
      <label>
        Organização
        <input
          type="text"
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          placeholder="minha-org ou https://dev.azure.com/minha-org"
          value={organization}
          onChange={(e) => setOrganization(e.target.value)}
        />
      </label>
      <label>
        Token de acesso pessoal (PAT)
        <input
          type="password"
          autoComplete="off"
          spellCheck={false}
          value={pat}
          onChange={(e) => setPat(e.target.value)}
        />
      </label>
      <p className="muted devops-hint">
        Crie o token com o escopo <strong>Work Items (Read &amp; write)</strong>
        {tokensUrl ? (
          <>
            {' '}
            em{' '}
            <a href={tokensUrl} target="_blank" rel="noreferrer">
              Personal access tokens
            </a>
          </>
        ) : (
          ' em User settings › Personal access tokens'
        )}
        .
      </p>
      <div className="devops-actions">
        {onCancel && (
          <button type="button" className="button" onClick={onCancel} disabled={busy}>
            Cancelar
          </button>
        )}
        <button type="submit" className="button button-primary" disabled={busy}>
          {busy ? 'Testando…' : 'Testar e salvar'}
        </button>
      </div>
      <FeedbackLine feedback={feedback} />
    </form>
  )
}

function Connected({ connection, onChangeToken }: { connection: DevOpsConnection; onChangeToken: () => void }) {
  const [confirming, setConfirming] = useState(false)
  return (
    <>
      <p className="devops-connected">
        ✓ Conectado a <strong>{connection.organization}</strong> como {connection.account.displayName}
      </p>
      <FieldMapping connection={connection} />
      {confirming ? (
        <div className="devops-actions">
          <span className="devops-confirm">Apagar o token deste aparelho?</span>
          <button type="button" className="button" onClick={() => setConfirming(false)}>
            Cancelar
          </button>
          <button type="button" className="button button-danger" onClick={clearConnection}>
            Desconectar
          </button>
        </div>
      ) : (
        <div className="devops-actions">
          <button type="button" className="button" onClick={() => setConfirming(true)}>
            Desconectar
          </button>
          <button type="button" className="button" onClick={onChangeToken}>
            Trocar token
          </button>
        </div>
      )}
    </>
  )
}

/** Escolha dos campos da organização para Tipo de atividade e Detalhes do apontamento (R6). */
function FieldMapping({ connection }: { connection: DevOpsConnection }) {
  const [fields, setFields] = useState<DevOpsField[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    createDevOpsClient(connection.organization, connection.pat)
      .listFields()
      .then(
        (list) => {
          if (alive) setFields(list)
        },
        (caught: unknown) => {
          if (alive) setError(devOpsErrorText(caught))
        },
      )
    return () => {
      alive = false
    }
  }, [connection.organization, connection.pat])

  const pick = (key: keyof DevOpsConnection['fields'], value: string) =>
    updateConnection({ fields: { ...connection.fields, [key]: value === '' ? null : value } })

  const select = (key: keyof DevOpsConnection['fields'], label: string) => {
    const current = connection.fields[key]
    const options = fields ?? []
    return (
      <label>
        {label}
        <select value={current ?? ''} onChange={(e) => pick(key, e.target.value)} disabled={fields === null}>
          <option value="">Não preencher</option>
          {current !== null && !options.some((f) => f.referenceName === current) && (
            <option value={current}>{current}</option>
          )}
          {options.map((f) => (
            <option key={f.referenceName} value={f.referenceName}>
              {f.name}
            </option>
          ))}
        </select>
      </label>
    )
  }

  return (
    <fieldset className="devops-fields">
      <legend>Campos da organização</legend>
      {select('activityType', 'Tipo de atividade')}
      {select('details', 'Detalhes do apontamento')}
      {error && <p className="data-error">{error}</p>}
    </fieldset>
  )
}

/** Opções do lançamento: ficam nas configurações, sincronizadas e no backup (R7). */
function LaunchOptions() {
  const [settings, setSettings] = useState<Settings | null>(null)

  useEffect(() => {
    let alive = true
    void getRepository()
      .getSettings()
      .then((value) => {
        if (alive) setSettings(value)
      })
    return () => {
      alive = false
    }
  }, [])

  const toggle = async (patch: Partial<Pick<Settings, 'launchRoundQuarter' | 'launchClose'>>) => {
    setSettings(await getRepository().saveSettings(patch))
  }

  if (!settings) return null
  return (
    <div className="devops-options">
      <label className="devops-check">
        <input
          type="checkbox"
          checked={settings.launchRoundQuarter}
          onChange={(e) => void toggle({ launchRoundQuarter: e.target.checked })}
        />
        <span>
          Arredondar para 15 min
          <small className="muted">Cada intervalo vai para o múltiplo de 15 mais próximo. Sem isso, vai a duração exata.</small>
        </span>
      </label>
      <label className="devops-check">
        <input
          type="checkbox"
          checked={settings.launchClose}
          onChange={(e) => void toggle({ launchClose: e.target.checked })}
        />
        <span>
          Fechar a task ao lançar
          <small className="muted">Vai para Closed. Sem isso, fica em Active para você revisar.</small>
        </span>
      </label>
    </div>
  )
}

function FeedbackLine({ feedback }: { feedback: Feedback }) {
  if (!feedback) return null
  return (
    <p className={feedback.kind === 'ok' ? 'data-ok' : 'data-error'} role={feedback.kind === 'ok' ? 'status' : 'alert'}>
      {feedback.text}
    </p>
  )
}
