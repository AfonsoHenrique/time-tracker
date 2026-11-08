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
| `src/features/` | Telas e hooks por funcionalidade (hoje, semana, período, dados) | `lib/`, `db/`, `components/` |
| `src/components/` | Componentes visuais reutilizáveis, sem regra de negócio | — |

A regra que mais importa: **a UI nunca importa Dexie diretamente**. Na fase 2, o repositório passa a falar com o Firestore e as telas não mudam.

Como as telas leem os dados:

- As telas usam `useWeekData(dia)`, que lê pelo repositório e expõe `run(ação)`, que executa a escrita e recarrega. Não há cache global nem `dexie-react-hooks`.
- Hoje e Semana carregam a **semana inteira** do dia mostrado (a tela Hoje precisa da falta na semana). Trocar de dia dentro da mesma semana não lê o banco de novo.
- Os hooks recarregam quando o app volta ao primeiro plano (`visibilitychange`), porque outra aba pode ter mudado os dados.
- O relógio (`useNow`) atualiza a cada segundo. O dia de "hoje" sai dele, então a tela vira de dia sozinha à meia-noite.

Navegação:

- A tela e o dia ficam no hash da URL: `#/hoje`, `#/hoje/2026-11-10`, `#/semana`, `#/semana/2026-11-02`. Sem data, a tela segue hoje ou a semana atual. `src/lib/route.ts` lê e escreve o hash, e `useRoute` escuta `hashchange`. Não há biblioteca de roteamento.
- Hash, e não caminho, porque o GitHub Pages não reescreve caminhos para o `index.html`, e o service worker já serve a página do app.
- Abrir um dia a partir da Semana cria uma entrada no histórico, então o botão voltar do Android retorna à mesma semana. As setas e os botões "Voltar para hoje" e "Esta semana" substituem a entrada atual, para o voltar não passar dia por dia.

## Modelo de dados

```ts
interface Interval {
  id: string          // uuid
  start: string       // ISO 8601 em UTC, no minuto exato (ex.: 2026-11-09T11:00:00.000Z)
  end: string | null  // null = em andamento
  note: string
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

Regras de gravação (`src/db/repository.ts`):

- Só pode existir um intervalo em andamento. Abrir outro, ou reabrir um fechado, falha com `RepositoryError` de código `open-interval-exists`.
- O fim não pode ser antes do início (`invalid-interval`).
- Intervalos fechados podem se sobrepor: o destaque de dia irregular avisa, e o usuário corrige.
- O intervalo aberto é achado por filtro, porque o IndexedDB não indexa `null`.

## Ambientes

O build lê `VITE_APP_ENV` (`prod` padrão, ou `hml`) em `vite.config.ts`, e isso define base, nome, cor e manifest. Em tempo de execução, `src/lib/env.ts` expõe `APP_ENV`, `IS_HML` e `DB_NAME`.

Os dois ambientes ficam na **mesma origem** (`afonsohenrique.github.io`):

- O IndexedDB é separado por origem, por isso cada ambiente usa um `DB_NAME` diferente.
- O service worker de produção tem escopo `/time-tracker/`, que contém `/hml/`. Por isso a produção usa `navigateFallbackDenylist` para `/time-tracker/hml/`.

## Deploy

`deploy.yml` roda em push na `main` ou na `develop`, faz o checkout das duas, gera os dois builds, junta tudo (`hml/` dentro do site de produção) e publica no Pages. O ambiente `github-pages` precisa permitir deploy das branches `main` e `develop`.

## Persistência

- `navigator.storage.persist()` ao iniciar, para o navegador não despejar os dados.
- Backup manual em JSON (exportar/importar) como rede de segurança até a fase 2.
