# 007. Projeto no intervalo e work item na exportação

- **Status**: Concluída
- **Marco**: 5.2
- **Relacionado**: [005-azure-devops-no-intervalo](005-azure-devops-no-intervalo.md), [004-periodo-e-exportacao](004-periodo-e-exportacao.md), [006-backup-e-persistencia](006-backup-e-persistencia.md)

## Contexto

A spec 005 levou a task para a coluna TASK, mas Projeto continuava vazio e o work item não saía na exportação. Com o projeto no intervalo e o work item numa coluna extra, a planilha sai quase pronta para o lançamento.

## Requisitos

- R1. O intervalo ganha **Projeto** (`project: string`): texto livre, opcional, de **até 15 caracteres**. Espaços nas pontas são removidos. Vazio = sem projeto.
- R2. Na folha do intervalo, o campo Projeto fica no grupo Azure DevOps, antes de Work item e Task, com um contador `N/15`. O campo não deixa digitar além de 15.
- R3. Na lista da tela Hoje, o projeto aparece no começo da linha do Azure DevOps: `Equipe IA · WI 123567 · Task 123568 · ✓ Declarado`.
- R4. Exportação (TSV e CSV): a coluna **Projeto** recebe o projeto, e uma coluna nova, **Work item**, entra na **ponta direita**, depois de Detalhe, com o id do work item. Ficam 10 colunas: `SEMANA | DATA | INICIO | FIM | Soma | Descricao | TASK | Projeto | Detalhe | Work item`.
- R5. Migração: o banco passa para a versão 3 do schema, com os mesmos índices. Os intervalos que já existem ficam com `project: ''` e mantêm os outros campos.
- R6. Backup (spec 006): o export leva o projeto. Num backup antigo, sem o campo, o projeto fica vazio (`withDevOpsDefaults`). Um projeto com mais de 15 caracteres no backup dá erro, como os ids inválidos.

## Critérios de aceite

- [x] CA1. Dado o intervalo 09:00–09:30 "Daily equipe IA" com projeto " Equipe IA ", quando salvo, então ele grava `project: 'Equipe IA'`. Editar outro campo mantém o projeto, e apagar o texto grava `''`.
- [x] CA2. Um projeto com 16 caracteres é recusado pelo formulário ("O projeto deve ter no máximo 15 caracteres.") e pelo repositório (`invalid-interval`).
- [x] CA3. Dado o intervalo do CA1 com work item 123567 e task 123568, então a exportação gera `seg | 09/11/2026 | 09:00 | 09:30 | 0:30 | Daily equipe IA | 123568 | Equipe IA | (vazio) | 123567`, e o cabeçalho do CSV termina em `Detalhe;Work item`.
- [x] CA4. Dado um banco na versão 2 com um intervalo com work item, task e declarado, quando o app abre, então o intervalo continua igual e ganha `project: ''`.
- [x] CA5. A folha com o Projeto cabe em 390 px nos temas claro e escuro.

## Fora do escopo

- Lista de projetos, sugestão do último projeto usado ou autocompletar.
- Validar o projeto contra o Azure DevOps.
- Mudar a ordem das colunas da planilha: Work item fica fora delas, na ponta direita, para colar sem deslocar nada.

## Desenho

- `src/lib/types.ts`: `project` em `Interval`, em `EMPTY_DEVOPS_FIELDS` e `PROJECT_MAX_LENGTH = 15`.
- `src/lib/devops.ts`: `normalizeProject(texto)` tira os espaços e confere o limite. `withDevOpsDefaults` completa `project` com `''` e corta um texto longo demais (só para dados antigos; o backup valida antes).
- `src/lib/clock.ts`: `IntervalForm.project`; `readIntervalForm` devolve o projeto normalizado ou o erro.
- `src/db/schema.ts`: `version(3)` com o mesmo `upgrade` (`withDevOpsDefaults`).
- `src/db/repository.ts`: `project` em `NewInterval` e `IntervalPatch`; `undefined` mantém, texto longo demais falha com `invalid-interval`.
- `src/lib/export.ts`: `EXPORT_HEADER` ganha `Work item`; Projeto = `project`, Work item = `workItemId`.
- O limite conta unidades UTF-16 (`String.length`), igual ao `maxLength` do campo.

## Tarefas

- [x] T1. Tipos, `normalizeProject` e `withDevOpsDefaults` + testes (CA2).
- [x] T2. Formulário, repositório e schema versão 3 + testes (CA1, CA2, CA4).
- [x] T3. Exportação com Projeto e Work item + testes (CA3).
- [x] T4. Folha do intervalo e lista da tela Hoje (CA5).
- [x] T5. Conferência headless em 390 px, claro e escuro (CA5).
- [x] T6. Atualizar PRODUCT.md, ARCHITECTURE.md, AGENTS.md, spec 006 e o índice de specs.
