# 009. Previsão do horário de saída

- **Status**: Rascunho
- **Marco**: 3.1
- **Relacionado**: [002-tela-hoje](002-tela-hoje.md), [001-dados-e-regras](001-dados-e-regras.md)

## Contexto

Durante o dia, a tela Hoje mostra quanto falta para a meta, mas não **a que horas** ela fecha. A conta de cabeça precisa lembrar do almoço: o normal é entrar 08:00, almoçar 12:00–13:00 e sair 17:00. Se o primeiro ponto foi 08:32, a saída vira 17:32. A previsão deve reservar cerca de 1h de almoço enquanto ele ainda pode acontecer, e parar de reservar quando o almoço já foi feito ou quando já ficou tarde para ele.

## Requisitos

- R1. Na tela Hoje, só no dia de hoje, aparece **Saída prevista HH:MM**, atualizada sozinha com o relógio.
- R2. A previsão é `agora + falta no dia + reserva de almoço`. Dentro (intervalo aberto), ela fica parada enquanto se trabalha; fora, ela anda com o relógio, porque supõe que a volta é agora.
- R3. **Reserva de almoço**: 1:00, menos o que já passou da pausa em andamento. Ela só existe enquanto o almoço ainda é provável, ou seja, quando todas estas valem:
  - nenhuma pausa já encerrada no dia (o vão entre o fim de um intervalo e o início do seguinte) tem 45 min ou mais;
  - a primeira entrada do dia foi antes de 12:00;
  - estando dentro, agora é antes de 14:00; estando fora, a pausa atual começou antes de 14:00.
- R4. Quando a reserva entra na conta, a tela diz isso em texto curto, ex.: "Saída prevista 17:32 · com 1:00 de almoço". Fora, com a pausa contando como almoço: "Saída prevista 17:32 · se voltar até 13:32".
- R5. Se a meta do dia já foi cumprida, aparece **Meta fechada às HH:MM** (o minuto em que o trabalhado chegou à meta).
- R6. Não aparece previsão quando: a meta do dia é 0 (fim de semana ou dia sem meta), ainda não há intervalo no dia, há um intervalo aberto que começou em outro dia, ou o dia mostrado não é hoje.
- R7. Os números (1:00 de almoço, pausa longa de 45 min, almoço só antes de 14:00, primeira entrada antes de 12:00) são constantes em `src/lib/`, não configurações editáveis.
- R8. Se a previsão passar da meia-noite, a hora vem com "(amanhã)".

## Critérios de aceite

- [ ] CA1. Dado entrada 08:32 e o relógio em 09:00 (dentro), então a saída prevista é 17:32, com 1:00 de almoço.
- [ ] CA2. Dado 08:00–12:00 e o relógio em 12:20 (fora), então a saída prevista é 17:00 e o texto diz "se voltar até 13:00".
- [ ] CA3. Dado 08:32–12:32 e 13:32–agora, com o relógio em 14:00, então a saída prevista é 17:32, sem almoço.
- [ ] CA4. Dado 08:00–10:00 e 10:10–agora, com o relógio em 11:00 (pausa de 10 min, abaixo de 45), então a saída prevista é 17:10, com 1:00 de almoço.
- [ ] CA5. Dado 08:00–agora, sem pausa, com o relógio em 14:30, então a saída prevista é 16:00, sem almoço (ficou tarde).
- [ ] CA6. Dado primeira entrada às 13:00 e o relógio em 13:30, então a saída prevista é 21:00, sem almoço.
- [ ] CA7. Dado 08:00–12:00 e 13:00–17:10, então aparece "Meta fechada às 17:00".
- [ ] CA8. Num sábado, num dia sem meta ou num dia útil ainda sem intervalo, a previsão não aparece.
- [ ] CA9. Na tela de ontem, a previsão não aparece.
- [ ] CA10. A linha cabe em 390×800, nos temas claro e escuro, sem rolagem horizontal.

## Fora do escopo

- Previsão para a semana (a que horas de sexta a semana fecha).
- Configurar duração e janela do almoço na tela de configurações.
- Avisos ou notificações perto do horário de saída.
- Previsão antes da primeira entrada ("se entrar agora, sai às…").

## Desenho

- `src/lib/forecast.ts` (puro, com teste): `forecastDayEnd({ date, intervals, target, now })` devolve
  `{ kind: 'none' }`, `{ kind: 'done', at }` ou `{ kind: 'forecast', at, lunchMinutes, returnBy }`, em que `returnBy` só vem quando se está fora e a pausa conta como almoço. Usa `intervalsOfDay` e `workedMinutes` de `balance.ts`.
- Constantes no mesmo arquivo: `LUNCH_MINUTES = 60`, `LONG_BREAK_MINUTES = 45`, `LUNCH_LATEST_START = '14:00'`, `LUNCH_FIRST_ENTRY_BEFORE = '12:00'`.
- Para "Meta fechada às", percorre os intervalos em ordem e acha o minuto em que a soma chega à meta.
- `TodayScreen` mostra a linha entre o resumo e a linha de metas, só quando `isToday`. Formatação com `formatTime`; o texto da linha sai de uma função pura em `clock.ts` (`formatForecast`), para ter teste.
- Testes com `at()` e `iv()` de `test-helpers.ts`. A tela é conferida com o build de produção num navegador headless (390×800, claro e escuro) com relógio simulado.

## Tarefas

- [ ] T1. `lib/forecast.ts` + testes (CA1–CA8 na lógica).
- [ ] T2. `formatForecast` em `clock.ts` + teste.
- [ ] T3. Linha na `TodayScreen` e estilo (CA9, CA10); conferência headless.
- [ ] T4. Atualizar PRODUCT.md, AGENTS.md (estrutura de `lib/`) e o índice de specs.
