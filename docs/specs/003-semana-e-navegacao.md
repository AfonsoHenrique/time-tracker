# 003. Semana e navegação

- **Status**: Concluída
- **Marco**: 4
- **Relacionado**: [PRODUCT.md](../PRODUCT.md), [002-tela-hoje](002-tela-hoje.md)

## Contexto

Na maior parte do tempo, você só olha a semana atual, para saber se está fechando as 40h. Esta spec cria a tela Semana e uma navegação simples entre as telas. As telas Período e Dados entram nas specs 004 e 005.

## Requisitos

- R1. Uma barra de abas fixa no rodapé com **Hoje** e **Semana**. As abas Período e Dados aparecem quando as specs 004 e 005 forem entregues.
- R2. A tela Semana tem um título com o intervalo da semana (ex.: "2 a 8 de novembro") e setas ‹ › para trocar de semana. O botão **Esta semana** aparece quando você está em outra semana.
- R3. A tela tem uma linha por dia, de segunda a domingo, com o dia (ex.: "Seg 09/11"), o trabalhado e a meta. Ela também mostra:
  - "sem meta" nos dias sem meta;
  - um alerta ⚠ nos dias irregulares;
  - o dia de hoje em destaque.
- R4. Abaixo das linhas aparecem os totais da semana: trabalhado, meta e falta (ou excedente).
- R5. Tocar num dia abre a tela Hoje naquele dia. Voltar para a Semana mantém a semana que estava aberta.
- R6. A aba escolhida e o dia ou semana mostrados ficam na URL (`#/hoje/2026-11-09`, `#/semana/2026-11-02`). Assim o botão voltar do Android e do navegador funciona, e recarregar a página não perde o lugar. Sem data, a tela mostra hoje ou a semana atual.
- R7. Os valores incluem um intervalo em andamento e sobem sozinhos, como na tela Hoje.

## Critérios de aceite

- [x] CA1. Dada a semana de 09/11 com 8:30 na segunda, 7:00 na terça e nada no resto, então a tela mostra essas linhas, total 15:30, meta 40:00 e falta 24:30.
- [x] CA2. Dada uma segunda marcada como sem meta, então a linha dela mostra "sem meta", e a meta da semana é 32:00.
- [x] CA3. Dado um dia com intervalo sobreposto, então a linha dele mostra o alerta ⚠.
- [x] CA4. Quando toco na seta ‹, então aparece a semana anterior e o botão Esta semana. Quando toco em Esta semana, volto para a atual.
- [x] CA5. Quando toco na terça, então a tela Hoje abre na terça. Quando aperto voltar, volto para a Semana, na mesma semana.
- [x] CA6. Abrindo `#/semana/2026-11-04`, então a tela mostra a semana de 2 a 8 de novembro. Uma data inválida mostra a semana atual.
- [x] CA7. Em 390×800, nos temas claro e escuro, a barra de abas fica visível, sem cobrir o conteúdo e sem rolagem horizontal.

## Fora do escopo

- Telas Período e Dados (specs 004 e 005).
- Gráficos.
- Editar intervalos direto na tela Semana: a edição continua na tela Hoje.

## Desenho

- Rota por hash, sem biblioteca de roteamento: `src/lib/route.ts` (puro, com teste) faz `parseRoute(hash)` e `routeHash(route)`. Um hook `useRoute()` escuta `hashchange`.
- A tela Hoje passa a receber o dia pela rota em vez de guardá-lo no estado. A regra de "seguir hoje" continua: sem data na rota, a tela mostra hoje.
- `src/features/week/WeekScreen.tsx` usa `summarizeWeek` e `findIrregularities`. Os dados vêm de um hook que lê a semana pelo repositório, reaproveitando o carregamento da tela Hoje (o `useToday` vira `useWeekData`).
- `src/components/TabBar.tsx` é a barra de abas, com `padding-bottom` para a área segura do celular. O `.app` ganhou espaço embaixo para a barra não cobrir o fim da tela.
- `useRoute().navigate(rota, { replace })`: abrir um dia pela Semana cria entrada no histórico; setas, "Voltar para hoje" e "Esta semana" usam `replace`.
- `Stat` e `BalanceStat` foram para `src/components/Stat.tsx`, usados nas duas telas. `useNow`, `useWeekData` e `errors` foram para `src/features/shared/`.
- Na entrega, os critérios foram conferidos por um roteiro Playwright com relógio simulado (fuso America/Sao_Paulo), junto com o roteiro da spec 002, que continua passando.
- `formatWeekTitle(range)` em `src/lib/clock.ts` gera "2 a 8 de novembro" e "30 de novembro a 6 de dezembro".

## Tarefas

- [x] T1. `lib/route.ts` + testes (CA6).
- [x] T2. `formatWeekTitle` + teste.
- [x] T3. `useRoute`, barra de abas e tela Hoje lendo o dia da rota (CA5).
- [x] T4. `WeekScreen` com linhas, totais, setas e Esta semana (CA1–CA4).
- [x] T5. Estilos e conferência headless (CA7).
- [x] T6. Atualizar AGENTS.md, ARCHITECTURE.md e o índice de specs.
