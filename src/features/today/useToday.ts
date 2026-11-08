import { useCallback, useEffect, useState } from 'react'
import { getRepository } from '../../db/repository'
import { weekRange } from '../../lib/time'
import type { Interval, Settings } from '../../lib/types'

export interface TodayData {
  /** Segunda-feira da semana carregada. */
  weekStart: string
  settings: Settings
  /** Intervalos que começam na semana do dia mostrado. */
  weekIntervals: Interval[]
  daysOff: ReadonlySet<string>
  /** O intervalo em andamento, de qualquer dia. */
  open: Interval | null
}

async function load(weekStart: string): Promise<TodayData> {
  const repo = getRepository()
  const week = weekRange(weekStart)
  const [settings, weekIntervals, daysOff, open] = await Promise.all([
    repo.getSettings(),
    repo.listIntervals(week.start, week.end),
    repo.listDaysOff(week.start, week.end),
    repo.getOpenInterval(),
  ])
  return { weekStart, settings, weekIntervals, daysOff: new Set(daysOff.map((d) => d.date)), open }
}

/**
 * Dados da tela Hoje para a semana do dia, lidos só pelo repositório. Trocar de dia dentro
 * da mesma semana não recarrega; trocar de semana devolve `null` até a nova semana chegar.
 *
 * `run` executa uma ação (entrar, sair, salvar…) e recarrega em seguida. Também recarrega quando
 * o app volta ao primeiro plano, porque os dados podem ter mudado em outra aba.
 */
export function useToday(day: string) {
  const [data, setData] = useState<TodayData | null>(null)
  const [version, setVersion] = useState(0)

  const weekStart = weekRange(day).start

  useEffect(() => {
    let current = true
    load(weekStart).then(
      (next) => {
        if (current) setData(next)
      },
      (error: unknown) => console.error(error),
    )
    return () => {
      current = false
    }
  }, [weekStart, version])

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') setVersion((v) => v + 1)
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [])

  const run = useCallback(async (action: () => Promise<unknown>) => {
    try {
      await action()
    } finally {
      setVersion((v) => v + 1)
    }
  }, [])

  return { data: data?.weekStart === weekStart ? data : null, run }
}
