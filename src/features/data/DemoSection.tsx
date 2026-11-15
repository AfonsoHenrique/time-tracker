import { useState } from 'react'
import { enterDemo, exitDemo } from '../../db/demo'
import { IS_DEMO } from '../../lib/env'

/**
 * Bloco do modo demo, só na homologação (spec 010). Os dados fictícios ficam num banco
 * separado, por isso nenhuma ação aqui toca nos dados reais e nenhuma pede confirmação.
 */
export default function DemoSection() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(false)

  const fill = async () => {
    setBusy(true)
    setError(false)
    try {
      await enterDemo()
    } catch (cause) {
      console.error(cause)
      setError(true)
      setBusy(false)
    }
  }

  return (
    <section className="data-block" aria-labelledby="demo-title">
      <h2 id="demo-title">Modo demo</h2>
      {IS_DEMO ? (
        <>
          <p className="muted">
            Você está vendo dados fictícios da semana passada e desta semana. Os dados reais da homologação estão
            guardados à parte e voltam quando você sai do demo.
          </p>
          <div className="restore-actions">
            <button type="button" className="button" onClick={() => void fill()} disabled={busy}>
              Recriar dados demo
            </button>
            <button type="button" className="button button-primary" onClick={exitDemo} disabled={busy}>
              Sair do modo demo
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="muted">
            Preenche o app com dados fictícios para ver todas as telas cheias. Fica num banco separado: seus dados da
            homologação não mudam.
          </p>
          <button type="button" className="button data-wide" onClick={() => void fill()} disabled={busy}>
            Ligar modo demo
          </button>
        </>
      )}
      {error && (
        <p className="data-error" role="alert">
          Não foi possível criar os dados demo. Tente de novo.
        </p>
      )}
    </section>
  )
}
