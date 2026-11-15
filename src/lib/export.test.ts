import { describe, expect, it } from 'vitest'
import { countOpenInRange, EXPORT_HEADER, exportFileName, exportRows, toCsv, toTsv } from './export'
import { iv } from './test-helpers'

const week = { start: '2026-11-09', end: '2026-11-15' }

describe('exportRows', () => {
  it('uma linha por intervalo, do mais recente para o mais antigo (CA4)', () => {
    const rows = exportRows([iv('2026-11-09 08:00', '2026-11-09 12:00', 'daily'), iv('2026-11-09 13:00', '2026-11-09 17:30')], week)
    expect(rows).toEqual([
      ['seg', '09/11/2026', '13:00', '17:30', '4:30', '', '', '', ''],
      ['seg', '09/11/2026', '08:00', '12:00', '4:00', 'daily', '', '', ''],
    ])
    expect(rows[0]).toHaveLength(EXPORT_HEADER.length)
  })

  it('ordena por data entre dias diferentes e usa o dia da semana em minúsculas', () => {
    const rows = exportRows([iv('2026-11-09 08:00', '2026-11-09 09:00'), iv('2026-11-14 10:00', '2026-11-14 11:15')], week)
    expect(rows.map((row) => [row[0], row[1], row[4]])).toEqual([
      ['sáb', '14/11/2026', '1:15'],
      ['seg', '09/11/2026', '1:00'],
    ])
  })

  it('intervalo que passa da meia-noite fica numa linha, no dia do início (CA6)', () => {
    expect(exportRows([iv('2026-11-10 22:00', '2026-11-11 01:30')], week)).toEqual([
      ['ter', '10/11/2026', '22:00', '01:30', '3:30', '', '', '', ''],
    ])
  })

  it('deixa de fora o que está em andamento e o que está fora da faixa (CA7)', () => {
    const intervals = [
      iv('2026-11-08 08:00', '2026-11-08 09:00'),
      iv('2026-11-16 08:00', '2026-11-16 09:00'),
      iv('2026-11-12 08:00'),
      iv('2026-11-12 07:00', '2026-11-12 07:30'),
    ]
    expect(exportRows(intervals, week)).toHaveLength(1)
    expect(countOpenInRange(intervals, week)).toBe(1)
  })
})

describe('toTsv', () => {
  it('separa por tabulação, sem cabeçalho, e troca tabulação e quebra de linha por espaço (CA5)', () => {
    const tsv = toTsv([
      ['seg', '09/11/2026', '08:00', '12:00', '4:00', 'linha 1\nlinha 2\tfim', '', '', ''],
      ['seg', '09/11/2026', '13:00', '14:00', '1:00', '', '', '', ''],
    ])
    expect(tsv).toBe(
      'seg\t09/11/2026\t08:00\t12:00\t4:00\tlinha 1 linha 2 fim\t\t\t\nseg\t09/11/2026\t13:00\t14:00\t1:00\t\t\t\t',
    )
  })
})

describe('toCsv', () => {
  it('tem BOM, cabeçalho, ; e \\r\\n', () => {
    const csv = toCsv([['seg', '09/11/2026', '08:00', '12:00', '4:00', 'reunião', '', '', '']])
    expect(csv).toBe(
      '﻿SEMANA;DATA;INICIO;FIM;Soma;Descricao;TASK;Projeto;Detalhe\r\nseg;09/11/2026;08:00;12:00;4:00;reunião;;;\r\n',
    )
  })

  it('põe entre aspas o que tem ;, aspas ou quebra de linha (CA5)', () => {
    const csv = toCsv([['seg', '09/11/2026', '08:00', '12:00', '4:00', 'a; b "c"\nd', '', '', '']])
    expect(csv.split('\r\n')[1]).toBe('seg;09/11/2026;08:00;12:00;4:00;"a; b ""c""\nd";;;')
  })
})

describe('exportFileName', () => {
  it('usa as datas da faixa', () => {
    expect(exportFileName({ start: '2026-10-26', end: '2026-11-25' })).toBe('ponto-2026-10-26-a-2026-11-25.csv')
  })
})
