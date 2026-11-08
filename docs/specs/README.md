# Specs

Uma spec por funcionalidade ou marco. Ela diz **o quê** e **como saber que está pronto**, antes de qualquer código. O agente (ou você) implementa a partir dela e marca as tarefas conforme avança.

## Como usar

1. Copie [`_template.md`](_template.md) para `NNN-nome-curto.md`.
2. Preencha o contexto, os requisitos e os critérios de aceite. Deixe as tarefas como plano inicial.
3. Revise a spec (pode ser num PR só com ela) e mude o status para **Pronta**.
4. Implemente em um ou mais PRs, marcando as tarefas. Os critérios de aceite viram testes sempre que possível.
5. Ao terminar, mude o status para **Concluída**.

Status: Rascunho → Pronta → Em andamento → Concluída.

## Índice

| Spec | Marco | Status |
|---|---|---|
| [001-dados-e-regras](001-dados-e-regras.md) | 2. Dados e regras de cálculo | Concluída |
| [002-tela-hoje](002-tela-hoje.md) | 3. Tela Hoje | Concluída |
| [003-semana-e-navegacao](003-semana-e-navegacao.md) | 4. Semana e navegação | Rascunho |

Próximas: 004 período e exportação, 005 backup e persistência.
