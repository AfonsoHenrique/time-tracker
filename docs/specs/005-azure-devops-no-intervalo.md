# 005. Campos do Azure DevOps no intervalo

- **Status**: Concluída
- **Marco**: 5.1
- **Relacionado**: [PRODUCT.md](../PRODUCT.md) (seções Registro e Exportação), [001-dados-e-regras](001-dados-e-regras.md), [004-periodo-e-exportacao](004-periodo-e-exportacao.md)

## Contexto

As horas terminam lançadas numa task do Azure DevOps. Até aqui o intervalo só tinha observação, e a ligação com o work item e a task ficava na cabeça do usuário ou na planilha. Esta spec guarda essa ligação no próprio intervalo e marca o que já foi declarado, para saber o que ainda falta lançar.

Exemplo: `09:00–09:30 Daily equipe IA · Work item 123567 · Task 123568 · Declarado`.

Isto revê a decisão "não há campo de task por intervalo" do plano inicial: os campos são opcionais, e um bloco grande continua podendo ficar sem nenhum deles.

## Requisitos

- R1. O intervalo ganha três campos:
  - **Work item** (`workItemId: number | null`): id do work item do Azure DevOps ao qual o intervalo pertence. Opcional.
  - **Task** (`taskId: number | null`): id da task filha desse work item, onde as horas são declaradas. Opcional.
  - **Declarado** (`declared: boolean`): se as horas já foram lançadas no Azure DevOps. Padrão `false`.
- R2. Os ids são inteiros de 1 a 2.147.483.647. No formulário, vazio quer dizer "sem", espaços nas pontas e um `#` na frente (`#123567`) são aceitos. Qualquer outro texto é erro e nada é gravado.
- R3. Work item e task são independentes: dá para preencher só um deles. O app não confere se a task é mesmo filha do work item (não há integração na fase 1).
- R4. A folha de adicionar/editar intervalo tem um grupo **Azure DevOps** com os campos Work item, Task e a caixa **Declarado no Azure DevOps**.
- R5. Na lista de intervalos da tela Hoje, abaixo da observação, aparece `WI 123567 · Task 123568 · ✓ Declarado`, só com o que estiver preenchido. Sem nada, a linha não aparece.
- R6. "Entrar" cria o intervalo sem esses campos; "Sair" mantém o que foi preenchido no intervalo aberto.
- R7. Migração: o banco passa para a versão 2 do schema. Os intervalos que já existem ficam com `workItemId: null`, `taskId: null`, `declared: false`. Os índices não mudam.
- R8. Exportação: a coluna **TASK** da planilha recebe o id da task. Projeto e Detalhe continuam vazios. Work item e Declarado não viram colunas, porque a aba SEMANA não tem lugar para eles.
- R9. Backup JSON (spec seguinte): o export leva os três campos, e o import de um backup antigo, sem eles, usa os mesmos padrões da migração (`withDevOpsDefaults`).

## Critérios de aceite

- [x] CA1. Dado o intervalo 09:00–09:30 "Daily equipe IA", work item 123567, task 123568 e Declarado marcado, quando salvo, então ele é gravado com `workItemId: 123567`, `taskId: 123568`, `declared: true` e a lista mostra `WI 123567 · Task 123568 · ✓ Declarado`.
- [x] CA2. Dado um intervalo com work item e task, quando só Declarado é marcado, então os ids continuam os mesmos. Apagar o texto da task grava `taskId: null`.
- [x] CA3. Dado `abc`, `12.5`, `0` ou `-3` no work item ou na task, então o formulário mostra o erro e o repositório recusa com `invalid-interval`.
- [x] CA4. Dado um banco na versão 1 com intervalos, quando o app abre, então eles continuam lá, iguais, com work item e task vazios e não declarados.
- [x] CA5. Dado o intervalo do CA1, então a exportação gera `seg | 09/11/2026 | 09:00 | 09:30 | 0:30 | Daily equipe IA | 123568 | (vazio) | (vazio)`.
- [x] CA6. A folha com os novos campos cabe em 390 px nos temas claro e escuro, e no celular os campos de id abrem o teclado numérico.

## Fora do escopo

- Buscar ou validar work items e tasks no Azure DevOps, ou lançar as horas por lá (fase 3).
- Marcar vários intervalos como declarados de uma vez, ou filtrar "não declarados" (pode virar spec própria).
- Lembrar o último work item usado ou sugerir ids.
- Nome ou título do work item: só o id.

## Desenho

- `src/lib/types.ts`: os três campos em `Interval` e `EMPTY_DEVOPS_FIELDS` com os padrões.
- `src/lib/devops.ts` (puro, com teste): `isDevOpsId`, `parseDevOpsId(texto)` para o formulário, `withDevOpsDefaults(linha)` para a migração e o import de backups antigos, e `formatDevOpsRefs` para a lista.
- `src/lib/clock.ts`: `IntervalForm` ganha `workItem`, `task` (texto) e `declared`; `readIntervalForm` devolve `workItemId`, `taskId` e `declared`.
- `src/db/schema.ts`: `version(2)` com os mesmos índices e `upgrade` que aplica `withDevOpsDefaults` em cada intervalo.
- `src/db/repository.ts`: `NewInterval` e `IntervalPatch` aceitam os campos; ids inválidos falham com `invalid-interval`. No patch, `undefined` mantém e `null` limpa.
- `src/lib/export.ts`: TASK = `taskId`.
- Ids como `number`, e não texto, porque o Azure DevOps usa inteiros e isso deixa a validação num lugar só. Campos de id são `type="text"` com `inputMode="numeric"`, para aceitar o `#` colado do Azure DevOps.

## Tarefas

- [x] T1. Tipos, `lib/devops.ts` e testes (CA3, CA4).
- [x] T2. Formulário em `clock.ts` + testes (CA1–CA3).
- [x] T3. Schema versão 2 com migração e repositório + testes (CA1–CA4).
- [x] T4. Exportação com TASK + teste (CA5).
- [x] T5. Folha de intervalo e lista da tela Hoje (CA1, CA6).
- [x] T6. Conferência headless em 390 px, claro e escuro (CA6).
- [x] T7. Atualizar PRODUCT.md, ARCHITECTURE.md, AGENTS.md e o índice de specs.
