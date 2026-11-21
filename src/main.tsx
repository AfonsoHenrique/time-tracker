import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { IS_DEMO } from './lib/env'
import { getAccountSession } from './sync/session'

// Pede ao navegador para não apagar os dados locais (IndexedDB) por falta de espaço ou de uso.
void navigator.storage?.persist?.()

// Retoma a sincronização se este aparelho já entrou numa conta (spec 008). Sem conta, o
// Firebase nem é carregado. No modo demo a sincronização fica desligada.
if (!IS_DEMO) void getAccountSession().init()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
