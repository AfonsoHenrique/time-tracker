# 011. Calendário para pular de data e horas decimais

- **Status**: Concluída
- **Marco**: 4.1
- **Relacionado**: [003-semana-e-navegacao](003-semana-e-navegacao.md), [004-periodo-e-exportacao](004-periodo-e-exportacao.md), [005-azure-devops-no-intervalo](005-azure-devops-no-intervalo.md)

## Contexto

Hoje só dá para trocar de dia, semana ou período com as setas ‹ ›, um passo por vez. Para conferir um dia de dois meses atrás é preciso tocar dezenas de vezes. Esta spec põe um calendário no título dessas telas para pular direto para qualquer data.

Além disso, as horas são declaradas no Azure DevOps em horas decimais (escala de 100), não em H:MM: 30 min = 0.5, 45 min = 0.75, 1:30 = 1.5. Converter de cabeça cada intervalo é chato e dá erro, então o card do intervalo passa a mostrar também esse valor.

## Requisitos

### Calendário

- R1. Nas telas **Hoje**, **Semana** e **Período**, tocar no título (ex.: "Domingo, 15 de novembro", "2 a 8 de novembro") abre o calendário nativo do navegador (`<input type="date">`), já posicionado na data mostrada. O título ganha um ícone 📅 discreto para indicar que é tocável. As setas ‹ › continuam como estão.
- R2. Escolher uma data leva para:
  - **Hoje**: aquele dia;
  - **Semana**: a semana que contém aquele dia;
  - **Período**: o período 26–25 que contém aquele dia.
- R3. A data escolhida vai para a URL como já acontece com as setas (`replace`, sem nova entrada no histórico). Escolher a data de hoje (ou um dia da semana/período atual) volta ao modo "seguir hoje" (rota sem data), igual aos botões **Voltar para hoje**, **Esta semana** e **Este período**.
- R4. Dá para escolher datas no futuro, como já dá com a seta ›. Cancelar ou limpar o calendário não muda nada.

### Horas decimais no intervalo

- R5. No card de cada intervalo da tela Hoje, ao lado da duração H:MM, aparece a duração em **horas decimais**: ex.: `1:30 · 1.5 h`.
- R6. Conversão: `horas = minutos / 60`, arredondado para **2 casas, meio para cima**. Como os minutos são inteiros, o valor exato nunca cai num meio (a terceira casa é sempre 0, 3 ou 6), então na prática a regra é "arredondar para o centésimo mais próximo". Exemplos: 30 min → 0.5; 45 min → 0.75; 35 min → 0.58; 1:30 → 1.5; 2:00 → 2; 1 min → 0.02; 0 min → 0.
- R7. Formato: ponto como separador decimal, como nos exemplos que você usa no DevOps, e sem zeros à direita (`2`, `1.5`, `0.75`, não `2.00` nem `1.50`). Seguido de ` h`.
- R8. Intervalo aberto (em andamento): mostra o decimal da duração até agora, que sobe junto com o H:MM, a cada minuto.
- R9. A conversão é lógica pura em `src/lib/duration.ts`, com teste, sem depender de React.

## Critérios de aceite

- [x] CA1. Dado a tela Hoje em 15/11, quando toco no título e escolho 10/09/2026, então o título mostra "Quinta, 10 de setembro", a URL fica `#/hoje/2026-09-10` e aparece **Voltar para hoje**.
- [x] CA2. Dado a tela Semana, quando escolho 04/11/2026 no calendário, então aparece a semana de 2 a 8 de novembro e a URL fica `#/semana/2026-11-02`.
- [x] CA3. Dado a tela Período, quando escolho 27/09/2026, então aparece o período de 26 de setembro a 25 de outubro.
- [x] CA4. Dado um dia antigo aberto, quando escolho a data de hoje no calendário, então a rota volta para `#/hoje` (sem data) e o botão **Voltar para hoje** some.
- [x] CA5. Dado intervalos de 30, 45, 35, 90, 120 e 1 minuto, então os cards mostram 0.5 h, 0.75 h, 0.58 h, 1.5 h, 2 h e 0.02 h.
- [x] CA6. Dado um intervalo aberto desde 08:00 e o relógio em 08:20, então o card mostra `0:20 · 0.33 h`; às 08:21, `0:21 · 0.35 h`.
- [x] CA7. Em 390×800, nos temas claro e escuro, o título com o ícone cabe entre as setas sem quebrar o layout, e o card do intervalo com o decimal não quebra linha nem rola na horizontal.

## Fora do escopo

- **Decimal nos totais** (trabalhado do dia, da semana, período e coluna Soma da exportação). Não foi pedido. Fica como sugestão: se quiser, é uma linha a mais por tela, e a exportação poderia ganhar uma coluna. Atenção: a soma dos decimais arredondados de cada intervalo pode diferir em 0.01 do decimal do total (ex.: três intervalos de 35 min somam 0.58 × 3 = 1.74, mas 1:45 = 1.75). Para declarar no DevOps por task, o que vale é o valor de cada intervalo.
- Vírgula decimal ou escolher o formato nas configurações.
- Calendário próprio ou biblioteca de calendário: o nativo do Chrome (Mac e Android) basta.
- Marcar no calendário os dias com horas ou irregulares (o calendário nativo não permite).
- Arredondamento do horário em blocos de 15 min (fase 3).

## Desenho

- `src/lib/duration.ts`: `toDecimalHours(minutes: number): number` (`Math.round(minutes * 100 / 60) / 100`, com minutos já inteiros) e `formatDecimalHours(minutes: number): string` (ex.: `"0.58 h"`; `String(numero)` já tira os zeros à direita). Testes com os exemplos de R6 e negativos não se aplicam (duração de intervalo nunca é negativa; o teste fixa que 0 vira `"0 h"`).
- Componente `src/components/DatePickerTitle.tsx`: um `<label>` com o `<h1>` e um `<input type="date">` visualmente escondido por cima do título, com `aria-label` ("Escolher data"). No clique chama `input.showPicker()` quando existir (Chrome), senão o foco no input abre o seletor. `onChange` com valor vazio é ignorado. Sem regra de negócio: recebe `value` (dia `AAAA-MM-DD`) e `onPick(day)`.
- Cada tela traduz o dia escolhido: Hoje usa o `goTo` que já existe; Semana usa `weekRange(dia).start` e compara com a semana atual; Período usa `periodRange(dia, settings.periodStartDay)` e compara com o período atual. A comparação "é o atual → rota sem data" já existe nas setas e é reaproveitada.
- `TodayScreen`: no card, `<span className="interval-duration">` passa a ter `formatDuration(...)` e um `<span className="interval-decimal muted">` com `formatDecimalHours(...)`.
- Sem mudança de dados salvos, sem migração do Dexie.
- Na entrega, os critérios foram conferidos com Playwright no build de homologação com o modo demo (fuso America/Sao_Paulo, 390×800, claro e escuro): o calendário foi acionado preenchendo o `<input type="date">`, e a largura da página ficou em 390 px.

## Tarefas

- [x] T1. `toDecimalHours` e `formatDecimalHours` + testes (CA5, CA6).
- [x] T2. Decimal no card do intervalo (R5, R8).
- [x] T3. `DatePickerTitle` e uso nas telas Hoje, Semana e Período (CA1–CA4).
- [x] T4. Estilos e conferência headless em 390×800, claro e escuro (CA7).
- [x] T5. Atualizar PRODUCT.md, AGENTS.md (se a estrutura mudar) e o índice de specs.
