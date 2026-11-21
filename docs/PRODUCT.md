# Produto

Fonte das regras de negócio. O plano completo, com o histórico das decisões, está no documento [Ponto: plano do PWA de bater ponto](https://claude.ai/artifact/Q1LTfdBTrvH6634odMaaDK).

## Para que serve

Uso pessoal de um profissional PJ, sem controle formal da empresa. O app serve para:

1. conferir se as 40h semanais combinadas foram cumpridas;
2. servir de base para preencher a planilha de horas (Excel/Outlook), que depois vira lançamento de horas em tasks no Azure DevOps.

## Jornada

- Meta de **40h por semana**: **8h por dia de segunda a sexta**; sábado e domingo têm meta 0.
- Horário flexível (normalmente entre 08:00 e 18:00). Um dia pode ter **vários intervalos** (várias paradas, não só almoço).
- Horas a mais num dia, ou no fim de semana, abatem o que falta na semana.
- **Cada semana começa do zero** (segunda a domingo). Não existe banco de horas entre semanas.
- **Dia sem meta** (feriado, folga): tira 8h da meta da semana. Não tem tipo. Ex.: segunda feriado → meta da semana 32h.
- **Período mensal**: do dia **26** ao dia **25** do mês seguinte.

## Registro

- Botão Entrar/Sair grava o **minuto exato**. Nada é arredondado automaticamente.
- Intervalos podem ser adicionados, editados e apagados livremente.
- Cada intervalo tem uma **observação** opcional, de até 200 caracteres. Observações antigas maiores continuam inteiras; só uma observação alterada precisa caber no limite (spec 012).
- Cada intervalo pode ter o **work item** do Azure DevOps e a **task** filha onde as horas são declaradas (ids, opcionais, só números de até 10 dígitos), um **projeto** (texto de até 15 caracteres, opcional) e a marca **Declarado** (padrão: não), que diz se as horas já foram lançadas no Azure DevOps. Ex.: `09:00–09:30 Daily equipe IA · WI 123567 · Task 123568 · Declarado`.
- Nada é apagado automaticamente.

## Telas

- **Hoje**: botão Entrar/Sair, cronômetro enquanto estiver dentro, trabalhado hoje, falta no dia, falta na semana, previsão do horário de saída (reserva 1h de almoço enquanto ele ainda é provável; ver spec 009), lista de intervalos (cada um com a duração em H:MM e em horas decimais para o Azure DevOps, ex.: `1:30 · 1.5 h`; ver spec 011), setas ‹ › para trocar de dia, calendário no título para pular para qualquer data, "dia sem meta".
- **Semana**: uma linha por dia com trabalhado, meta e alerta de irregularidade; totais; setas ‹ › para trocar de semana e calendário no título para pular para a semana de qualquer data.
- **Período 26–25**: totais e semanas, com exportação; setas e calendário no título para trocar de período.
- **Semana** também exporta os seus dias, porque a planilha é preenchida por semana.
- **Semana** e **Período** têm o botão **Lançar no Azure DevOps** (spec 013), que preenche as tasks dos intervalos não declarados e os marca como declarados.
- **Dados**: escolher o tema (Sistema, Claro ou Escuro; vale só no aparelho; spec 012), conectar o Azure DevOps (organização e token, só no aparelho) e as opções do lançamento (spec 013), baixar backup em JSON (`ponto-backup-AAAA-MM-DD.json`, com intervalos, dias sem meta e configurações), restaurar um backup (mostra um resumo e pede confirmação antes de substituir tudo) e ver se o navegador prometeu não apagar os dados. O backup serve para trocar de aparelho e para levar dados entre produção e homologação. Só na homologação, a aba também tem o **modo demo**, que mostra o app com uma semana e meia de dados fictícios num banco separado, sem tocar nos dados reais (spec 010).

## Dias irregulares

Destacar o dia quando:

- há intervalo aberto que não é o atual (esqueceu de bater a saída);
- há intervalo com mais de 12h ou que passa da meia-noite;
- há intervalos sobrepostos;
- é dia útil com meta, já passou e tem 0h.

Dia útil com menos de 8h **não** é irregular.

## Exportação

Mesmas colunas da aba SEMANA da planilha `HORAS.xlsx`:

`SEMANA | DATA | INICIO | FIM | Soma | Descricao | TASK | Projeto | Detalhe | Work item`

- Uma linha por intervalo, mais recente primeiro.
- SEMANA = `seg`…`dom`; DATA = `dd/mm/aaaa`; INICIO/FIM = `HH:MM`; Soma = `H:MM`.
- Descricao = observação; TASK = id da task do Azure DevOps; Projeto = projeto do intervalo; Detalhe em branco; Work item = id do work item, numa coluna extra na ponta direita, depois das colunas da planilha. Os campos sem valor ficam vazios.
- Saídas: botão "Copiar para o Excel" (TSV na área de transferência, **sem cabeçalho**, para colar embaixo das linhas que já existem) e download `.csv` (**com cabeçalho**, `;`, UTF-8 com BOM).
- Intervalo em andamento não entra; a tela avisa quantos ficaram de fora.
- Intervalo que passa da meia-noite sai numa linha só, no dia do início.

## Lançamento no Azure DevOps

Spec 013. Para cada task com intervalos não declarados na tela, o app mostra uma prévia e, com uma confirmação, grava na task:

- **Tipo de atividade** (escolhido na prévia entre os valores permitidos; vem com o último usado);
- **Horas Estimadas** e **Horas Consumidas** com o mesmo total: a soma de todos os intervalos da task nas semanas da tela, que **substitui** o valor anterior (lançar de novo não conta em dobro);
- **Start Date** na segunda e **Target Date** na sexta da semana;
- **Detalhes do apontamento**: uma linha por intervalo, mais recente primeiro, ex.: `19/nov 10:30 10:45 0:15 Daily MS`;
- **Responsável** = conta do token;
- estado **Active** (ou **Closed**, com a opção "Fechar a task ao lançar").

Por padrão vai a duração real (ex.: 50 min = 0.83 h). Com "Arredondar para 15 min", cada intervalo vai para o múltiplo de 15 mais próximo, mínimo 15. Os intervalos gravados não mudam. Depois de gravar a task, os intervalos dela ficam **Declarados**.

## Fases

| Fase | Escopo |
|---|---|
| 1 | Tudo local, sem login, GitHub Pages |
| 2 | Sincronização Mac/Android e login sem senha (Microsoft e Google), ver spec 008 e ADR 0004 |
| 3 | Lançar as horas nas tasks do Azure DevOps, com token pessoal guardado no aparelho (spec 013, ADR 0005) |
