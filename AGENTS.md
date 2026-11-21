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
npm run typecheck    # tsc sem emitir arquivos
npm run check        # lint + typecheck + testes
npm run test:rules   # regras do Firestore e sync de ponta a ponta nos emuladores (precisa de Java 21)
npm run build        # tsc + build de produção em dist/
VITE_APP_ENV=hml npm run build   # build de homologação
```

Antes de abrir um PR, rode `npm run check && npm run build`. O CI roda os mesmos passos.

## Estrutura

```
src/
  main.tsx          # entrada; pede armazenamento persistente
  App.tsx           # raiz da UI
  lib/              # lógica pura, sem React nem banco
    types.ts        # Interval, DayOff, Settings, DEFAULT_SETTINGS
    time.ts         # dia local, semana, período 26–25, dias úteis
    balance.ts      # trabalhado, meta, falta e excedente (dia, semana e qualquer faixa)
    irregular.ts    # dias irregulares e o texto de cada motivo
    duration.ts     # H:MM (formatDuration) e horas decimais do Azure DevOps (formatDecimalHours)
    clock.ts        # cronômetro, títulos de dia e semana, horas HH:MM, formulário de intervalo e texto da previsão
    forecast.ts     # previsão do horário de saída do dia (com reserva de almoço)
    route.ts        # rota no hash da URL (#/hoje/…, #/semana/…, #/periodo/…, #/dados)
    export.ts       # linhas da planilha HORAS.xlsx, TSV e CSV
    devops.ts       # ids de work item/task, projeto, observação e padrões para dados antigos
    devopsLaunch.ts # lançamento no Azure DevOps: plano por task, arredondamento, detalhes e JSON Patch
    settings.ts     # validação das configurações (repositório e backup)
    backup.ts       # arquivo de backup: montar, validar, resumo e data do último backup
    demo.ts         # dados fictícios do modo demo da homologação
    env.ts          # ambiente (IS_HML, IS_DEMO) e nome do banco
    sync.ts         # chaves, conflito (última gravação vence) e plano do primeiro login
    account.ts      # provedores de login, textos de erro e do estado da sincronização
    firebaseConfig.ts # configuração web (pública) do projeto Firebase
    theme.ts        # escolha de tema (Sistema, Claro, Escuro) e chave do localStorage
    test-helpers.ts # at() e iv() para montar instantes e intervalos nos testes
    *.test.ts       # testes ao lado do código
  db/
    schema.ts       # Dexie (PontoDb): tabelas, índices e migrações (versão 4)
    repository.ts   # única porta de entrada para os dados (getRepository), com fila da sincronização
    demo.ts         # liga, recria e desliga o modo demo (banco separado)
  devops/           # Azure DevOps (spec 013): client (REST), connection (token no localStorage), launch (prévia e lançamento)
  sync/             # engine, autoSync (gatilhos), firestoreRemote, memoryRemote, firebase (login, carregado sob demanda), session (estado da conta)
  features/
    devops/         # DevOpsSection (aba Dados) e LaunchPanel (Semana e Período)
    shared/         # useRangeData (semana ou período), useNow, useRoute, useAccount, ExportPanel, errors, lastBackup, theme
    today/          # tela Hoje: TodayScreen, IntervalSheet
    week/           # tela Semana: WeekScreen
    period/         # tela Período: PeriodScreen
    data/           # aba Dados: DataScreen (conta, aparência, backup, restaurar, armazenamento), AccountSection e DemoSection (só hml)
  components/       # TabBar, Stat/BalanceStat, DatePickerTitle: visuais, sem regra de negócio
firebase/           # firestore.rules e testes nos emuladores
docs/               # produto, arquitetura, ADRs e specs
.github/workflows/  # ci.yml (PRs) e deploy.yml (Pages)
```

## Como trabalhar

1. **Comece pela spec.** Toda funcionalidade nova tem (ou ganha) um arquivo em `docs/specs/`. Leia a spec e os critérios de aceite antes de codar. Se a tarefa não tem spec e não é trivial, escreva a spec primeiro e peça confirmação.
2. **Regras de cálculo são lógica pura em `src/lib/` e sempre têm teste.** Saldo do dia, da semana, período 26–25 e dias irregulares não podem depender de React nem do banco.
3. **Acesso a dados só pela camada de repositório** (`getRepository()` de `src/db/repository.ts`). As telas não importam Dexie diretamente, porque a fase 2 troca IndexedDB por Firestore.
4. **Mudou uma decisão de arquitetura?** Registre um ADR novo em `docs/adr/` em vez de editar um ADR aceito.
5. **Mantenha a documentação viva.** Se o código muda algo descrito em `docs/` ou neste arquivo, atualize no mesmo PR.

## Convenções

- **Idioma**: textos da interface, comentários, docs, commits e PRs em português do Brasil. Identificadores de código (variáveis, funções, tipos, campos do banco) em inglês.
- **TypeScript estrito**, sem `any`. Prefira funções puras e tipos explícitos nas fronteiras.
- **Datas**: use `date-fns` e as funções de `src/lib/time.ts`. Semana começa na segunda. Instantes ficam em ISO 8601 UTC no minuto exato; dia de calendário é `AAAA-MM-DD` no fuso local.
- **Testes de data** usam `at('2026-11-09 08:00')` e `iv(início, fim)` de `src/lib/test-helpers.ts`, com horário local, para passar em qualquer fuso.
- **Durações** em minutos inteiros na lógica; formatação só na borda (`formatDuration`).
- **Sem arredondamento automático** de horários: o usuário arredonda à mão.
- **Estilo**: CSS simples com variáveis em `:root`; suporte a tema escuro; layout pensado primeiro para celular.
- **Dependências**: só adicione uma nova se ela economizar trabalho real. Justifique no PR.

## Ambientes

| Ambiente | Branch | URL | Banco IndexedDB |
|---|---|---|---|
| Produção | `main` | `/time-tracker/` | `ponto` |
| Homologação | `develop` | `/time-tracker/hml/` | `ponto-hml` (modo demo: `ponto-hml-demo`) |

Use `DB_NAME` e `IS_HML` de `src/lib/env.ts`; nunca escreva o nome do banco à mão.

## Não faça

- Commitar direto em `main` ou `develop`. Sempre branch + PR para `develop`.
- Desabilitar, pular ou apagar teste para o CI passar.
- Mudar a estrutura dos dados salvos sem migração do Dexie (versão nova do schema).
- Adicionar backend ou serviço externo além do Firebase da fase 2 (ver [ADR 0004](docs/adr/0004-sincronizacao-dexie-firestore.md)) e da API do Azure DevOps da fase 3 (ver [ADR 0005](docs/adr/0005-azure-devops-com-pat-local.md)).
- Guardar o token do Azure DevOps no banco, no backup ou no Firestore: ele fica só no `localStorage` (`src/devops/connection.ts`).
- Fazer as telas falarem com o Firestore: a sincronização passa pelo repositório e por `src/sync/`.
