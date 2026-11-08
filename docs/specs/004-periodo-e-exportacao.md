# 004. Período e exportação

- **Status**: Rascunho
- **Marco**: 5
- **Relacionado**: [PRODUCT.md](../PRODUCT.md) (seção Exportação), [003-semana-e-navegacao](003-semana-e-navegacao.md)

## Contexto

O mês de trabalho vai do dia 26 ao dia 25. A tela Período mostra se esse mês fechou. A exportação leva os intervalos para a aba SEMANA da planilha `HORAS.xlsx`, que depois vira o lançamento de horas no Azure DevOps.

## Requisitos

- R1. Uma terceira aba, **Período**, com o título do período (ex.: "26 de outubro a 25 de novembro"), setas ‹ › para trocar de período e o botão **Este período** quando você está em outro.
- R2. Totais do período: trabalhado, meta (dias úteis do período menos os dias sem meta) e falta ou excedente.
- R3. Uma linha por semana que toca o período, com o intervalo de dias e o trabalhado **dentro do período**, além de ⚠ se algum dia dela for irregular. Tocar numa semana abre a tela Semana.
- R4. **Exportar** na tela Período e na tela Semana, sempre para os dias mostrados:
  - **Copiar para o Excel**: copia as linhas em TSV, **sem cabeçalho**, prontas para colar na planilha.
  - **Baixar CSV**: arquivo `.csv` **com cabeçalho**, separado por `;`, em UTF-8 com BOM, com nome `ponto-AAAA-MM-DD-a-AAAA-MM-DD.csv`.
- R5. As colunas seguem a aba SEMANA: `SEMANA | DATA | INICIO | FIM | Soma | Descricao | TASK | Projeto | Detalhe`.
  - Uma linha por intervalo fechado, do mais recente para o mais antigo.
  - SEMANA vai de `seg` a `dom`. DATA é `dd/mm/aaaa` (o dia do início). INICIO e FIM são `HH:MM`. Soma é `H:MM`.
  - Descricao é a observação. TASK, Projeto e Detalhe ficam vazios.
- R6. Um intervalo em andamento **não** entra na exportação. A tela avisa quantos ficaram de fora.
- R7. Depois de copiar ou baixar, a tela confirma com "N linhas copiadas" ou "Arquivo baixado". Se a área de transferência falhar, aparece um erro e a sugestão de baixar o CSV.

## Critérios de aceite

- [ ] CA1. Dado 08/11/2026, então a aba Período mostra "26 de outubro a 25 de novembro". Na seta ›, mostra "26 de novembro a 25 de dezembro".
- [ ] CA2. Dados os 23 dias úteis de 26/10 a 25/11/2026 e um dia sem meta, então a meta do período é 176:00 (22 × 8h).
- [ ] CA3. A semana de 26/10 a 01/11 e a de 23/11 a 29/11 aparecem, e cada uma soma só os dias dentro do período.
- [ ] CA4. Dados 09/11 08:00–12:00 "daily" e 09/11 13:00–17:30, então a exportação gera duas linhas de 9 colunas, nesta ordem:
  - `seg | 09/11/2026 | 13:00 | 17:30 | 4:30 | (vazio) | (vazio) | (vazio) | (vazio)`
  - `seg | 09/11/2026 | 08:00 | 12:00 | 4:00 | daily | (vazio) | (vazio) | (vazio)`
- [ ] CA5. Uma observação com `;`, aspas ou quebra de linha sai entre aspas no CSV, com as aspas internas dobradas. No TSV, tabulação e quebra de linha viram espaço.
- [ ] CA6. Um intervalo que passa da meia-noite (22:00–01:30) sai numa linha só, no dia do início, com Soma 3:30.
- [ ] CA7. Com um intervalo em andamento no período, a tela avisa "1 intervalo em andamento ficou de fora".
- [ ] CA8. Copiar mostra "N linhas copiadas". O CSV baixado abre no Excel com acentos corretos e as colunas separadas.
- [ ] CA9. `#/periodo/2026-11-10` abre o período de 26/10 a 25/11. As três abas cabem em 390 px, nos temas claro e escuro.

## Fora do escopo

- Quebrar intervalos em blocos de 15 min ou atribuir task e projeto (fase 3).
- Lançar horas no Azure DevOps (fase 3).
- Escolher um intervalo de datas livre: a exportação usa a semana ou o período mostrado.
- Configurar o dia de início do período pela tela: continua 26 em `Settings`.

## Desenho

- `src/lib/export.ts` (puro, com teste): `exportRows(intervals, range)` gera as linhas, `toTsv(rows)` e `toCsv(rows)` geram o texto, e `exportFileName(range)` gera o nome do arquivo.
- `summarizeRange(range, …)` em `balance.ts` soma os dias de qualquer faixa. O período e as linhas de semana usam essa função.
- `formatRangeTitle` em `clock.ts` generaliza o título de semana para qualquer faixa.
- O hook de dados passa a receber uma faixa (`useRangeData(range)`). A Semana pede a semana, e o Período pede o período inteiro, no máximo 31 dias, numa leitura só.
- A rota ganha `periodo`. A aba Período entra na `TabBar`.
- Copiar usa `navigator.clipboard.writeText`. Baixar cria um `Blob` com BOM (`﻿`) e quebra de linha `\r\n`, que é o que o Excel espera.
- `src/components/ExportPanel.tsx` tem os dois botões e as mensagens, e é usado nas telas Semana e Período.

## Tarefas

- [ ] T1. `lib/export.ts` + testes (CA4–CA6).
- [ ] T2. `summarizeRange`, `formatRangeTitle` + testes (CA1–CA3).
- [ ] T3. Rota `periodo`, aba Período e `useRangeData`.
- [ ] T4. `PeriodScreen`: título, setas, totais e semanas (CA1–CA3).
- [ ] T5. `ExportPanel` nas telas Semana e Período (CA7, CA8).
- [ ] T6. Conferência headless e teste do CSV aberto como planilha (CA8, CA9).
- [ ] T7. Atualizar PRODUCT.md (cabeçalho só no CSV), AGENTS.md, ARCHITECTURE.md e o índice de specs.
