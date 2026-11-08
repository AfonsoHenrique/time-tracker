import { TodayScreen } from './features/today/TodayScreen'
import { IS_HML } from './lib/env'

function App() {
  return (
    <>
      {IS_HML && <div className="env-badge">Homologação</div>}
      <TodayScreen />
    </>
  )
}

export default App
