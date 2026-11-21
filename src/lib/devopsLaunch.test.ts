import { describe, expect, it } from 'vitest'
import {
  buildPatch,
  detailsHtml,
  guessField,
  launchStates,
  parseOrganization,
  planLaunch,
  roundToQuarter,
} from './devopsLaunch'
import { at, iv } from './test-helpers'

const task = (taskId: number, declared = false) => ({ taskId, declared })

/** Semana de 16/11/2026, igual à task 120022 real da spec 013. */
function baseWeek() {
  return [
    iv('2026-11-16 10:30', '2026-11-16 11:00', 'Daily MS', task(120022)),
    iv('2026-11-16 11:00', '2026-11-16 11:45', 'Minha Saúde - Uso interno Yuni', task(120022)),
    iv('2026-11-17 10:30', '2026-11-17 10:45', 'Daily MS', task(120022)),
    iv('2026-11-17 14:00', '2026-11-17 14:30', 'Minha Saúde: Comitê de Bem Estar', task(120022)),
    iv('2026-11-18 09:45', '2026-11-18 10:15', 'Problema ambiente MS', task(120022)),
    iv('2026-11-18 10:30', '2026-11-18 11:00', 'Daily MS', task(120022)),
    iv('2026-11-19 10:30', '2026-11-19 10:45', 'Daily MS', task(120022)),
  ]
}

describe('parseOrganization', () => {
  it.each([
    ['minha-org', 'minha-org'],
    ['  minha-org ', 'minha-org'],
    ['https://dev.azure.com/minha-org/', 'minha-org'],
    ['https://dev.azure.com/minha-org/Projeto/_workitems', 'minha-org'],
    ['dev.azure.com/minha-org', 'minha-org'],
    ['https://minha-org.visualstudio.com', 'minha-org'],
    ['https://minha-org.visualstudio.com/Projeto', 'minha-org'],
  ])('%s → %s (CA10)', (text, value) => {
    expect(parseOrganization(text)).toEqual({ ok: true, value })
  })

  it.each(['', 'minha org', 'minha/org', '/', 'https://dev.azure.com/', '-org'])('recusa %j (CA10)', (text) => {
    expect(parseOrganization(text)).toEqual({ ok: false })
  })
})

describe('roundToQuarter (CA4)', () => {
  it.each([
    [5, 15],
    [7, 15],
    [15, 15],
    [22, 15],
    [23, 30],
    [52, 45],
    [53, 60],
    [90, 90],
  ])('%i min → %i min', (minutes, rounded) => {
    expect(roundToQuarter(minutes)).toBe(rounded)
  })
})

describe('planLaunch', () => {
  it('junta a semana da task 120022 com total, datas e linhas (CA1)', () => {
    const plan = planLaunch(baseWeek(), { roundQuarter: false })
    expect(plan.tasks).toHaveLength(1)
    const [t] = plan.tasks
    expect(t.taskId).toBe(120022)
    expect(t.minutes).toBe(195)
    expect(t.hours).toBe(3.25)
    expect(t.startDate).toBe('2026-11-16')
    expect(t.targetDate).toBe('2026-11-20')
    expect(t.pendingCount).toBe(7)
    expect(t.lines.map((line) => line.text)).toEqual([
      '19/nov 10:30 10:45 0:15 Daily MS',
      '18/nov 10:30 11:00 0:30 Daily MS',
      '18/nov 09:45 10:15 0:30 Problema ambiente MS',
      '17/nov 14:00 14:30 0:30 Minha Saúde: Comitê de Bem Estar',
      '17/nov 10:30 10:45 0:15 Daily MS',
      '16/nov 11:00 11:45 0:45 Minha Saúde - Uso interno Yuni',
      '16/nov 10:30 11:00 0:30 Daily MS',
    ])
  })

  it('usa a duração real sem arredondar e arredonda por intervalo quando ligado (CA4)', () => {
    const intervals = [iv('2026-11-16 16:00', '2026-11-16 16:52', 'Ajuste', task(1))]
    const exact = planLaunch(intervals, { roundQuarter: false }).tasks[0]
    expect(exact.lines[0].text).toBe('16/nov 16:00 16:52 0:52 Ajuste')
    expect(exact.hours).toBe(0.87)
    const rounded = planLaunch(intervals, { roundQuarter: true }).tasks[0]
    expect(rounded.lines[0].text).toBe('16/nov 16:00 16:52 0:45 Ajuste')
    expect(rounded.hours).toBe(0.75)
  })

  it('relançar leva o total de todos os intervalos, declarados ou não (CA5)', () => {
    const declared = baseWeek().map((interval) => ({ ...interval, declared: true }))
    const intervals = [...declared, iv('2026-11-20 09:00', '2026-11-20 09:30', 'Daily MS', task(120022))]
    const [t] = planLaunch(intervals, { roundQuarter: false }).tasks
    expect(t.minutes).toBe(225)
    expect(t.lines).toHaveLength(8)
    expect(t.pendingCount).toBe(1)
  })

  it('ignora a task que já está toda declarada', () => {
    const declared = baseWeek().map((interval) => ({ ...interval, declared: true }))
    expect(planLaunch(declared, { roundQuarter: false }).tasks).toEqual([])
  })

  it('deixa de fora os abertos e conta os não declarados sem task (CA6)', () => {
    const intervals = [
      iv('2026-11-16 08:00', '2026-11-16 09:00', 'Sem task'),
      iv('2026-11-16 09:00', '2026-11-16 09:20', 'Sem task declarado', { declared: true }),
      iv('2026-11-16 13:00', null, 'Aberto', task(5)),
    ]
    const plan = planLaunch(intervals, { roundQuarter: false })
    expect(plan.tasks).toEqual([])
    expect(plan.withoutTask).toEqual({ count: 1, minutes: 60 })
  })

  it('separa as tasks e as ordena pelo id', () => {
    const intervals = [
      iv('2026-11-16 08:00', '2026-11-16 09:00', '', task(20)),
      iv('2026-11-16 09:00', '2026-11-16 10:00', '', task(10)),
    ]
    expect(planLaunch(intervals, { roundQuarter: false }).tasks.map((t) => t.taskId)).toEqual([10, 20])
  })

  it('vai da segunda da primeira semana à sexta da última quando a task passa de uma semana', () => {
    const intervals = [
      iv('2026-11-13 08:00', '2026-11-13 09:00', '', task(1)),
      iv('2026-11-17 08:00', '2026-11-17 09:00', '', task(1)),
    ]
    const [t] = planLaunch(intervals, { roundQuarter: false }).tasks
    expect([t.startDate, t.targetDate]).toEqual(['2026-11-09', '2026-11-20'])
  })
})

describe('detailsHtml', () => {
  it('escapa a observação (CA12)', () => {
    const [t] = planLaunch([iv('2026-11-16 08:00', '2026-11-16 09:00', 'Teste <b> & "x"', task(1))], {
      roundQuarter: false,
    }).tasks
    expect(detailsHtml(t.lines)).toBe('<div>16/nov 08:00 09:00 1:00 Teste &lt;b&gt; &amp; &quot;x&quot;</div>')
  })
})

describe('buildPatch', () => {
  it('preenche horas, datas, detalhes, tipo, responsável e estado (CA2)', () => {
    const [t] = planLaunch(baseWeek(), { roundQuarter: false }).tasks
    const ops = buildPatch({
      rev: 12,
      task: t,
      fields: { activityType: 'Custom.TipoDeAtividade', details: 'Custom.DetalhesDoApontamento' },
      activityType: 'Reuniões',
      assignedTo: 'afonso@exemplo.com',
      state: 'Active',
    })
    expect(ops).toEqual([
      { op: 'test', path: '/rev', value: 12 },
      { op: 'add', path: '/fields/Microsoft.VSTS.Scheduling.OriginalEstimate', value: 3.25 },
      { op: 'add', path: '/fields/Microsoft.VSTS.Scheduling.CompletedWork', value: 3.25 },
      { op: 'add', path: '/fields/Microsoft.VSTS.Scheduling.StartDate', value: at('2026-11-16 00:00') },
      { op: 'add', path: '/fields/Microsoft.VSTS.Scheduling.TargetDate', value: at('2026-11-20 00:00') },
      { op: 'add', path: '/fields/System.AssignedTo', value: 'afonso@exemplo.com' },
      { op: 'add', path: '/fields/Custom.DetalhesDoApontamento', value: detailsHtml(t.lines) },
      { op: 'add', path: '/fields/Custom.TipoDeAtividade', value: 'Reuniões' },
      { op: 'add', path: '/fields/System.State', value: 'Active' },
    ])
  })

  it('não mexe nos campos não mapeados nem no estado quando é null', () => {
    const [t] = planLaunch(baseWeek(), { roundQuarter: false }).tasks
    const ops = buildPatch({
      rev: 1,
      task: t,
      fields: { activityType: null, details: null },
      activityType: 'Reuniões',
      assignedTo: 'a',
      state: null,
    })
    expect(ops.map((op) => op.path)).toEqual([
      '/rev',
      '/fields/Microsoft.VSTS.Scheduling.OriginalEstimate',
      '/fields/Microsoft.VSTS.Scheduling.CompletedWork',
      '/fields/Microsoft.VSTS.Scheduling.StartDate',
      '/fields/Microsoft.VSTS.Scheduling.TargetDate',
      '/fields/System.AssignedTo',
    ])
  })
})

describe('launchStates', () => {
  it('vai de New para Active e, com fechar, depois para Closed (R16, R21)', () => {
    expect(launchStates('New', false)).toEqual({ first: 'Active', second: null })
    expect(launchStates('New', true)).toEqual({ first: 'Active', second: 'Closed' })
  })

  it('não volta para trás', () => {
    expect(launchStates('Active', false)).toEqual({ first: null, second: null })
    expect(launchStates('Active', true)).toEqual({ first: null, second: 'Closed' })
    expect(launchStates('Closed', false)).toEqual({ first: null, second: null })
    expect(launchStates('Closed', true)).toEqual({ first: null, second: null })
  })
})

describe('guessField', () => {
  const fields = [
    { name: 'Title', referenceName: 'System.Title' },
    { name: 'Tipo de atividade', referenceName: 'Custom.Tipodeatividade' },
    { name: 'Detalhes do Apontamento', referenceName: 'Custom.Detalhes' },
  ]

  it('acha pelo nome sem ligar para acentos e maiúsculas', () => {
    expect(guessField(fields, 'Tipo de Atividade')).toBe('Custom.Tipodeatividade')
    expect(guessField(fields, 'Detalhes do apontamento')).toBe('Custom.Detalhes')
    expect(guessField(fields, 'Produto')).toBeNull()
  })
})
