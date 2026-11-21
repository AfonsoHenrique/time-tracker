# 013. Lançar horas no Azure DevOps

- **Status**: Rascunho
- **Marco**: 8. Lançamento no Azure DevOps (fase 3)
- **Relacionado**: [ADR 0005](../adr/0005-azure-devops-com-pat-local.md), [005-azure-devops-no-intervalo](005-azure-devops-no-intervalo.md), [007-projeto-e-work-item-na-exportacao](007-projeto-e-work-item-na-exportacao.md), [008-login-e-sincronizacao](008-login-e-sincronizacao.md), [011-calendario-e-horas-decimais](011-calendario-e-horas-decimais.md)

## Contexto

Os intervalos já guardam a task do Azure DevOps e a marca **Declarado** (spec 005), mas o lançamento ainda é à mão: o usuário soma as horas de cada task, abre o Azure DevOps, soma ao **Completed Work** da task e volta ao app para marcar os intervalos como declarados. Esta spec faz isso por ele: o app junta os intervalos não declarados por task, mostra quanto vai lançar e, com uma confirmação, atualiza as tasks e marca os intervalos.

O lançamento usa a **duração real**, com minutos quebrados (ex.: 50 min = 0.83 h). Arredondar para blocos de 15 minutos é preferência de quem usa assim, então vira uma configuração opcional e desligada por padrão.

## Requisitos

### Conexão

- R1. A aba Dados ganha a seção **Azure DevOps** com dois campos: **Organização** (o nome em `dev.azure.com/{organização}`; também aceita a URL inteira colada, ou `{organização}.visualstudio.com`) e **Token de acesso pessoal (PAT)**. O botão **Testar e salvar** faz uma leitura no Azure DevOps e só grava se der certo.
- R2. O PAT precisa só do escopo **Work Items (Read & write)**. A seção diz isso e tem um link para a página de criação de tokens da organização (`https://dev.azure.com/{organização}/_usersSettings/tokens`).
- R3. Organização e PAT ficam **só neste aparelho** (ver ADR 0005): não vão para o banco sincronizado, para o Firestore nem para o backup JSON. Cada aparelho configura o seu. A chave segue o ambiente (`ponto:devops` ou `ponto-hml:devops`), como a data do último backup.
- R4. Conectado, a seção mostra a organização e o nome da conta do token, com **Trocar token** e **Desconectar** (apaga organização e PAT do aparelho). O PAT nunca é mostrado de volta na tela.
- R5. Se o Azure DevOps responder 401 ou 403 (token expirado, revogado ou sem escopo), o app avisa "O token do Azure DevOps não vale mais. Gere outro e cole na aba Dados." e não marca nada como declarado.

### O que lançar

- R6. Entram no lançamento os intervalos **fechados**, **não declarados** e **com task**, da semana ou do período mostrado na tela.
- R7. Os intervalos são agrupados por task. Dentro de cada task, a soma é feita **por dia**: soma dos minutos dos intervalos daquela task naquele dia. O total da task é a soma dos seus dias.
- R8. Sem arredondamento (padrão), o valor de cada dia é a soma exata dos minutos.
- R9. Com a configuração **Arredondar para 15 min** ligada, o valor de cada dia de cada task vai para o múltiplo de 15 mais próximo (até 7 min desce, 8 min ou mais sobe; ex.: 52 min → 45 min, 53 min → 1:00). Um dia com algum minuto nunca vira zero: o mínimo é 15 min. Os intervalos gravados não mudam; o arredondamento vale só para o que vai para o Azure DevOps.
- R10. A configuração de arredondamento fica nas **Configurações** do app (sincronizada e no backup, como a meta diária), com padrão desligado.
- R11. O total de cada task vai em horas decimais com duas casas (`toDecimalHours` de `src/lib/duration.ts`: 50 min → 0.83 h; 1:30 → 1.5 h), o mesmo número que a lista de intervalos já mostra (spec 011). A soma é feita em minutos e só o total da task vira horas.
- R12. Intervalos não declarados **sem task** não são lançados. A prévia mostra quantos são e o total deles, para o usuário completar a task antes, se quiser.

### Prévia e lançamento

- R13. Semana e Período ganham o botão **Lançar no Azure DevOps**, ao lado da exportação. Sem conexão configurada, o botão leva à seção da aba Dados. Sem nada para lançar, ele fica desabilitado com o texto "Nada para lançar".
- R14. O botão abre uma folha de **prévia**, uma linha por task: id, título e tipo do work item (lidos do Azure DevOps), Completed Work atual, horas a somar e o valor final. Ex.: `Task 123568 · Ajustes na API · 4.5 h + 2.83 h = 7.33 h`. Expandindo a linha, aparecem os dias e os intervalos que entram.
- R15. Uma task que não existe, que o token não consegue ler, ou cujo tipo não tem o campo Completed Work aparece na prévia com o motivo e fica fora do lançamento. As outras seguem.
- R16. **Confirmar** soma as horas ao campo `Microsoft.VSTS.Scheduling.CompletedWork` de cada task, uma requisição por task. Se o campo estiver vazio, conta como zero.
- R17. Cada atualização inclui um comentário no histórico da task, para dar para conferir depois: `Ponto: +2.83 h (seg 09/11: 1.5 h; ter 10/11: 1.33 h)`.
- R18. Cada atualização confere a revisão lida na prévia (operação `test` em `/rev`). Se a task mudou nesse meio tempo, aquela task não é atualizada, o app relê e mostra a prévia de novo com o valor novo.
- R19. Assim que uma task é atualizada com sucesso, os intervalos dela são marcados como declarados (`declared: true`), pelo repositório, numa única transação. Uma task que falhou não marca nada.
- R20. No fim, o app mostra o resultado por task (lançada, recusada com o motivo, ou sem rede) e o total lançado.
- R21. Sem rede, o botão avisa que o lançamento precisa de conexão. Não há fila de lançamento offline.
- R22. O Remaining Work da task não muda.
- R23. No modo demo da homologação o lançamento fica desligado: a seção da aba Dados explica que o demo não fala com o Azure DevOps.

## Critérios de aceite

- [ ] CA1. Dados três intervalos não declarados da task 123568 (seg 09:00–10:30, ter 14:00–14:50, ter 16:00–16:30), sem arredondamento, então a prévia mostra `Task 123568 · +2.83 h` (seg 1:30, ter 1:20).
- [ ] CA2. Dados os mesmos intervalos com **Arredondar para 15 min** ligado, então seg fica 1:30, ter fica 1:15 e a prévia mostra `+2.75 h`.
- [ ] CA3. Com arredondamento ligado, um dia com 5 min na task vira 15 min; um dia com 52 min vira 45 min; um com 53 min vira 1:00.
- [ ] CA4. Dado um intervalo já declarado, em andamento ou sem task, então ele não entra em nenhuma task da prévia; os sem task aparecem na contagem "sem task".
- [ ] CA5. Dada a task 123568 com Completed Work 4.5 e revisão 12, quando o lançamento de 2.83 h é confirmado, então o app envia um PATCH com `test /rev = 12`, `add /fields/Microsoft.VSTS.Scheduling.CompletedWork = 7.33` e o comentário do R17, e os intervalos da task ficam declarados.
- [ ] CA6. Dadas duas tasks, quando a segunda responde 409/412 (revisão mudou) ou 404, então só os intervalos da primeira ficam declarados e o resultado mostra o motivo da segunda.
- [ ] CA7. Dado um token expirado (401), quando o usuário testa a conexão ou lança, então aparece o aviso do R5 e nenhum intervalo muda.
- [ ] CA8. Organização e PAT não aparecem no backup JSON baixado, nem nos documentos do Firestore, nem no banco Dexie.
- [ ] CA9. `minha-org`, `https://dev.azure.com/minha-org/`, `https://dev.azure.com/minha-org/Projeto` e `https://minha-org.visualstudio.com` viram a organização `minha-org`; texto com espaços ou barras soltas é recusado.
- [ ] CA10. Um backup ou configuração antiga, sem o campo de arredondamento, é lido com o arredondamento desligado.
- [ ] CA11. A folha de prévia e a seção da aba Dados cabem em 390 px nos temas claro e escuro.

## Fora do escopo

- Login com conta Microsoft (Entra ID) para o Azure DevOps em vez de PAT. Ver ADR 0005.
- Extensões de timesheet do Azure DevOps (7pace, Tempo e similares) e lançamento com data por dia. O Azure DevOps puro só tem o total de Completed Work na task.
- Criar tasks, buscar work items por texto ou sugerir a task de um intervalo.
- Desfazer um lançamento. O comentário no histórico mostra o que foi somado, e o usuário corrige no Azure DevOps e desmarca Declarado no app.
- Mexer no Remaining Work ou no estado da task.
- Lançar intervalos de várias semanas fora da tela atual de uma vez (o Período já cobre o mês).
- Azure DevOps Server (on-premises).

## Desenho

- `src/lib/devopsLaunch.ts` (puro, com teste):
  - `parseOrganization(texto)` → `{ ok: true, value } | { ok: false }` (CA9).
  - `roundToQuarter(minutos)`: múltiplo de 15 mais próximo, mínimo 15 quando há minutos (R9, CA3).
  - `planLaunch(intervalos, { roundingMinutes })` → `{ tasks: [{ taskId, days: [{ date, minutes, intervalIds }], minutes, intervalIds }], withoutTask: { count, minutes } }` (R6–R12, CA1–CA4).
  - `buildPatch({ rev, current, addMinutes, days })` → o JSON Patch do R16–R18 (CA5), e `launchComment(days)`.
- `src/lib/types.ts`: `Settings.launchRoundingMinutes: 0 | 15`, padrão `0` em `DEFAULT_SETTINGS`. `settingsProblem` aceita só esses valores, e quem lê configurações antigas (backup, sincronização, banco) completa com `0` (CA10). As regras do Firestore (`firebase/firestore.rules`) e os testes delas aceitam o campo novo. Como `settings` é uma linha só, não precisa de índice novo; se o banco precisar de `upgrade` para completar o campo, entra a versão 5 do schema.
- `src/devops/` (novo, fala com a rede, fora de `lib/`):
  - `client.ts`: `fetch` para `https://dev.azure.com/{org}/_apis/…?api-version=7.1` com `Authorization: Basic base64(':' + PAT)`. `getConnectionData()` para testar a conexão (`_apis/connectionData`), `getWorkItems(ids)` (lote de até 200, campos `System.Title`, `System.WorkItemType`, `System.Rev`, `CompletedWork`) e `patchWorkItem(id, patch)` com `Content-Type: application/json-patch+json`. Erros viram códigos (`unauthorized`, `not-found`, `conflict`, `offline`, `unknown`). A API do Azure DevOps aceita CORS de qualquer origem com o cabeçalho `Authorization` (conferido com um `OPTIONS` em 2026-11-21).
  - `connection.ts`: ler, gravar e apagar organização e PAT no `localStorage` com a chave do ambiente. Fica fora de `src/db/` de propósito, para não entrar na `outbox` nem no backup.
- `src/features/devops/`: `LaunchButton`, `LaunchSheet` (prévia, confirmar, resultado) e `DevOpsSection` da aba Dados. Usam `useRangeData` e marcam os intervalos com uma função nova do repositório, `markDeclared(ids)`, que grava `declared: true` e `updatedAt` numa transação (e entra na `outbox`, como toda gravação).
- A ordem é sempre: atualizar a task no Azure DevOps e, só se der certo, marcar os intervalos. Se o app fechar entre os dois passos, os intervalos continuam não declarados e um novo lançamento somaria de novo; o comentário do R17 permite conferir. É um risco pequeno para um app pessoal, aceito no ADR 0005.

## Perguntas em aberto

- P1. Como as horas são lançadas hoje: só somando no **Completed Work** da task (o que esta spec assume), ou por uma extensão de timesheet com data por dia?
- P2. Arredondar **por dia de cada task** (o que esta spec propõe) ou **cada intervalo** separado, como as linhas de 15 min da planilha?

## Tarefas

- [ ] T1. `lib/devopsLaunch.ts` com testes (CA1–CA5, CA9).
- [ ] T2. `launchRoundingMinutes` nas configurações, validação, backup, sincronização e regras do Firestore, com testes (CA10).
- [ ] T3. `src/devops/` (cliente e conexão local) com testes usando `fetch` falso (CA5–CA8).
- [ ] T4. `markDeclared(ids)` no repositório, com teste.
- [ ] T5. Seção Azure DevOps na aba Dados (R1–R5, R23).
- [ ] T6. Botão e folha de prévia em Semana e Período (R13–R21).
- [ ] T7. Conferência headless em 390 px, claro e escuro (CA11), com uma organização de teste.
- [ ] T8. Atualizar PRODUCT.md, ARCHITECTURE.md, AGENTS.md e o índice de specs.
