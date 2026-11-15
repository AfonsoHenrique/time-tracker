# Arquitetura

## Visão geral

PWA estático, sem servidor. Tudo roda no navegador e os dados ficam no IndexedDB do aparelho.

```
┌──────────────── navegador (Chrome no Mac ou Android) ─────────────────┐
│                                                                       │
│  UI (React)  ──▶  features/*  ──▶  lib/ (regras puras)                │
│      │                                                                │
│      └──────▶  db/ (repositório)  ──▶  Dexie  ──▶  IndexedDB          │
│                                                                       │
│  Service worker (Workbox): cache do app para uso offline              │
└───────────────────────────────────────────────────────────────────────┘
          ▲
          │ HTTPS (arquivos estáticos)
   GitHub Pages ── /time-tracker/ (main) e /time-tracker/hml/ (develop)
```

## Camadas

| Pasta | Responsabilidade | Pode importar |
|---|---|---|
| `src/lib/` | Regras puras: durações, metas, saldos, semanas, período 26–25, irregularidades, formatação do CSV | só `date-fns` |
| `src/db/` | Schema Dexie, migrações e funções de repositório (`listIntervals(from, to)`, `saveInterval`…) | `lib/`, `dexie` |
| `src/sync/` | Sincronização com a nuvem (spec 008): motor, gatilhos e o Firestore | `lib/`, `db/`, `firebase` |
| `src/features/` | Telas e hooks por funcionalidade (hoje, semana, período, dados) | `lib/`, `db/`, `sync/`, `components/` |
| `src/components/` | Componentes visuais reutilizáveis, sem regra de negócio | — |

A regra que mais importa: **a UI nunca importa Dexie diretamente**. Na fase 2, o repositório passa a falar com o Firestore e as telas não mudam.

Como as telas leem os dados:

- As telas usam `useRangeData('week' | 'period', dia)`, que lê pelo repositório a semana ou o período que contém o dia e expõe `run(ação)`, que executa a escrita e recarrega. Não há cache global nem `dexie-react-hooks`. O período (até 31 dias) vem numa leitura só.
- Hoje e Semana carregam a **semana inteira** do dia mostrado (a tela Hoje precisa da falta na semana). Ao trocar de dia dentro da mesma semana, a tela continua com os dados que já tem enquanto a nova leitura chega, sem piscar.
- Os hooks recarregam quando o app volta ao primeiro plano (`visibilitychange`), porque outra aba pode ter mudado os dados.
- Os hooks também recarregam com o evento `ponto:synced` (`SYNCED_EVENT`), que a sincronização dispara quando traz mudanças de outro aparelho.
- O relógio (`useNow`) atualiza a cada segundo. O dia de "hoje" sai dele, então a tela vira de dia sozinha à meia-noite.

Navegação:

- A tela e o dia ficam no hash da URL: `#/hoje`, `#/hoje/2026-11-10`, `#/semana`, `#/semana/2026-11-02`, `#/periodo`, `#/periodo/2026-11-10` e `#/dados` (sem data). Sem data, a tela segue hoje ou a semana atual. `src/lib/route.ts` lê e escreve o hash, e `useRoute` escuta `hashchange`. Não há biblioteca de roteamento.
- Abrir uma semana a partir do Período também cria entrada no histórico.
- Hash, e não caminho, porque o GitHub Pages não reescreve caminhos para o `index.html`, e o service worker já serve a página do app.
- Abrir um dia a partir da Semana cria uma entrada no histórico, então o botão voltar do Android retorna à mesma semana. As setas e os botões "Voltar para hoje" e "Esta semana" substituem a entrada atual, para o voltar não passar dia por dia.

## Modelo de dados

```ts
interface Interval {
  id: string          // uuid
  start: string       // ISO 8601 em UTC, no minuto exato (ex.: 2026-11-09T11:00:00.000Z)
  end: string | null  // null = em andamento
  note: string
  workItemId: number | null  // work item do Azure DevOps (ex.: 123567)
  taskId: number | null      // task filha onde as horas são declaradas (ex.: 123568)
  declared: boolean          // horas já lançadas no Azure DevOps
  project: string            // projeto, até 15 caracteres ('' = sem projeto)
  createdAt: string
  updatedAt: string
}

interface DayOff {
  date: string        // AAAA-MM-DD (fuso local)
  note: string
}

interface Settings {
  dailyTargetMinutes: number   // 480
  workDays: number[]           // 1..5 (seg..sex)
  periodStartDay: number       // 26
}
```

O dia de um intervalo é o dia local do seu `start`.

Os instantes são guardados em UTC, sempre no mesmo formato, para que a ordem do texto seja a ordem do tempo. Assim o índice `start` do IndexedDB responde às buscas por faixa de dias, e o dia local é calculado na leitura, no fuso do aparelho. O repositório corta os segundos ao gravar: o app guarda o minuto exato e não arredonda nada.

Versões do schema (`src/db/schema.ts`):

- **1**: tabelas `intervals`, `daysOff` e `settings`.
- **2** (spec 005): campos do Azure DevOps no intervalo. Mesmos índices; o `upgrade` aplica `withDevOpsDefaults` de `src/lib/devops.ts`, que também serve para importar backups antigos.
- **3** (spec 007): projeto no intervalo. Mesmos índices e o mesmo `upgrade`.
- **4** (spec 008): sincronização. Tabelas `outbox` (mudanças que ainda não subiram), `tombstones` (marcas de apagado) e `syncState` (conta, cursor de leitura, último ciclo e erro). Dias sem meta e configurações ganham `updatedAt` no banco (`DayOffRow`, `SettingsRow`); os tipos de `lib/types.ts` e o backup não mudam.

Regras de gravação (`src/db/repository.ts`):

- Toda gravação e todo apagar entram na `outbox` na mesma transação; apagar também grava uma marca em `tombstones`. `onLocalChange` avisa as gravações do aparelho.
- Só pode existir um intervalo em andamento. Abrir outro, ou reabrir um fechado, falha com `RepositoryError` de código `open-interval-exists`.
- O fim não pode ser antes do início (`invalid-interval`).
- Work item e task são inteiros positivos ou `null`, e o projeto tem no máximo 15 caracteres (`invalid-interval`). Num patch, `undefined` mantém o valor e `null` limpa.
- Intervalos fechados podem se sobrepor: o destaque de dia irregular avisa, e o usuário corrige.
- O intervalo aberto é achado por filtro, porque o IndexedDB não indexa `null`. Depois de sincronizar pode haver dois abertos (entrada nos dois aparelhos sem rede): vale o mais recente, e o dia aparece como irregular pela sobreposição.
- `exportAll()` lê as três tabelas para o backup. `replaceAll(data)` limpa e regrava as três numa única transação: se algo falhar no meio, os dados anteriores continuam lá.

## Sincronização (spec 008, ADR 0004)

O Dexie continua sendo a fonte da verdade no aparelho. A nuvem é atualizada em segundo plano.

- `src/lib/sync.ts` (puro): chaves dos registros (`intervals/{id}`, `daysOff/{dia}`, `settings/settings`), regra de conflito (`isNewer`: vence o `updatedAt` mais recente, ou a data do apagar) e o plano do primeiro login (`planFirstSync`).
- `repository.sync` (`src/db/repository.ts`): `pending`, `markPushed`, `applyRemote` (valida como o backup, não entra na fila nem avisa `onLocalChange`), `enqueueAll`, `clearForDownload` e o estado.
- `src/sync/engine.ts`: um ciclo envia a fila e depois recebe o que mudou desde o cursor. Os ciclos ficam em fila na aba e usam `navigator.locks` entre abas. `link(uid, 'upload' | 'merge' | 'cloud-only')` liga o aparelho a uma conta; `unlink()` para a sincronização e mantém os dados.
- `src/sync/autoSync.ts`: gatilhos (ao começar, ao voltar para o primeiro plano, quando a rede volta, 3 s depois de gravar e a cada minuto com o app visível).
- `src/sync/firestoreRemote.ts`: Firestore lite em `users/{uid}/envs/{prod|hml}/{intervals|daysOff|meta}/{id}`. Cada documento é `{ data, updatedAt, deletedAt, syncedAt }`; `syncedAt` é a hora do servidor e serve de cursor (relido com 2 minutos de folga). Só grava um documento mais novo que o da nuvem, numa transação.
- `src/sync/memoryRemote.ts`: a mesma nuvem em memória, para os testes.
- Restaurar um backup com a sincronização ligada dá `updatedAt` de agora a tudo e marca o que sumiu, para o backup vencer também na nuvem.

Regras do Firestore em `firebase/firestore.rules`: cada usuário só lê e grava em `users/{seu uid}/…`, os documentos são validados como no repositório, uma versão mais antiga não substitui a mais nova e apagar de verdade é proibido. `npm run test:rules` roda os testes das regras e a sincronização de ponta a ponta nos emuladores do Firebase (precisa de Java 21); o CI roda o mesmo num job separado. O deploy das regras é manual (`npx firebase-tools deploy --only firestore:rules`).

## Ambientes

O build lê `VITE_APP_ENV` (`prod` padrão, ou `hml`) em `vite.config.ts`, e isso define base, nome, cor e manifest. Em tempo de execução, `src/lib/env.ts` expõe `APP_ENV`, `IS_HML` e `DB_NAME`.

Os dois ambientes ficam na **mesma origem** (`afonsohenrique.github.io`):

- O IndexedDB é separado por origem, por isso cada ambiente usa um `DB_NAME` diferente.
- O service worker de produção tem escopo `/time-tracker/`, que contém `/hml/`. Por isso a produção usa `navigateFallbackDenylist` para `/time-tracker/hml/`.

## Deploy

`deploy.yml` roda em push na `main` ou na `develop`, faz o checkout das duas, gera os dois builds, junta tudo (`hml/` dentro do site de produção) e publica no Pages. O ambiente `github-pages` precisa permitir deploy das branches `main` e `develop`.

## Persistência

- `navigator.storage.persist()` ao iniciar, para o navegador não despejar os dados. A aba Dados mostra o resultado (`persisted()`), o espaço usado (`estimate()`) e pede de novo se precisar.
- Backup manual em JSON como rede de segurança até a fase 2 (spec 006):
  - `src/lib/backup.ts` monta o arquivo (`{ app: 'ponto', version: 1, exportedAt, env, intervals, daysOff, settings }`) e valida o que vai ser restaurado (`parseBackup`), sem gravar nada. Intervalos sem os campos do Azure DevOps ganham os padrões de `withDevOpsDefaults`.
  - A versão do formato do backup é independente da versão do schema do Dexie.
  - A data do último backup baixado fica no `localStorage` (`ponto:lastBackupAt` ou `ponto-hml:lastBackupAt`), por `src/features/shared/lastBackup.ts`. É só uma informação do aparelho, fora do banco.
  - Restaurar sempre substitui tudo; não há mesclagem.

## Exportação

`src/lib/export.ts` gera as linhas da aba SEMANA (uma por intervalo fechado, do mais recente para o mais antigo) e os dois formatos:

- **TSV** para a área de transferência, sem cabeçalho, com tabulação e quebra de linha da observação trocadas por espaço.
- **CSV** para download, com cabeçalho, `;`, `\r\n` e BOM UTF-8, que é como o Excel em português abre um CSV sem perguntar nada.

`ExportPanel` (`src/features/shared/`) faz a cópia (`navigator.clipboard`) e o download (`Blob`), e é usado nas telas Semana e Período.
