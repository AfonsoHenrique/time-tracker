import { addDays, getISODay, set, subMinutes } from 'date-fns'
import type { BackupData } from './backup'
import { dayKey, parseDayKey, weekRange } from './time'
import { DEFAULT_SETTINGS, type DayOff, type Interval } from './types'

/**
 * Dados fictícios do modo demo da homologação (spec 010). Puro e determinístico: o mesmo
 * `now` gera sempre os mesmos dados, com os mesmos ids.
 */

interface ScriptItem {
  /** Início e fim locais, `HH:MM`. */
  start: string
  end: string
  note: string
  project: string
  workItemId: number | null
  taskId: number | null
}

const item = (
  start: string,
  end: string,
  note: string,
  project = '',
  workItemId: number | null = null,
  taskId: number | null = null,
): ScriptItem => ({ start, end, note, project, workItemId, taskId })

/** Roteiro de um dia útil comum, por dia da semana (1 = segunda … 5 = sexta). */
const WORKDAY_SCRIPT: Record<number, ScriptItem[]> = {
  1: [
    item('08:07', '12:02', 'Daily e revisão de PRs', 'Portal', 48213, 48217),
    item('13:05', '15:40', 'Tela de cadastro de clientes', 'Portal', 48213, 48219),
    item('15:52', '18:01', 'Correção do filtro de datas', 'Portal', 48230, 48231),
  ],
  2: [
    item('08:31', '11:58', 'Integração com o ERP', 'ERP', 50102, 50110),
    item('13:10', '17:02', 'Integração com o ERP: notas fiscais', 'ERP', 50102, 50110),
  ],
  3: [
    item('07:55', '12:10', 'Reunião de planejamento da sprint', 'Interno'),
    item('13:20', '17:48', 'Ajustes no relatório mensal', 'Relatórios', 49001, 49005),
  ],
  4: [
    item('08:15', '09:00', ''),
    item('09:00', '12:30', 'Deploy em homologação', 'Portal', 48213),
    item('13:30', '17:45', 'Testes da API de pedidos', 'ERP', 50102, 50115),
  ],
  5: [
    item('08:20', '12:00', 'Code review', 'Portal', 48230, 48232),
    item('13:00', '16:30', 'Documentação da API', 'ERP', 50102, 50120),
  ],
}

/** Dia da semana anterior que vira dia sem meta. */
const PREVIOUS_DAY_OFF = 3
/** Dia da semana anterior com intervalos sobrepostos (dia irregular). */
const PREVIOUS_IRREGULAR = 4

/** Semana anterior: um feriado, um dia com sobreposição e um sábado com horas. */
function previousWeekScript(isoDay: number): ScriptItem[] {
  if (isoDay === PREVIOUS_DAY_OFF) return []
  if (isoDay === PREVIOUS_IRREGULAR) {
    return [
      item('08:15', '09:00', ''),
      item('09:00', '12:30', 'Deploy em homologação', 'Portal', 48213),
      // Começa antes do fim do anterior: esqueceu de corrigir a volta do almoço.
      item('12:15', '17:45', 'Testes da API de pedidos', 'ERP', 50102, 50115),
    ]
  }
  if (isoDay === 6) return [item('09:30', '11:30', 'Plantão do deploy', 'Portal', 48213, 48240)]
  return WORKDAY_SCRIPT[isoDay] ?? []
}

/** Minutos antes de agora em que começa o intervalo aberto de hoje. */
export const DEMO_OPEN_MINUTES = 30

/** Hora em que o dia de hoje começa a ter dados no demo. */
const DAY_BEGINS = '08:00'

function atTime(key: string, hhmm: string): Date {
  const [hours, minutes] = hhmm.split(':').map(Number)
  return set(parseDayKey(key), { hours, minutes, seconds: 0, milliseconds: 0 })
}

function toInterval(
  key: string,
  index: number,
  start: Date,
  end: Date | null,
  source: Omit<ScriptItem, 'start' | 'end'>,
  declared: boolean,
): Interval {
  const startIso = start.toISOString()
  const endIso = end === null ? null : end.toISOString()
  return {
    id: `demo-${key}-${index + 1}`,
    start: startIso,
    end: endIso,
    note: source.note,
    workItemId: source.workItemId,
    taskId: source.taskId,
    // Só dá para declarar horas que têm task.
    declared: declared && source.taskId !== null,
    project: source.project,
    createdAt: startIso,
    updatedAt: endIso ?? startIso,
  }
}

/** Dados fictícios da semana anterior inteira e da semana atual até `now`. */
export function buildDemoData(now: Date): BackupData {
  const minute = set(now, { seconds: 0, milliseconds: 0 })
  const today = dayKey(minute)
  const currentMonday = parseDayKey(weekRange(today).start)
  const previousMonday = addDays(currentMonday, -7)

  const intervals: Interval[] = []
  const daysOff: DayOff[] = []

  for (let offset = 0; offset < 7; offset++) {
    const key = dayKey(addDays(previousMonday, offset))
    const isoDay = offset + 1
    if (isoDay === PREVIOUS_DAY_OFF) daysOff.push({ date: key, note: 'Feriado (demo)' })
    // Semana anterior quase toda declarada; a sexta ficou para depois.
    const declared = isoDay !== 5
    previousWeekScript(isoDay).forEach((source, index) => {
      intervals.push(toInterval(key, index, atTime(key, source.start), atTime(key, source.end), source, declared))
    })
  }

  for (let offset = 0; offset < 7; offset++) {
    const key = dayKey(addDays(currentMonday, offset))
    if (key > today) break
    const isoDay = getISODay(parseDayKey(key))
    const script = WORKDAY_SCRIPT[isoDay] ?? []
    // Na semana atual, só a segunda já foi declarada.
    const declared = isoDay === 1

    if (key < today) {
      script.forEach((source, index) => {
        intervals.push(toInterval(key, index, atTime(key, source.start), atTime(key, source.end), source, declared))
      })
      continue
    }

    // Hoje: o que terminou até meia hora atrás, mais um intervalo aberto.
    if (script.length === 0 || minute < atTime(key, DAY_BEGINS)) continue
    const openStart = subMinutes(minute, DEMO_OPEN_MINUTES)
    const beginsAt = atTime(key, DAY_BEGINS)
    const closed = script.filter((source) => atTime(key, source.end) <= openStart)
    closed.forEach((source, index) => {
      intervals.push(toInterval(key, index, atTime(key, source.start), atTime(key, source.end), source, declared))
    })
    const next = script[closed.length] ?? script[script.length - 1]
    const start = openStart < beginsAt ? beginsAt : openStart
    intervals.push(toInterval(key, closed.length, start, null, next, false))
  }

  return {
    intervals,
    daysOff,
    settings: { ...DEFAULT_SETTINGS, workDays: [...DEFAULT_SETTINGS.workDays] },
  }
}
