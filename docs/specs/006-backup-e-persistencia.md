# 006. Backup e persistência

- **Status**: Rascunho
- **Marco**: 6
- **Relacionado**: [PRODUCT.md](../PRODUCT.md), [ADR 0001](../adr/0001-dados-locais-indexeddb.md), [005-azure-devops-no-intervalo](005-azure-devops-no-intervalo.md) (PR #12)

## Contexto

Na fase 1, os dados vivem só no navegador de cada aparelho. Se o Chrome limpar os dados do site, ou se o celular for trocado, tudo se perde. Esta spec dá uma saída manual: um backup em JSON que pode ser restaurado em qualquer aparelho ou ambiente. Ela também mostra se o navegador prometeu não apagar os dados. É o último marco da fase 1.

## Requisitos

- R1. Uma quarta aba, **Dados**, com três blocos: Backup, Restaurar e Armazenamento.
- R2. **Baixar backup** gera `ponto-backup-AAAA-MM-DD.json` com todos os intervalos (inclusive work item, task e declarado, da spec 005), dias sem meta e configurações. O arquivo também traz a versão do formato, a data e o ambiente (produção ou homologação).
- R3. **Restaurar** abre um arquivo `.json`, valida o conteúdo e mostra um resumo: quantos intervalos, de quando a quando, quantos dias sem meta e de qual ambiente veio. A tela pede confirmação antes de **substituir todos os dados** do aparelho.
- R4. Um arquivo inválido ou de versão desconhecida não muda nada e mostra o motivo, por exemplo "Não é um backup do Ponto" ou "Intervalo 12 com fim antes do início".
- R5. A restauração é tudo ou nada: se algo falhar no meio, os dados anteriores continuam lá.
- R6. A tela mostra a data do **último backup** baixado neste aparelho. Se o último backup tiver mais de 14 dias, ou se nunca houve backup e já existem dados, a tela Hoje mostra um aviso discreto com um link para a aba Dados.
- R7. O bloco Armazenamento mostra se o armazenamento é persistente (`navigator.storage.persisted()`) e o espaço usado. Quando não for persistente, um botão pede de novo.
- R8. Um backup sem os campos do Azure DevOps (feito antes da spec 005) é aceito: os intervalos ficam sem work item, sem task e não declarados.

## Critérios de aceite

- [ ] CA1. Dados 3 intervalos, 1 dia sem meta e as configurações padrão, quando baixo o backup e restauro o arquivo num banco vazio, então os dados ficam iguais aos de antes, com os mesmos ids.
- [ ] CA2. Restaurar um JSON qualquer (ex.: `{"a":1}`) mostra "Não é um backup do Ponto" e não muda nada.
- [ ] CA3. Restaurar um backup com um intervalo de fim antes do início mostra o erro com o número do intervalo e não muda nada.
- [ ] CA4. Restaurar um backup de homologação na produção funciona, e o resumo avisa "Backup da homologação".
- [ ] CA5. Antes de restaurar, a tela mostra o resumo e só substitui depois de "Substituir meus dados". Cancelar não muda nada.
- [ ] CA6. Depois de baixar um backup, a aba Dados mostra "Último backup: hoje". Com o último backup há 15 dias, a tela Hoje mostra o aviso. Com o último backup há 3 dias, o aviso não aparece.
- [ ] CA7. As quatro abas cabem em 390 px, nos temas claro e escuro.
- [ ] CA8. Um backup cujos intervalos não têm `workItemId`, `taskId` e `declared` é restaurado com `null`, `null` e `false`. Um `taskId` que não é inteiro positivo dá erro com o número do intervalo.

## Fora do escopo

- Backup automático ou na nuvem (fase 2, com a sincronização).
- Juntar o backup com os dados existentes: a restauração sempre substitui tudo.
- Editar as configurações (meta diária, dias úteis, início do período) pela tela.

## Desenho

- `src/lib/backup.ts` (puro, com teste):
  - `buildBackup(data, now, env)` monta o objeto `{ app: 'ponto', version: 1, exportedAt, env, intervals, daysOff, settings }`.
  - `parseBackup(text)` devolve `{ ok: true, data, summary }` ou `{ ok: false, error }`. Ele valida a estrutura, os instantes ISO, a ordem de início e fim, se há no máximo um intervalo aberto, os dias `AAAA-MM-DD`, as configurações e os ids do Azure DevOps (`isDevOpsId`). Campos do Azure DevOps ausentes são completados com `withDevOpsDefaults`, de `src/lib/devops.ts`.
  - `isBackupDue(lastBackupAt, hasData, now)` decide o aviso.
- O repositório ganha `exportAll()` e `replaceAll(data)`. O `replaceAll` limpa e regrava as três tabelas numa única transação Dexie, para cumprir R5.
- A data do último backup fica no `localStorage`, com uma chave por ambiente (`ponto:lastBackupAt` e `ponto-hml:lastBackupAt`). Ela é só uma informação deste aparelho e não faz parte dos dados. Por isso não muda o schema do Dexie.
- O backup não muda o schema e não precisa de migração. A versão do formato do backup (`version: 1`) é independente da versão do schema do Dexie.
- Depende do PR #12 (spec 005), que acrescenta os campos do Azure DevOps e o `withDevOpsDefaults`. A implementação começa depois que ele entrar na `develop`.
- Rota `#/dados` e aba **Dados** na `TabBar`.
- O download usa o mesmo caminho do CSV (`Blob` e um link temporário). Para restaurar, um `<input type="file" accept="application/json">` lê o arquivo com `file.text()`.

## Tarefas

- [ ] T1. `lib/backup.ts` + testes (CA1–CA4, CA6, CA8).
- [ ] T2. `exportAll` e `replaceAll` no repositório + testes com `fake-indexeddb` (CA1, R5).
- [ ] T3. Rota e aba Dados, tela com backup, restauração e armazenamento (CA5).
- [ ] T4. Aviso de backup na tela Hoje (CA6).
- [ ] T5. Conferência headless: baixar, restaurar, arquivo inválido, quatro abas (CA7).
- [ ] T6. Atualizar PRODUCT.md, ARCHITECTURE.md, AGENTS.md e o índice de specs.
