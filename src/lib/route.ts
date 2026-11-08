import { isDayKey } from './time'

export type Screen = 'today' | 'week' | 'period'

/** Tela e dia mostrados. `day` nulo segue hoje (ou a semana atual), inclusive na virada do dia. */
export interface Route {
  screen: Screen
  day: string | null
}

const SLUGS: Record<Screen, string> = { today: 'hoje', week: 'semana', period: 'periodo' }

export const HOME: Route = { screen: 'today', day: null }

/**
 * Lê o hash da URL (`#/hoje/2026-11-09`, `#/semana/2026-11-02`, `#/periodo/2026-11-10`). Tela desconhecida volta para Hoje;
 * data inválida vira `null`.
 */
export function parseRoute(hash: string): Route {
  const [slug = '', day = ''] = hash.replace(/^#?\/?/, '').split('/')
  const screen = (Object.keys(SLUGS) as Screen[]).find((key) => SLUGS[key] === slug)
  if (!screen) return HOME
  return { screen, day: isDayKey(day) ? day : null }
}

export function routeHash(route: Route): string {
  return `#/${SLUGS[route.screen]}${route.day ? `/${route.day}` : ''}`
}
