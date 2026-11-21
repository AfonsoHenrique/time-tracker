import { useEffect, useState } from 'react'
import { describeSyncStatus, PROVIDER_LABELS, PROVIDERS, type ProviderId } from '../../lib/account'
import { formatDayBr } from '../../lib/backup'
import { IS_DEMO } from '../../lib/env'
import { getAccountSession, type AccountState, type LocalSummary } from '../../sync/session'
import { useAccount } from '../shared/useAccount'
import { downloadBackup } from './downloadBackup'

type Feedback = { kind: 'ok' | 'error'; text: string } | null

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

/**
 * Conta e sincronização (spec 008, R3): entrar com Google ou Microsoft, escolher o que fazer no
 * primeiro login, ver o estado, vincular o outro provedor e sair.
 */
export function AccountSection() {
  const state = useAccount()
  const [feedback, setFeedback] = useState<Feedback>(null)
  const [busy, setBusy] = useState(false)

  const act = async (action: () => Promise<{ ok: true } | { ok: false; error: string | null }>, ok?: string) => {
    setBusy(true)
    setFeedback(null)
    try {
      const result = await action()
      if (!result.ok && result.error) setFeedback({ kind: 'error', text: result.error })
      if (result.ok && ok) setFeedback({ kind: 'ok', text: ok })
    } finally {
      setBusy(false)
    }
  }

  const session = getAccountSession()

  // Baixa o código do Firebase antes do clique, sem iniciar nada: o login abre uma janela, e o
  // navegador só deixa abrir janelas logo depois do toque no botão.
  const canSignIn = !IS_DEMO && (state.phase === 'off' || state.phase === 'expired')
  useEffect(() => {
    if (canSignIn) void import('../../sync/firebase').catch(() => undefined)
  }, [canSignIn])

  return (
    <section className="data-block" aria-labelledby="account-title">
      <h2 id="account-title">Conta e sincronização</h2>
      {IS_DEMO ? (
        <p className="muted">No modo demo a sincronização fica desligada.</p>
      ) : (
        <AccountBody
          state={state}
          busy={busy}
          onSignIn={(provider) => void act(() => session.signIn(provider))}
          onChoose={(mode) => void act(() => session.choose(mode))}
          onCancel={() => void act(async () => (await session.cancel(), { ok: true }))}
          onLink={(provider) => void act(() => session.link(provider), `Conta ${PROVIDER_LABELS[provider]} vinculada.`)}
          onSignOut={() => void act(async () => (await session.signOut(), { ok: true }), 'Você saiu. Os dados continuam neste aparelho.')}
          onSyncNow={() => void session.syncNow()}
        />
      )}
      <FeedbackLine feedback={feedback} />
    </section>
  )
}

interface BodyProps {
  state: AccountState
  busy: boolean
  onSignIn: (provider: ProviderId) => void
  onChoose: (mode: 'merge' | 'cloud-only') => void
  onCancel: () => void
  onLink: (provider: ProviderId) => void
  onSignOut: () => void
  onSyncNow: () => void
}

function AccountBody({ state, busy, onSignIn, onChoose, onCancel, onLink, onSignOut, onSyncNow }: BodyProps) {
  switch (state.phase) {
    case 'loading':
      return <p className="muted">Carregando…</p>
    case 'off':
    case 'expired':
      return (
        <>
          <p className="muted">
            {state.phase === 'expired'
              ? 'A sessão terminou. Entre de novo para continuar sincronizando; os dados deste aparelho continuam aqui.'
              : 'Entre para ter os mesmos dados no Mac e no Android. Sem login, o app continua funcionando só neste aparelho.'}
          </p>
          <div className="account-buttons account-buttons-stack">
            <button type="button" className="button button-primary" onClick={() => onSignIn('google')} disabled={busy}>
              Entrar com Google
            </button>
            <button type="button" className="button" onClick={() => onSignIn('microsoft')} disabled={busy}>
              Entrar com Microsoft
            </button>
          </div>
        </>
      )
    case 'choosing':
      return <FirstSyncChoice state={state} busy={busy} onChoose={onChoose} onCancel={onCancel} />
    case 'linked':
      return <LinkedAccount state={state} busy={busy} onLink={onLink} onSignOut={onSignOut} onSyncNow={onSyncNow} />
  }
}

function describeLocal(local: LocalSummary): string {
  const range =
    local.firstDay && local.lastDay
      ? local.firstDay === local.lastDay
        ? `, em ${formatDayBr(local.firstDay)}`
        : `, de ${formatDayBr(local.firstDay)} a ${formatDayBr(local.lastDay)}`
      : ''
  return `${plural(local.intervals, 'intervalo', 'intervalos')}${range} e ${plural(local.daysOff, 'dia sem meta', 'dias sem meta')}`
}

interface ChoiceProps {
  state: Extract<AccountState, { phase: 'choosing' }>
  busy: boolean
  onChoose: (mode: 'merge' | 'cloud-only') => void
  onCancel: () => void
}

/** Primeiro login com dados nos dois lados (R14) ou com outra conta (R15). */
function FirstSyncChoice({ state, busy, onChoose, onCancel }: ChoiceProps) {
  const [confirmCloud, setConfirmCloud] = useState(false)
  const [backedUp, setBackedUp] = useState(false)

  const backup = async () => {
    await downloadBackup()
    setBackedUp(true)
  }

  return (
    <div className="restore-summary" role="region" aria-label="Primeiro login">
      <p>
        <strong>{state.user.email ?? state.user.name ?? 'Conta'}</strong>
      </p>
      {state.otherAccount && (
        <p className="restore-warning">Este aparelho sincronizava com outra conta. Confirme antes de misturar os dados.</p>
      )}
      <ul>
        <li>Neste aparelho: {describeLocal(state.local)}.</li>
        <li>Na nuvem: {plural(state.remoteCount, 'registro', 'registros')} (intervalos e dias sem meta).</li>
      </ul>
      {!confirmCloud ? (
        <>
          <p className="muted">
            Juntar une os dois lados. Onde o mesmo intervalo existe nos dois, vale a versão alterada por último.
          </p>
          <div className="account-buttons">
            <button type="button" className="button button-primary" onClick={() => onChoose('merge')} disabled={busy}>
              Juntar (recomendado)
            </button>
            <button type="button" className="button" onClick={() => setConfirmCloud(true)} disabled={busy}>
              Usar só os da nuvem
            </button>
            <button type="button" className="button" onClick={onCancel} disabled={busy}>
              Cancelar
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="restore-warning">
            Os dados deste aparelho ({plural(state.local.intervals, 'intervalo', 'intervalos')}) serão apagados e trocados
            pelos da nuvem. Baixe um backup antes, se quiser guardá-los.
          </p>
          <div className="account-buttons">
            <button type="button" className="button" onClick={() => void backup()} disabled={busy}>
              {backedUp ? 'Backup baixado ✓' : 'Baixar backup'}
            </button>
            <button type="button" className="button button-danger" onClick={() => onChoose('cloud-only')} disabled={busy}>
              Apagar e usar os da nuvem
            </button>
            <button type="button" className="button" onClick={() => setConfirmCloud(false)} disabled={busy}>
              Voltar
            </button>
          </div>
        </>
      )}
    </div>
  )
}

interface LinkedProps {
  state: Extract<AccountState, { phase: 'linked' }>
  busy: boolean
  onLink: (provider: ProviderId) => void
  onSignOut: () => void
  onSyncNow: () => void
}

function LinkedAccount({ state: { user, sync }, busy, onLink, onSignOut, onSyncNow }: LinkedProps) {
  const [confirmOut, setConfirmOut] = useState(false)
  const status = describeSyncStatus(sync)
  const missing = PROVIDERS.filter((p) => !user.providers.includes(p))

  return (
    <>
      <p className="account-user">
        <strong>{user.name ?? user.email ?? 'Conta'}</strong>
        {user.name && user.email && <span className="muted"> · {user.email}</span>}
      </p>
      <p className="muted">Entra com {user.providers.map((p) => PROVIDER_LABELS[p]).join(' e ') || 'esta conta'}.</p>
      <p className={`account-status account-status-${status.kind}`} role="status">
        {status.text}
      </p>
      <div className="account-buttons">
        <button type="button" className="button" onClick={onSyncNow} disabled={sync.running}>
          Sincronizar agora
        </button>
        {missing.map((provider) => (
          <button key={provider} type="button" className="button" onClick={() => onLink(provider)} disabled={busy}>
            Vincular {PROVIDER_LABELS[provider]}
          </button>
        ))}
      </div>
      {!confirmOut ? (
        <button
          type="button"
          className="button data-wide account-signout"
          onClick={() => (sync.pending > 0 ? setConfirmOut(true) : onSignOut())}
          disabled={busy}
        >
          Sair
        </button>
      ) : (
        <div className="account-confirm">
          <p className="restore-warning">
            {plural(sync.pending, 'alteração ainda não subiu', 'alterações ainda não subiram')} para a nuvem. Saindo agora,
            elas ficam só neste aparelho.
          </p>
          <div className="account-buttons">
            <button type="button" className="button" onClick={() => setConfirmOut(false)} disabled={busy}>
              Cancelar
            </button>
            <button type="button" className="button button-danger" onClick={onSignOut} disabled={busy}>
              Sair mesmo assim
            </button>
          </div>
        </div>
      )}
    </>
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
