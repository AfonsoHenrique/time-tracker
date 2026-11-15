import { useCallback, useEffect, useState } from 'react'
import { parseRoute, routeHash, type Route } from '../../lib/route'

/**
 * Rota guardada no hash da URL. `navigate` cria uma entrada no histórico (o botão voltar
 * retorna a ela); com `replace`, troca a entrada atual, como nas setas de dia e de semana.
 */
export function useRoute() {
  const [route, setRoute] = useState<Route>(() => parseRoute(window.location.hash))

  useEffect(() => {
    const onChange = () => setRoute(parseRoute(window.location.hash))
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])

  const navigate = useCallback((next: Route, options?: { replace?: boolean }) => {
    const hash = routeHash(next)
    if (options?.replace) {
      window.history.replaceState(null, '', hash)
      setRoute(parseRoute(hash))
    } else if (window.location.hash !== hash) {
      window.location.hash = hash
    }
  }, [])

  return { route, navigate }
}
