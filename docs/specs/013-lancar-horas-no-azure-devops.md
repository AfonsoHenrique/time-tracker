# 013. Lançar horas no Azure DevOps

- **Status**: Rascunho
- **Marco**: 8. Lançamento no Azure DevOps (fase 3)
- **Relacionado**: [ADR 0005](../adr/0005-azure-devops-com-pat-local.md), [005-azure-devops-no-intervalo](005-azure-devops-no-intervalo.md), [007-projeto-e-work-item-na-exportacao](007-projeto-e-work-item-na-exportacao.md), [008-login-e-sincronizacao](008-login-e-sincronizacao.md), [011-calendario-e-horas-decimais](011-calendario-e-horas-decimais.md)

## Contexto

Os intervalos já guardam a task do Azure DevOps e a marca **Declarado** (spec 005), mas o lançamento ainda é à mão. Hoje, para cada task (em geral uma por semana, ex.: `120022 Reunioes e atividades 16 a 19 nov`), o usuário:

1. escolhe o **Tipo de atividade** (campo da organização, obrigatório para sair de New; ex.: Reuniões, Desenvolvimento);
2. preenche **Horas Estimadas** e **Horas Consumidas** com o mesmo total;
3. põe **Start Date** na segunda e **Target Date** na sexta da semana da task;
4. cola em **Detalhes do apontamento** as linhas da planilha daquela task (Data, Início, Fim, Soma, Descrição), ex.: `19/nov 10:30 10:45 0:15 Daily MS`;
5. atribui a task a si mesmo;
6. muda o estado de New para Active e depois para Closed.

Esta spec faz isso pelo app: junta os intervalos por task, mostra uma prévia do que vai ser gravado e, com uma confirmação, preenche a task e marca os intervalos como declarados.

O lançamento usa a **duração real**, com minutos quebrados (ex.: 50 min = 0.83 h). Arredondar para blocos de 15 minutos é preferência de quem usa assim, então vira uma configuração opcional e desligada por padrão. Do mesmo jeito, a task fica em **Active** por padrão, para a pessoa revisar, e fechar direto em **Closed** é configuração.

## Requisitos

### Conexão (aba Dados, só neste aparelho)

- R1. A aba Dados ganha a seção **Azure DevOps** com **Organização** (o nome em `dev.azure.com/{organização}`; também aceita a URL inteira colada, ou `{organização}.visualstudio.com`) e **Token de acesso pessoal (PAT)**. O botão **Testar e salvar** faz uma leitura no Azure DevOps e só grava se der certo.
- R2. O PAT precisa só do escopo **Work Items (Read & write)**. A seção diz isso e tem um link para a página de criação de tokens da organização (`https://dev.azure.com/{organização}/_usersSettings/tokens`).
- R3. Organização, PAT e o mapeamento de campos (R6) ficam **só neste aparelho** (ver ADR 0005): não vão para o banco sincronizado, para o Firestore nem para o backup JSON. Cada aparelho configura o seu. A chave segue o ambiente (`ponto:devops` ou `ponto-hml:devops`), como a data do último backup.
- R4. Conectado, a seção mostra a organização e o nome da conta do token, com **Trocar token** e **Desconectar** (apaga tudo do aparelho). O PAT nunca é mostrado de volta.
- R5. Se o Azure DevOps responder 401 ou 403 (token expirado, revogado ou sem escopo), o app avisa "O token do Azure DevOps não vale mais. Gere outro e cole na aba Dados." e não marca nada como declarado.
- R6. **Campos da organização.** Tipo de atividade e Detalhes do apontamento são campos criados pela organização, com nomes internos que o app não conhece. Depois de conectar, a seção pede o **projeto** (lista dos projetos da organização) e mostra os campos do tipo Task desse projeto em duas listas: **Tipo de atividade** e **Detalhes do apontamento**. O app já deixa escolhidos os campos com esses nomes, quando existirem. Os dois são opcionais: sem o campo mapeado, aquela parte não é preenchida.

### Configurações do lançamento (sincronizadas)

- R7. As **Configurações** do app (sincronizadas e no backup, como a meta diária) ganham duas opções, as duas desligadas por padrão:
  - **Arredondar para 15 min**;
  - **Fechar a task ao lançar** (Closed em vez de Active).
- R8. Uma configuração antiga, sem esses campos, é lida com as duas desligadas.

### O que vai para cada task

- R9. Entram no lançamento os intervalos **fechados** e **com task** da semana ou do período mostrado na tela. Uma task entra na prévia quando tem pelo menos um intervalo **não declarado**; os intervalos já declarados da mesma task também entram no cálculo, para o total e os detalhes saírem completos.
- R10. **Duração de cada intervalo**: sem arredondamento, os minutos exatos. Com **Arredondar para 15 min**, a duração de cada intervalo vai para o múltiplo de 15 mais próximo (até 7 min desce, 8 min ou mais sobe; ex.: 52 min → 45 min, 53 min → 1:00), com mínimo de 15 min. Arredondar por intervalo faz as linhas dos detalhes somarem exatamente o total. Os intervalos gravados não mudam.
- R11. **Horas**: o total da task é a soma das durações do R10, em horas decimais com duas casas (`toDecimalHours`, spec 011: 3:15 → 3.25; 50 min → 0.83). O mesmo valor vai para **Horas Estimadas** (`Microsoft.VSTS.Scheduling.OriginalEstimate`) e **Horas Consumidas** (`Microsoft.VSTS.Scheduling.CompletedWork`). O valor é **substituído**, não somado: lançar de novo a mesma task grava o mesmo total, sem contar duas vezes.
- R12. **Datas**: **Start Date** (`Microsoft.VSTS.Scheduling.StartDate`) recebe a segunda-feira da semana do primeiro intervalo da task, à meia-noite local; **Target Date** (`Microsoft.VSTS.Scheduling.TargetDate`) recebe a sexta-feira da semana do último intervalo, também à meia-noite local.
- R13. **Detalhes do apontamento**: uma linha por intervalo, do mais recente para o mais antigo, no formato `DD/mmm início fim duração observação`, ex.: `19/nov 10:30 10:45 0:15 Daily MS`. A duração é a do R10; início e fim são os horários reais. O campo recebe HTML (uma linha por `<div>`), com o texto escapado. O conteúdo anterior do campo é substituído.
- R14. **Tipo de atividade**: escolhido na prévia, por task, numa lista com os valores permitidos pelo Azure DevOps, lidos do campo mapeado (na organização do Afonso: Análise, Arquitetura/Infraestrutura, Curadoria, Desenvolvimento, Design, Documentação, Gestão de Projetos, Implantação, Prospecção, Requisitos, Reuniões e Teste). O app não guarda essa lista no código, porque cada organização tem a sua. Vem preenchido com o valor atual da task; se ela não tiver, com o último tipo usado neste aparelho.
- R15. **Responsável** (`System.AssignedTo`): a conta do token.
- R16. **Estado**: a task vai para **Active**. Com **Fechar a task ao lançar**, vai em seguida para **Closed**. Uma task que já está em Active ou Closed não volta para trás: Closed fica Closed.
- R17. Intervalos **sem task** não são lançados. A prévia mostra quantos são e o total deles, para o usuário completar a task antes, se quiser.

### Prévia e lançamento

- R18. Semana e Período ganham o botão **Lançar no Azure DevOps**, ao lado da exportação. Sem conexão configurada, o botão leva à seção da aba Dados. Sem nada para lançar, fica desabilitado com o texto "Nada para lançar".
- R19. O botão abre uma folha de **prévia**, um cartão por task, com o que o Azure DevOps tem agora e o que vai ficar: id, título e estado (ex.: `120022 · Reunioes e atividades 16 a 19 nov · New → Active`), tipo de atividade (lista do R14), horas (`0 → 3.25 h`), datas (`16/11 a 20/11`) e as linhas dos detalhes.
- R20. Uma task que não existe, que o token não consegue ler, ou que não é do tipo Task aparece na prévia com o motivo e fica fora do lançamento. As outras seguem. Uma task sem tipo de atividade escolhido, com o campo mapeado, não pode ser lançada até escolher.
- R21. **Confirmar** grava cada task com uma requisição JSON Patch com todos os campos dos R11–R16 e o estado Active. Com **Fechar a task ao lançar**, uma segunda requisição muda para Closed, porque o processo pode não permitir ir de New direto para Closed.
- R22. Cada atualização confere a revisão lida na prévia (operação `test` em `/rev`). Se a task mudou nesse meio tempo, ela não é gravada; o app relê e mostra a prévia de novo.
- R23. Se o Azure DevOps recusar um campo (regra do processo, valor não permitido, campo obrigatório que o app não preenche), a task não é gravada e o resultado mostra a mensagem do Azure DevOps.
- R24. Assim que uma task é gravada com sucesso (Active, ou Closed quando configurado), os intervalos dela são marcados como declarados (`declared: true`), pelo repositório, numa única transação. Uma task que falhou não marca nada. Se a segunda requisição (Closed) falhar, a task fica em Active, os intervalos são marcados e o resultado avisa que falta fechar.
- R25. No fim, o app mostra o resultado por task (lançada, recusada com o motivo, ou sem rede).
- R26. Sem rede, o botão avisa que o lançamento precisa de conexão. Não há fila de lançamento offline.
- R27. Horas Restantes (Remaining Work) não mudam.
- R28. No modo demo da homologação o lançamento fica desligado: a seção da aba Dados explica que o demo não fala com o Azure DevOps.

## Critérios de aceite

Exemplo base: task 120022, em New, com os intervalos da semana de 16/11/2026 (o mesmo da task real):

```
16/nov 10:30–11:00 Daily MS            16/nov 11:00–11:45 Minha Saúde - Uso interno Yuni
17/nov 10:30–10:45 Daily MS            17/nov 14:00–14:30 Minha Saúde: Comitê de Bem Estar
18/nov 09:45–10:15 Problema ambiente MS 18/nov 10:30–11:00 Daily MS
19/nov 10:30–10:45 Daily MS
```

- [ ] CA1. Dado o exemplo base, então a prévia mostra `0 → 3.25 h`, datas `16/11 a 20/11`, `New → Active` e sete linhas de detalhes, a primeira `19/nov 10:30 10:45 0:15 Daily MS` e a última `16/nov 10:30 11:00 0:30 Daily MS`.
- [ ] CA2. Dado o exemplo base e o tipo Reuniões, quando confirmado, então o PATCH tem `test /rev`, OriginalEstimate e CompletedWork `3.25`, StartDate `2026-11-16` e TargetDate `2026-11-20` à meia-noite local (em UTC), o campo de detalhes com as sete linhas, o tipo `Reuniões`, AssignedTo da conta do token e State `Active`; e os sete intervalos ficam declarados.
- [ ] CA3. Com **Fechar a task ao lançar**, depois do CA2 vai um segundo PATCH com State `Closed`. Se ele falhar, os intervalos ficam declarados e o resultado avisa que a task ficou em Active.
- [ ] CA4. Dado um intervalo de 16:00–16:52 (52 min), sem arredondamento a linha diz `0:52` e conta 0.87 h; com **Arredondar para 15 min**, diz `0:45` e conta 0.75 h. 5 min viram 15 min; 53 min viram 1:00.
- [ ] CA5. Dada a task do CA2 já lançada e um intervalo novo dela, quando lançada de novo, então as horas são o total de todos os intervalos (não a soma com o valor antigo) e os detalhes têm todas as linhas.
- [ ] CA6. Dado um intervalo em andamento ou sem task, então ele não entra em nenhuma task; os sem task aparecem na contagem "sem task".
- [ ] CA7. Dadas duas tasks, quando a segunda responde com revisão mudada, 404 ou erro de regra do processo, então só os intervalos da primeira ficam declarados e o resultado mostra o motivo da segunda.
- [ ] CA8. Dado um token expirado (401), quando o usuário testa a conexão ou lança, então aparece o aviso do R5 e nenhum intervalo muda.
- [ ] CA9. Organização, PAT e mapeamento de campos não aparecem no backup JSON baixado, nos documentos do Firestore nem no banco Dexie.
- [ ] CA10. `minha-org`, `https://dev.azure.com/minha-org/`, `https://dev.azure.com/minha-org/Projeto` e `https://minha-org.visualstudio.com` viram a organização `minha-org`; texto com espaços ou barras soltas é recusado.
- [ ] CA11. Um backup ou configuração antiga, sem as duas opções novas, é lida com as duas desligadas.
- [ ] CA12. Uma observação com `<b>` ou `&` vai escapada para o campo de detalhes.
- [ ] CA13. A folha de prévia e a seção da aba Dados cabem em 390 px nos temas claro e escuro.

## Fora do escopo

- Criar a task no Azure DevOps a partir do app (o usuário cria e põe o id nos intervalos, como hoje).
- Login com conta Microsoft (Entra ID) em vez de PAT. Ver ADR 0005.
- Tipo de atividade por intervalo: é um por task, escolhido na prévia.
- Extensões de timesheet do Azure DevOps (7pace, Tempo e similares).
- Desfazer um lançamento.
- Mexer em Horas Restantes ou em outros campos além dos listados.
- Azure DevOps Server (on-premises).

## Desenho

- `src/lib/devopsLaunch.ts` (puro, com teste):
  - `parseOrganization(texto)` → `{ ok: true, value } | { ok: false }` (CA10).
  - `roundToQuarter(minutos)`: múltiplo de 15 mais próximo, mínimo 15 (R10, CA4).
  - `planLaunch(intervalos, { roundQuarter })` → `{ tasks: [{ taskId, minutes, startDate, targetDate, lines, intervalIds, pendingCount }], withoutTask: { count, minutes } }` (R9–R13, R17, CA1, CA5, CA6).
  - `detailLine(intervalo, minutos)` e `detailsHtml(linhas)` (R13, CA12).
  - `buildPatch({ rev, plan, fields, activityType, assignedTo, state })` → JSON Patch (R11–R16, R21, CA2).
  - Horas com `toDecimalHours` de `src/lib/duration.ts`.
- `src/lib/types.ts`: `Settings.launchRoundQuarter: boolean` e `Settings.launchClose: boolean`, `false` em `DEFAULT_SETTINGS`. `settingsProblem` valida, e quem lê configurações antigas (backup, sincronização, banco) completa com `false` (CA11). As regras do Firestore (`firebase/firestore.rules`) e os testes delas aceitam os campos. Se o banco precisar de `upgrade` para completar a linha de configurações, entra a versão 5 do schema.
- `src/devops/` (novo, fala com a rede, fora de `lib/`):
  - `client.ts`: `fetch` para `https://dev.azure.com/{org}/…?api-version=7.1` com `Authorization: Basic base64(':' + PAT)`. `getConnectionData()` (testa e traz a conta do token), `listProjects()`, `listTaskFields(projeto)` (`{projeto}/_apis/wit/workitemtypes/Task/fields`), `getAllowedValues(projeto, campo)`, `getWorkItems(ids)` (lote, com `System.Rev`, `System.State`, `System.WorkItemType`, `System.Title` e os campos do R11–R14) e `patchWorkItem(id, patch)` com `Content-Type: application/json-patch+json`. Erros viram códigos (`unauthorized`, `not-found`, `conflict`, `rule`, `offline`, `unknown`), e `rule` leva a mensagem do Azure DevOps. A API aceita CORS de qualquer origem com o cabeçalho `Authorization` (conferido com um `OPTIONS` em 2026-11-21).
  - `connection.ts`: ler, gravar e apagar organização, PAT, projeto, mapeamento de campos e último tipo de atividade no `localStorage` com a chave do ambiente. Fica fora de `src/db/` de propósito, para não entrar na `outbox` nem no backup.
- `src/features/devops/`: `LaunchButton`, `LaunchSheet` (prévia, confirmar, resultado) e `DevOpsSection` da aba Dados. Usam `useRangeData` e marcam os intervalos com uma função nova do repositório, `markDeclared(ids)`, que grava `declared: true` e `updatedAt` numa transação (e entra na `outbox`, como toda gravação).
- A ordem é sempre: gravar a task no Azure DevOps e, só se der certo, marcar os intervalos. Como as horas e os detalhes são substituídos, e não somados, repetir um lançamento que ficou pela metade não conta horas em dobro.

## Perguntas em aberto

- P1. Na task de exemplo, os detalhes têm um grupo de linhas separado por uma linha em branco (as de "Minha Saúde"). Essa separação segue alguma regra (projeto, tipo de atividade), ou é só organização à mão? Esta spec gera uma lista única, do mais recente para o mais antigo.

## Tarefas

- [ ] T1. `lib/devopsLaunch.ts` com testes (CA1, CA2, CA4–CA6, CA10, CA12).
- [ ] T2. Opções de lançamento nas configurações, validação, backup, sincronização e regras do Firestore, com testes (CA11).
- [ ] T3. `src/devops/` (cliente e conexão local) com testes usando `fetch` falso (CA2, CA3, CA7–CA9).
- [ ] T4. `markDeclared(ids)` no repositório, com teste.
- [ ] T5. Seção Azure DevOps na aba Dados: conexão, projeto e campos (R1–R6, R28).
- [ ] T6. Botão e folha de prévia em Semana e Período (R18–R26).
- [ ] T7. Conferência headless em 390 px, claro e escuro (CA13), com o Azure DevOps simulado.
- [ ] T8. Conferência com o Afonso numa task real, em Active.
- [ ] T9. Atualizar PRODUCT.md, ARCHITECTURE.md, AGENTS.md e o índice de specs.
