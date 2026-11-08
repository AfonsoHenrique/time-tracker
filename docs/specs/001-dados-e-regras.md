# 001. Dados e regras de cálculo

- **Status**: Concluída
- **Marco**: 2
- **Relacionado**: [PRODUCT.md](../PRODUCT.md), [ARCHITECTURE.md](../ARCHITECTURE.md), [ADR 0001](../adr/0001-dados-locais-indexeddb.md)

## Contexto

Antes das telas, o app precisa guardar intervalos e calcular saldos sem errar. Esta spec cobre o banco local, o repositório e as funções puras de cálculo. Nenhuma tela entra aqui.

## Requisitos

- R1. Guardar intervalos (`Interval`), dias sem meta (`DayOff`) e configurações (`Settings`) no IndexedDB, num banco chamado `DB_NAME`.
- R2. Repositório em `src/db/` com: criar, editar e apagar intervalo; buscar intervalos por faixa de datas; buscar o intervalo aberto; marcar e desmarcar dia sem meta; ler e salvar configurações.
- R3. Só pode existir um intervalo aberto (`end === null`) por vez. "Entrar" com um aberto deve falhar.
- R4. Funções puras em `src/lib/` para: trabalhado no dia, meta do dia, falta no dia, meta da semana, trabalhado e falta na semana, limites da semana (seg–dom), limites do período 26–25 e irregularidades do dia.
- R5. Um intervalo aberto conta até um `now` recebido por parâmetro (as funções não leem o relógio).

## Critérios de aceite

- [x] CA1. Dado um dia útil com 08:00–12:00 e 13:00–17:30, então trabalhado = 8:30 e falta no dia = 0 (excedente +0:30).
- [x] CA2. Dado sábado com 09:30–10:45, então meta do dia = 0 e trabalhado = 1:15.
- [x] CA3. Dada uma semana com segunda marcada como sem meta, então meta da semana = 32h.
- [x] CA4. Dada uma semana com 9h na segunda, 8h de terça a quinta e 0h na sexta (em andamento), então falta na semana = 7h.
- [x] CA5. Dado um intervalo aberto desde 14:00 e `now` = 15:20, então ele conta 1:20.
- [x] CA6. Dado 2026-11-08, então o período mensal vai de 2026-10-26 a 2026-11-25. Dado 2026-11-26, então vai de 2026-11-26 a 2026-12-25.
- [x] CA7. Dado 2026-11-08 (domingo), então a semana vai de 2026-11-02 (segunda) a 2026-11-08.
- [x] CA8. Irregularidades: intervalo aberto em dia anterior; intervalo > 12h; intervalo que passa da meia-noite; intervalos sobrepostos; dia útil com meta, já passado e com 0h. Dia útil com 4h **não** é irregular.
- [x] CA9. Tentar abrir um segundo intervalo com um já aberto gera erro e não grava nada.
- [x] CA10. Os testes do repositório rodam com `fake-indexeddb`, sem navegador.

## Fora do escopo

- Telas e componentes (spec 002+).
- Exportação CSV e backup (specs 004 e 005).
- Sincronização (fase 2).

## Desenho

- `src/db/schema.ts`: classe Dexie `PontoDb` com tabelas `intervals` (índices `id`, `start`, `end`), `daysOff` (`date`) e `settings` (registro único).
- `src/db/repository.ts`: funções assíncronas expostas para a UI. É o único lugar que importa Dexie.
- `src/lib/time.ts`: semana, período e chave de dia local (`AAAA-MM-DD`).
- `src/lib/balance.ts`: metas, trabalhado e falta.
- `src/lib/irregular.ts`: lista de problemas de um dia (`IrregularityKind[]`).
- Durações sempre em minutos inteiros.
- Instantes guardados em UTC (`2026-11-09T11:00:00.000Z`), cortando os segundos. O dia local sai do instante na leitura.
- `src/db/repository.ts` expõe `createRepository(db)` (usado nos testes com um IndexedDB falso) e `getRepository()` (o do app, criado no primeiro uso).
- Erros do repositório são `RepositoryError` com um `code`: `open-interval-exists`, `no-open-interval`, `not-found`, `invalid-interval`, `invalid-day`, `invalid-settings`.

## Tarefas

- [x] T1. Tipos `Interval`, `DayOff`, `Settings` e valores padrão.
- [x] T2. `lib/time.ts` + testes (CA6, CA7).
- [x] T3. `lib/balance.ts` + testes (CA1–CA5).
- [x] T4. `lib/irregular.ts` + testes (CA8).
- [x] T5. Schema Dexie e repositório + testes com `fake-indexeddb` (CA9, CA10).
- [x] T6. Atualizar `ARCHITECTURE.md` se algo divergir.
