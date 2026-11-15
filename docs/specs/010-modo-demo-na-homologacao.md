# 010. Modo demo na homologação

- **Status**: Concluída
- **Marco**: 6.1
- **Relacionado**: [ADR 0002](../adr/0002-github-pages-com-homologacao.md), [006-backup-e-persistencia](006-backup-e-persistencia.md), [008-login-e-sincronizacao](008-login-e-sincronizacao.md), [009-previsao-de-saida](009-previsao-de-saida.md)

## Contexto

Para revisar a interface na homologação, hoje é preciso bater pontos à mão até as telas ficarem cheias. Um **modo demo** preenche as telas com dados fictícios realistas, com todos os campos e casos especiais (dia irregular, dia sem meta, intervalo aberto), para ver de uma vez como cada tela fica preenchida. Ele existe só na homologação e nunca toca nos dados de verdade.

## Requisitos

- R1. O modo demo só existe no build de homologação (`IS_HML`). No build de produção não há botão, nem código do gerador, nem leitura da preferência.
- R2. Os dados demo ficam num **banco separado**, `ponto-hml-demo`. Ligar, desligar ou recriar o demo nunca lê, muda ou apaga o banco `ponto-hml`. Por isso não precisa de confirmação.
- R3. Na aba Dados, um bloco **Modo demo** (só na homologação) com:
  - desligado: botão **Ligar modo demo**, que cria os dados fictícios e abre a tela Hoje;
  - ligado: botões **Recriar dados demo** (apaga só o banco demo e gera de novo, relativo ao dia de hoje) e **Sair do modo demo** (volta aos dados da homologação, que estão como antes).
- R4. Com o demo ligado, o selo do topo diz **Homologação · Demo**, para não confundir com os dados reais da homologação.
- R5. A escolha fica no `localStorage` (`ponto-hml:demo`) e vale até ser desligada. Trocar de modo recarrega a página, para o app abrir o outro banco.
- R6. Os dados gerados cobrem **a semana anterior inteira e a semana atual até agora**, relativos ao dia em que o demo é criado. Assim a Semana, o Período e a Hoje ficam cheios em qualquer dia da semana. Eles trazem:
  - de 2 a 4 intervalos por dia útil, com horários variados (não só 08:00–12:00/13:00–17:00), entradas e saídas em minutos quebrados;
  - descrição, projeto, work item e task na maioria dos intervalos, com alguns sem task e alguns sem nada, como na vida real;
  - intervalos declarados e não declarados, os mais antigos tendendo a declarados;
  - um dia útil com mais de 8h e outro com menos, para os saldos mostrarem excedente e falta;
  - **um dia sem meta** na semana anterior, com nota (ex.: "Feriado (demo)");
  - **um dia irregular** na semana anterior: dois intervalos sobrepostos;
  - algumas horas num sábado da semana anterior (fim de semana com horas e meta 0);
  - **hoje**: se for dia útil, intervalos encerrados e um intervalo **aberto** começando 30 min antes de agora, para o cronômetro e a previsão de saída (spec 009) aparecerem. Se agora for muito cedo para isso (antes das 08:30), hoje fica só com o intervalo aberto desde as 08:00 ou vazio antes disso.
- R7. Nenhum intervalo demo fica no futuro, e só existe um intervalo aberto.
- R8. Os dados são determinísticos para um mesmo "agora" (sem `Math.random`), para os testes serem estáveis.
- R9. Dentro do demo, o app funciona como sempre: dá para bater ponto, editar, exportar e baixar backup. O backup do demo sai com `env: 'hml'` e o nome `ponto-backup-demo-AAAA-MM-DD.json`. A restauração continua disponível e substitui só o banco demo.
- R10. Quando a sincronização da spec 008 existir, o modo demo nunca sincroniza.

## Critérios de aceite

- [x] CA1. Dado o build de produção, quando procuro no `dist/` pelo texto "Ligar modo demo" e pelo nome `ponto-hml-demo`, então não encontro nada.
- [x] CA2. Dado a homologação com 2 intervalos reais, quando ligo o demo, recrio os dados e saio do demo, então os 2 intervalos continuam lá, iguais.
- [x] CA3. Dado "agora" = quarta 2026-11-18 15:00, quando gero os dados, então há intervalos de segunda 2026-11-09 até quarta 2026-11-18, nenhum começa ou termina depois das 15:00 de quarta, e só o último está aberto, começando 14:30.
- [x] CA4. Dados gerados com o mesmo "agora" duas vezes são iguais (com os mesmos ids).
- [x] CA5. Nos dados gerados, a semana anterior tem um dia sem meta e exatamente um dia irregular (`isIrregularDay`), por sobreposição. Nenhum outro dia é irregular.
- [x] CA6. Nos dados gerados há intervalos com e sem task, declarados e não declarados, com e sem projeto, e todos passam nas validações do repositório (projeto até 15 caracteres, ids inteiros positivos, fim depois do início).
- [x] CA7. Dado "agora" = segunda 07:00, então a semana atual não tem intervalos e a anterior está completa. Dado "agora" = domingo 20:00, então a semana atual tem todos os dias úteis completos e nenhum intervalo aberto.
- [x] CA8. Com o demo ligado, o selo mostra "Homologação · Demo", e as telas Hoje, Semana, Período e Dados cabem em 390 px, nos temas claro e escuro.

## Fora do escopo

- Modo demo na produção, mesmo escondido.
- Escolher a semana, a quantidade de dados ou os cenários do demo.
- Juntar dados demo com dados reais.

## Desenho

- `src/lib/demo.ts` (puro, com teste): `buildDemoData(now)` devolve um `BackupData` (o mesmo tipo do backup: intervalos, dias sem meta e configurações). Ele monta os dias a partir de um roteiro fixo por dia da semana (horários, textos, projetos, ids), recortado em `now`. Ids no formato `demo-AAAA-MM-DD-N`. Usa `weekRange` de `src/lib/time.ts`.
- `src/lib/env.ts`: ganha `DEMO_DB_NAME = 'ponto-hml-demo'`, e `DB_NAME` passa a ser ele quando `IS_HML` e o `localStorage` tem `ponto-hml:demo = '1'`. Ganha `IS_DEMO`. Em produção, `IS_HML` é `false` em tempo de build, então a leitura do `localStorage` some do bundle. A leitura fica num `try/catch` (navegação privada).
- Ligar o demo: grava o `localStorage`, abre um `PontoDb(DEMO_DB_NAME)`, chama `replaceAll(buildDemoData(new Date()))` e recarrega em `#/hoje`. Recriar faz o mesmo sobre o banco demo. Sair apaga a chave e recarrega. Isso fica em `src/db/demo.ts`, porque só `src/db/` abre um `PontoDb`, e a aba Dados carrega `DemoSection` com `lazy(() => import(…))` atrás de `import.meta.env.VITE_APP_ENV === 'hml'`, para o gerador não entrar no bundle de produção. (Um `IS_HML` importado não basta: o build não corta o `import()` através de módulos.)
- `DataScreen`: bloco `DemoSection` renderizado só com `IS_HML`. `App`: selo com "· Demo" quando `IS_DEMO`.
- `lastBackup`: chave `ponto-hml-demo:lastBackupAt` no demo (deriva de `DB_NAME`), para o aviso de backup da homologação real não mudar.
- Sem mudança no schema do Dexie: o banco demo usa as mesmas versões e migrações.
- O CA1 é conferido à mão na T4, com `grep` no `dist/`, e não vira passo do CI.

## Tarefas

- [x] T1. `lib/demo.ts` + testes (CA3–CA7).
- [x] T2. `IS_DEMO` e `DB_NAME` em `lib/env.ts`, `db/demo.ts` (ligar, recriar, sair) + teste com `fake-indexeddb` de que o banco `ponto-hml` não muda (CA2).
- [x] T3. Bloco Modo demo na aba Dados, selo "Homologação · Demo" e nome do backup demo.
- [x] T4. Build de produção sem o demo (CA1).
- [x] T5. Conferência headless no build de homologação, 390 px, claro e escuro (CA8).
- [x] T6. Atualizar ARCHITECTURE.md, PRODUCT.md (se couber), AGENTS.md e o índice de specs.
