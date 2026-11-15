import { TabBar } from './components/TabBar'
import { useRoute } from './features/shared/useRoute'
import { PeriodScreen } from './features/period/PeriodScreen'
import { TodayScreen } from './features/today/TodayScreen'
import { WeekScreen } from './features/week/WeekScreen'
import { IS_HML } from './lib/env'

function App() {
  const { route, navigate } = useRoute()

  return (
    <>
      {IS_HML && <div className="env-badge">Homologação</div>}
      {route.screen === 'today' && (
        <TodayScreen
          day={route.day}
          onChangeDay={(day) => navigate({ screen: 'today', day }, { replace: true })}
        />
      )}
      {route.screen === 'week' && (
        <WeekScreen
          day={route.day}
          onChangeWeek={(day) => navigate({ screen: 'week', day }, { replace: true })}
          onOpenDay={(day) => navigate({ screen: 'today', day })}
        />
      )}
      {route.screen === 'period' && (
        <PeriodScreen
          day={route.day}
          onChangePeriod={(day) => navigate({ screen: 'period', day }, { replace: true })}
          onOpenWeek={(weekStart) => navigate({ screen: 'week', day: weekStart })}
        />
      )}
      <TabBar
        current={route.screen}
        onSelect={(screen) => {
          if (screen !== route.screen) navigate({ screen, day: null })
        }}
      />
    </>
  )
}

export default App
