import { useEffect, useState } from 'react'
import { IS_HML } from './lib/env'

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1)

function App() {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  return (
    <main className="app">
      {IS_HML && <div className="env-badge">Homologação</div>}
      <h1>Ponto</h1>
      <p className="clock">
        {now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
      </p>
      <p className="date">{capitalize(now.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }))}</p>
      <p className="hint">Base do app instalada. As telas de registro chegam nos próximos marcos.</p>
    </main>
  )
}

export default App
