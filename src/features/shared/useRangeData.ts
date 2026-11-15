import { useCallback, useEffect, useState } from 'react'
import { getRepository } from '../../db/repository'
import { periodRange, weekRange } from '../../lib/time'
import type { DayRange, Interval, Settings } from '../../lib/types'

export type RangeKind = 'week' | 'period'

export interface RangeData {
  kind: RangeKind
  /** Faixa carregada: a semana ou o período mensal que contém o dia pedido. */
  range: DayRange
  settings: Settings
  /** Intervalos que começam na faixa. */
  intervals: Interval[]
  daysOff: ReadonlySet<string>
  /** O intervalo em andamento, de qualquer dia. */
  open: Interval | null
}

async function load(kind: RangeKind, day: string): Promise<RangeData> {
  const repo = getRepository()
  // O período depende das configurações (dia de início), então elas vêm primeiro.
  const settings = await repo.getSettings()
  const range = kind === 'week' ? weekRange(day) : periodRange(day, settings.periodStartDay)
  const [intervals, daysOff, open] = await Promise.all([
    repo.listIntervals(range.start, range.end),
    repo.listDaysOff(range.start, range.end),
    repo.getOpenInterval(),
  ])
  return { kind, range, settings, intervals, daysOff: new Set(daysOff.map((d) => d.date)), open }
}

/**
 * Dados da semana ou do período que contém o dia, lidos só pelo repositório. Enquanto a nova
 * leitura não chega, continua devolvendo os dados anteriores se eles ainda cobrem o dia, para a
 * tela não piscar ao trocar de dia dentro da mesma semana. Fora disso, devolve `null`.
 *
 * `run` executa uma ação (entrar, sair, salvar…) e recarrega em seguida. Também recarrega quando
 * o app volta ao primeiro plano, porque os dados podem ter mudado em outra aba.
 */
export function useRangeData(kind: RangeKind, day: string) {
  const [data, setData] = useState<RangeData | null>(null)
  const [version, setVersion] = useState(0)

  useEffect(() => {
    let current = true
    load(kind, day).then(
      (next) => {
        if (current) setData(next)
      },
      (error: unknown) => console.error(error),
    )
    return () => {
      current = false
    }
  }, [kind, day, version])

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

  const covers = data !== null && data.kind === kind && day >= data.range.start && day <= data.range.end
  return { data: covers ? data : null, run }
}
