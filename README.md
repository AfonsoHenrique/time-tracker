# Ponto (time-tracker)

PWA pessoal para registrar entradas e saídas do trabalho, acompanhar a meta de 40h semanais e exportar os intervalos no formato da planilha de horas.

Os dados ficam só no aparelho (IndexedDB). Não há servidor nem login nesta fase.

## Rodar localmente

```bash
npm install
npm run dev
```

## Comandos

| Comando | O que faz |
|---|---|
| `npm run dev` | Servidor de desenvolvimento |
| `npm test` | Testes (Vitest) |
| `npm run lint` | Lint (oxlint) |
| `npm run build` | Build de produção em `dist/` |
| `npm run preview` | Serve o build localmente |

## Ambientes

| Ambiente | Branch | Endereço |
|---|---|---|
| Produção | `main` | https://afonsohenrique.github.io/time-tracker/ |
| Homologação | `develop` | https://afonsohenrique.github.io/time-tracker/hml/ |

Fluxo: as mudanças entram na `develop` por PR, são testadas em homologação e depois vão para a `main` com um PR `develop → main`.

Um push em `main` ou `develop` reconstrói e publica os dois ambientes juntos (`.github/workflows/deploy.yml`), porque o GitHub Pages guarda um único site por repositório.

A homologação tem nome, cor e banco de dados próprios (`ponto-hml`), então os testes não misturam dados com a produção. Para rodar o build de homologação localmente: `VITE_APP_ENV=hml npm run build`.

Para instalar: abra o endereço no Chrome (Mac ou Android) e use "Instalar app" / "Adicionar à tela inicial".

## Documentação

- [AGENTS.md](AGENTS.md): guia para agentes de IA (Claude Code e outros)
- [CONTRIBUTING.md](CONTRIBUTING.md): fluxo de branches, commits e PRs
- [docs/PRODUCT.md](docs/PRODUCT.md): regras de negócio
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): camadas, modelo de dados e deploy
- [docs/adr/](docs/adr/): decisões de arquitetura
- [docs/specs/](docs/specs/): specs das funcionalidades

## Stack

Vite, React, TypeScript, vite-plugin-pwa, Dexie (IndexedDB) e date-fns.
