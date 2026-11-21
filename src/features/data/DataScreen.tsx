import { lazy, Suspense, useEffect, useRef, useState, type ChangeEvent } from 'react'
import { getRepository } from '../../db/repository'
import {
  formatBytes,
  formatDayBr,
  formatExportedAt,
  formatLastBackup,
  parseBackup,
  type BackupData,
  type BackupSummary,
} from '../../lib/backup'
import { APP_ENV, type AppEnv } from '../../lib/env'
import { THEME_CHOICES, THEME_LABELS, type ThemeChoice } from '../../lib/theme'
import { readLastBackup } from '../shared/lastBackup'
import { useAccount } from '../shared/useAccount'
import { AccountSection } from './AccountSection'
import { downloadBackup } from './downloadBackup'
import { applyTheme, readThemeChoice, saveThemeChoice } from '../shared/theme'
import { useNow } from '../shared/useNow'
import './data.css'

type Feedback = { kind: 'ok' | 'error'; text: string } | null

const ENV_LABEL: Record<AppEnv, string> = { prod: 'produção', hml: 'homologação' }

// Só a homologação carrega o bloco do modo demo; na produção ele nem entra no bundle (spec 010).
// A condição repete `import.meta.env` em vez de usar `IS_HML` para o build conseguir cortar o import.
const DemoSection = import.meta.env.VITE_APP_ENV === 'hml' ? lazy(() => import('./DemoSection')) : null

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

/** Aba Dados: conta e sincronização, tema, baixar backup, restaurar um backup e ver o armazenamento do navegador. */
export function DataScreen() {
  return (
    <main className="app data">
      <h1 className="data-title">Dados</h1>
      <AccountSection />
      <AppearanceSection />
      <BackupSection />
      <RestoreSection />
      <StorageSection />
      {DemoSection && (
        <Suspense fallback={null}>
          <DemoSection />
        </Suspense>
      )}
    </main>
  )
}

/** Tema do app neste aparelho (spec 012): segue o sistema ou fica fixo em claro ou escuro. */
function AppearanceSection() {
  const [choice, setChoice] = useState<ThemeChoice>(readThemeChoice)

  const pick = (next: ThemeChoice) => {
    setChoice(next)
    saveThemeChoice(next)
    applyTheme(next)
  }

  return (
    <section className="data-block" aria-labelledby="appearance-title">
      <h2 id="appearance-title">Aparência</h2>
      <p className="muted">Vale só neste aparelho. Em Sistema, o app acompanha o tema claro ou escuro do aparelho.</p>
      <div className="theme-options" role="radiogroup" aria-labelledby="appearance-title">
        {THEME_CHOICES.map((option) => (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={choice === option}
            className="button theme-option"
            onClick={() => pick(option)}
          >
            {THEME_LABELS[option]}
          </button>
        ))}
      </div>
    </section>
  )
}

function BackupSection() {
  const now = useNow(60_000)
  const [lastBackupAt, setLastBackupAt] = useState(readLastBackup)
  const [feedback, setFeedback] = useState<Feedback>(null)
  const [busy, setBusy] = useState(false)

  const download = async () => {
    setBusy(true)
    setFeedback(null)
    try {
      const { exportedAt, intervals } = await downloadBackup()
      setLastBackupAt(exportedAt.toISOString())
      setFeedback({ kind: 'ok', text: `Backup baixado com ${plural(intervals, 'intervalo', 'intervalos')}.` })
    } catch (error) {
      console.error(error)
      setFeedback({ kind: 'error', text: 'Não foi possível gerar o backup. Tente de novo.' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="data-block" aria-labelledby="backup-title">
      <h2 id="backup-title">Backup</h2>
      <p className="muted">
        Um arquivo com todos os intervalos, dias sem meta e configurações deste aparelho. Guarde-o fora do celular,
        por exemplo no OneDrive.
      </p>
      <p className="data-last">Último backup: {formatLastBackup(lastBackupAt, now)}</p>
      <button type="button" className="button button-primary data-wide" onClick={() => void download()} disabled={busy}>
        Baixar backup
      </button>
      <FeedbackLine feedback={feedback} />
    </section>
  )
}

type Pending = { data: BackupData; summary: BackupSummary; current: number }

function RestoreSection() {
  const input = useRef<HTMLInputElement>(null)
  const [pending, setPending] = useState<Pending | null>(null)
  const [feedback, setFeedback] = useState<Feedback>(null)
  const [busy, setBusy] = useState(false)

  const choose = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    // Limpa o campo para que escolher o mesmo arquivo de novo também dispare a leitura.
    event.target.value = ''
    if (!file) return
    setPending(null)
    setFeedback(null)
    try {
      const result = parseBackup(await file.text())
      if (!result.ok) {
        setFeedback({ kind: 'error', text: `${result.error} Nada foi alterado.` })
        return
      }
      const current = await getRepository().countIntervals()
      setPending({ data: result.data, summary: result.summary, current })
    } catch (error) {
      console.error(error)
      setFeedback({ kind: 'error', text: 'Não foi possível ler o arquivo. Nada foi alterado.' })
    }
  }

  const replace = async () => {
    if (!pending) return
    setBusy(true)
    try {
      await getRepository().replaceAll(pending.data)
      setPending(null)
      setFeedback({
        kind: 'ok',
        text: `Dados restaurados: ${plural(pending.summary.intervals, 'intervalo', 'intervalos')}.`,
      })
    } catch (error) {
      console.error(error)
      setFeedback({ kind: 'error', text: 'A restauração falhou. Seus dados anteriores continuam aqui.' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="data-block" aria-labelledby="restore-title">
      <h2 id="restore-title">Restaurar</h2>
      <p className="muted">Troca todos os dados deste aparelho pelos de um arquivo de backup.</p>
      <input
        ref={input}
        type="file"
        accept="application/json,.json"
        className="visually-hidden"
        aria-label="Arquivo de backup"
        onChange={(event) => void choose(event)}
      />
      {!pending && (
        <button type="button" className="button data-wide" onClick={() => input.current?.click()}>
          Escolher arquivo
        </button>
      )}
      {pending && <RestoreSummary pending={pending} busy={busy} onConfirm={() => void replace()} onCancel={() => setPending(null)} />}
      <FeedbackLine feedback={feedback} />
    </section>
  )
}

interface SummaryProps {
  pending: Pending
  busy: boolean
  onConfirm: () => void
  onCancel: () => void
}

function RestoreSummary({ pending: { summary, current }, busy, onConfirm, onCancel }: SummaryProps) {
  const synced = useAccount().phase === 'linked'
  const otherEnv = summary.env !== APP_ENV
  const exportedAt = formatExportedAt(summary.exportedAt)
  return (
    <div className="restore-summary" role="region" aria-label="Resumo do backup">
      <p className={`restore-env${otherEnv ? ' restore-env-other' : ''}`}>
        <strong>Backup da {ENV_LABEL[summary.env]}</strong>
      </p>
      {exportedAt && <p className="muted">Feito em {exportedAt}</p>}
      <ul>
        <li>
          {plural(summary.intervals, 'intervalo', 'intervalos')}
          {summary.firstDay &&
            summary.lastDay &&
            (summary.firstDay === summary.lastDay
              ? `, em ${formatDayBr(summary.firstDay)}`
              : `, de ${formatDayBr(summary.firstDay)} a ${formatDayBr(summary.lastDay)}`)}
        </li>
        <li>{plural(summary.daysOff, 'dia sem meta', 'dias sem meta')}</li>
      </ul>
      <p className="restore-warning">
        Os dados deste aparelho ({plural(current, 'intervalo', 'intervalos')}) serão apagados e trocados por estes.
        {synced && ' A sincronização está ligada: a nuvem e o outro aparelho também ficam com os dados do backup.'}
      </p>
      <div className="restore-actions">
        <button type="button" className="button" onClick={onCancel} disabled={busy}>
          Cancelar
        </button>
        <button type="button" className="button button-danger" onClick={onConfirm} disabled={busy}>
          Substituir meus dados
        </button>
      </div>
    </div>
  )
}

type Storage = { persisted: boolean | null; usage: number | null }

const storageSupported = () => typeof navigator !== 'undefined' && 'storage' in navigator

async function readStorage(): Promise<Storage> {
  const [persisted, estimate] = await Promise.all([
    navigator.storage.persisted?.().catch(() => null) ?? null,
    navigator.storage.estimate?.().catch(() => null) ?? null,
  ])
  return { persisted, usage: estimate?.usage ?? null }
}

function StorageSection() {
  const supported = storageSupported()
  const [storage, setStorage] = useState<Storage | null>(null)
  const [asked, setAsked] = useState(false)

  useEffect(() => {
    if (!supported) return
    let alive = true
    void readStorage().then((next) => {
      if (alive) setStorage(next)
    })
    return () => {
      alive = false
    }
  }, [supported])

  const request = async () => {
    await navigator.storage.persist?.().catch(() => false)
    setAsked(true)
    setStorage(await readStorage())
  }

  return (
    <section className="data-block" aria-labelledby="storage-title">
      <h2 id="storage-title">Armazenamento</h2>
      {!supported ? (
        <p className="muted">Este navegador não informa o armazenamento.</p>
      ) : storage === null ? (
        <p className="muted">Carregando…</p>
      ) : (
        <>
          {storage.persisted ? (
            <p className="storage-status storage-ok">✓ Persistente: o navegador não apaga os dados sozinho.</p>
          ) : (
            <p className="storage-status storage-risk">
              Não persistente: o navegador pode apagar os dados se faltar espaço. Baixe backups com frequência.
            </p>
          )}
          {storage.usage !== null && <p className="muted">Espaço usado: {formatBytes(storage.usage)}</p>}
          {!storage.persisted && (
            <>
              <button type="button" className="button data-wide" onClick={() => void request()}>
                Pedir armazenamento persistente
              </button>
              {asked && (
                <p className="muted data-hint">
                  O navegador recusou. No Chrome, instalar o app na tela inicial costuma resolver.
                </p>
              )}
            </>
          )}
        </>
      )}
    </section>
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
