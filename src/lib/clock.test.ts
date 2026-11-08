import { describe, expect, it } from 'vitest'
import {
  formatDayTitle,
  formatElapsed,
  formatShortDay,
  formatTime,
  formatWeekdayShort,
  formatWeekTitle,
  intervalToForm,
  parseTimeInput,
  readIntervalForm,
} from './clock'
import { at, iv } from './test-helpers'

describe('formatElapsed', () => {
  it('mostra horas, minutos e segundos desde o início', () => {
    const now = new Date(new Date(at('2026-11-09 09:25')).getTime() + 7_000)
    expect(formatElapsed(at('2026-11-09 08:03'), now)).toBe('1:22:07')
  })

  it('passa de 10 horas sem quebrar o formato', () => {
    expect(formatElapsed(at('2026-11-09 08:00'), new Date(at('2026-11-09 19:05')))).toBe('11:05:00')
  })

  it('nunca fica negativo', () => {
    expect(formatElapsed(at('2026-11-09 08:00'), new Date(at('2026-11-09 07:59')))).toBe('0:00:00')
  })
})

describe('formatDayTitle', () => {
  const now = new Date(at('2026-11-09 10:00'))

  it('usa dia da semana, dia e mês', () => {
    expect(formatDayTitle('2026-11-09', now)).toBe('Segunda, 9 de novembro')
    expect(formatDayTitle('2026-11-08', now)).toBe('Domingo, 8 de novembro')
    expect(formatDayTitle('2026-03-04', now)).toBe('Quarta, 4 de março')
  })

  it('mostra o ano só quando é outro ano', () => {
    expect(formatDayTitle('2025-12-31', now)).toBe('Quarta, 31 de dezembro de 2025')
  })
})

describe('formatTime e formatShortDay', () => {
  it('formatam no fuso local', () => {
    expect(formatTime(at('2026-11-09 08:03'))).toBe('08:03')
    expect(formatShortDay('2026-11-09')).toBe('09/11')
  })
})

describe('parseTimeInput', () => {
  it('monta o instante local no dia', () => {
    expect(parseTimeInput('2026-11-09', '13:45')?.toISOString()).toBe(at('2026-11-09 13:45'))
    expect(parseTimeInput('2026-11-09', ' 00:00 ')?.toISOString()).toBe(at('2026-11-09 00:00'))
  })

  it('recusa textos que não são hora', () => {
    for (const text of ['', '8:00', '24:00', '12:60', 'abc']) {
      expect(parseTimeInput('2026-11-09', text)).toBeNull()
    }
  })
})

describe('readIntervalForm', () => {
  const base = { day: '2026-11-09', endDay: '2026-11-09', note: '' }

  it('lê início, fim e observação sem arredondar', () => {
    const result = readIntervalForm({ ...base, start: '08:07', end: '11:32', note: '  daily  ' })
    expect(result).toEqual({
      ok: true,
      start: new Date(at('2026-11-09 08:07')),
      end: new Date(at('2026-11-09 11:32')),
      note: 'daily',
    })
  })

  it('fim vazio deixa o intervalo em andamento', () => {
    const result = readIntervalForm({ ...base, start: '13:00', end: '' })
    expect(result.ok && result.end).toBeNull()
  })

  it('fim antes do início é erro (CA6)', () => {
    expect(readIntervalForm({ ...base, start: '12:00', end: '11:30' })).toEqual({
      ok: false,
      error: 'O fim não pode ser antes do início.',
    })
  })

  it('início vazio ou fim inválido são erros', () => {
    expect(readIntervalForm({ ...base, start: '', end: '' }).ok).toBe(false)
    expect(readIntervalForm({ ...base, start: '08:00', end: '25:00' }).ok).toBe(false)
  })

  it('mantém o dia do fim de um intervalo que já passava da meia-noite', () => {
    const result = readIntervalForm({ ...base, endDay: '2026-11-10', start: '22:00', end: '01:30' })
    expect(result.ok && result.end?.toISOString()).toBe(at('2026-11-10 01:30'))
  })
})

describe('intervalToForm', () => {
  it('formulário vazio para um intervalo novo no dia', () => {
    expect(intervalToForm('2026-11-09')).toEqual({
      day: '2026-11-09',
      endDay: '2026-11-09',
      start: '',
      end: '',
      note: '',
    })
  })

  it('preenche com um intervalo existente', () => {
    expect(intervalToForm('2026-11-09', iv('2026-11-09 08:00', '2026-11-09 12:00', 'daily'))).toEqual({
      day: '2026-11-09',
      endDay: '2026-11-09',
      start: '08:00',
      end: '12:00',
      note: 'daily',
    })
  })

  it('intervalo em andamento fica com o fim vazio; o que cruza a meia-noite guarda o dia do fim', () => {
    expect(intervalToForm('2026-11-09', iv('2026-11-09 13:00')).end).toBe('')
    expect(intervalToForm('2026-11-09', iv('2026-11-09 22:00', '2026-11-10 01:00')).endDay).toBe('2026-11-10')
  })
})

describe('formatWeekTitle e formatWeekdayShort', () => {
  const now = new Date(at('2026-11-09 10:00'))

  it('semana dentro de um mês', () => {
    expect(formatWeekTitle({ start: '2026-11-02', end: '2026-11-08' }, now)).toBe('2 a 8 de novembro')
  })

  it('semana que vira o mês', () => {
    expect(formatWeekTitle({ start: '2026-11-30', end: '2026-12-06' }, now)).toBe('30 de novembro a 6 de dezembro')
  })

  it('semana que vira o ano ou de outro ano', () => {
    expect(formatWeekTitle({ start: '2026-12-28', end: '2027-01-03' }, now)).toBe(
      '28 de dezembro de 2026 a 3 de janeiro de 2027',
    )
    expect(formatWeekTitle({ start: '2025-11-03', end: '2025-11-09' }, now)).toBe('3 a 9 de novembro de 2025')
  })

  it('dia curto com dia da semana', () => {
    expect(formatWeekdayShort('2026-11-09')).toBe('Seg 09/11')
    expect(formatWeekdayShort('2026-11-15')).toBe('Dom 15/11')
  })
})
