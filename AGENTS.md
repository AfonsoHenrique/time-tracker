# AGENTS.md

Guia para agentes de IA (Claude Code e outros) que trabalham neste repositório. Leia antes de mudar qualquer coisa.

## O projeto

**Ponto** é um PWA pessoal para bater ponto: registra entradas e saídas, mostra quanto falta para a meta do dia e da semana, e exporta os intervalos no formato da planilha de horas do usuário.

- Produto e regras de negócio: [`docs/PRODUCT.md`](docs/PRODUCT.md)
- Arquitetura: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
- Decisões registradas: [`docs/adr/`](docs/adr/)
- Specs das funcionalidades: [`docs/specs/`](docs/specs/)
- Fluxo de contribuição: [`CONTRIBUTING.md`](CONTRIBUTING.md)

## Comandos

```bash
npm install          # dependências
npm run dev          # servidor local (produção)
npm test             # testes (Vitest)
npm run lint         # oxlint
npm run build        # tsc + build de produção em dist/
VITE_APP_ENV=hml npm run build   # build de homologação
```

Antes de abrir um PR, rode `npm run lint && npm test && npm run build`. O CI roda os mesmos passos.

## Estrutura

```
src/
  main.tsx          # entrada; pede armazenamento persistente
  App.tsx           # raiz da UI
  lib/              # lógica pura, sem React (cálculos, formatação, ambiente)
    *.test.ts       # testes ao lado do código
  (próximos marcos) db/, features/, components/
docs/               # produto, arquitetura, ADRs e specs
.github/workflows/  # ci.yml (PRs) e deploy.yml (Pages)
```

## Como trabalhar

1. **Comece pela spec.** Toda funcionalidade nova tem (ou ganha) um arquivo em `docs/specs/`. Leia a spec e os critérios de aceite antes de codar. Se a tarefa não tem spec e não é trivial, escreva a spec primeiro e peça confirmação.
2. **Regras de cálculo são lógica pura em `src/lib/` e sempre têm teste.** Saldo do dia, da semana, período 26–25 e dias irregulares não podem depender de React nem do banco.
3. **Acesso a dados só pela camada de repositório** (`src/db/`, a partir do marco 2). As telas não importam Dexie diretamente, porque a fase 2 troca IndexedDB por Firestore.
4. **Mudou uma decisão de arquitetura?** Registre um ADR novo em `docs/adr/` em vez de editar um ADR aceito.
5. **Mantenha a documentação viva.** Se o código muda algo descrito em `docs/` ou neste arquivo, atualize no mesmo PR.

## Convenções

- **Idioma**: textos da interface, comentários, docs, commits e PRs em português do Brasil. Identificadores de código (variáveis, funções, tipos, campos do banco) em inglês.
- **TypeScript estrito**, sem `any`. Prefira funções puras e tipos explícitos nas fronteiras.
- **Datas**: use `date-fns`. Semana começa na segunda. Guarde instantes como ISO 8601 com fuso; dia de calendário como `AAAA-MM-DD` no fuso local.
- **Durações** em minutos inteiros na lógica; formatação só na borda (`formatDuration`).
- **Sem arredondamento automático** de horários: o usuário arredonda à mão.
- **Estilo**: CSS simples com variáveis em `:root`; suporte a tema escuro; layout pensado primeiro para celular.
- **Dependências**: só adicione uma nova se ela economizar trabalho real. Justifique no PR.

## Ambientes

| Ambiente | Branch | URL | Banco IndexedDB |
|---|---|---|---|
| Produção | `main` | `/time-tracker/` | `ponto` |
| Homologação | `develop` | `/time-tracker/hml/` | `ponto-hml` |

Use `DB_NAME` e `IS_HML` de `src/lib/env.ts`; nunca escreva o nome do banco à mão.

## Não faça

- Commitar direto em `main` ou `develop`. Sempre branch + PR para `develop`.
- Desabilitar, pular ou apagar teste para o CI passar.
- Mudar a estrutura dos dados salvos sem migração do Dexie (versão nova do schema).
- Adicionar backend, login ou serviço externo na fase 1 (ver [ADR 0001](docs/adr/0001-dados-locais-indexeddb.md)).
