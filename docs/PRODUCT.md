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
- Cada intervalo tem uma **observação** opcional. Não há campo de task por intervalo.
- Nada é apagado automaticamente.

## Telas

- **Hoje**: botão Entrar/Sair, cronômetro enquanto estiver dentro, trabalhado hoje, falta no dia, falta na semana, lista de intervalos, setas ‹ › para trocar de dia, "dia sem meta".
- **Semana**: uma linha por dia com trabalhado, meta e alerta de irregularidade; totais; setas ‹ › para trocar de semana.
- **Período 26–25**: totais e semanas; ponto de partida da exportação.
- **Dados**: exportar CSV, backup e restauração em JSON.

## Dias irregulares

Destacar o dia quando:

- há intervalo aberto que não é o atual (esqueceu de bater a saída);
- há intervalo com mais de 12h ou que passa da meia-noite;
- há intervalos sobrepostos;
- é dia útil com meta, já passou e tem 0h.

Dia útil com menos de 8h **não** é irregular.

## Exportação

Mesmas colunas da aba SEMANA da planilha `HORAS.xlsx`:

`SEMANA | DATA | INICIO | FIM | Soma | Descricao | TASK | Projeto | Detalhe`

- Uma linha por intervalo, mais recente primeiro.
- SEMANA = `seg`…`dom`; DATA = `dd/mm/aaaa`; INICIO/FIM = `HH:MM`; Soma = `H:MM`.
- Descricao = observação; TASK, Projeto e Detalhe em branco.
- Saídas: botão "Copiar para o Excel" (TSV na área de transferência) e download `.csv` (`;`, UTF-8 com BOM).

## Fases

| Fase | Escopo |
|---|---|
| 1 | Tudo local, sem login, GitHub Pages |
| 2 | Sincronização Mac/Android e login (Firebase recomendado, ver ADR 0003) |
| 3 (ideia) | Quebrar blocos em atividades com task/projeto e lançar no Azure DevOps |
