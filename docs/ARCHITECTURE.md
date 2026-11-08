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

## Modelo de dados

```ts
interface Interval {
  id: string          // uuid
  start: string       // ISO 8601 com fuso
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
