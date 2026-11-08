# Contribuindo

## Fluxo de branches

```
feature/xyz  ──PR──▶  develop (homologação)  ──PR──▶  main (produção)
```

1. Crie a branch a partir da `develop`: `feat/…`, `fix/…`, `docs/…` ou `chore/…`.
2. Abra o PR para a **`develop`**. O CI roda lint, testes e os dois builds.
3. Depois do merge, a homologação é publicada em `/time-tracker/hml/`. Teste lá (banco separado, pode bagunçar à vontade).
4. Para lançar, abra um PR **`develop → main`**. Depois do merge, a produção é publicada em `/time-tracker/`.

## Spec antes do código

Funcionalidades novas começam por uma spec em `docs/specs/` (veja [`docs/specs/README.md`](docs/specs/README.md)). Correções pequenas e ajustes visuais não precisam de spec.

## Commits

- Em português, no imperativo, com a primeira linha curta: `Adiciona exportação CSV`, `Corrige saldo da semana com feriado`.
- Um assunto por commit. O corpo explica o porquê quando não for óbvio.

## Checklist do PR

- [ ] `npm run lint && npm test && npm run build` passando
- [ ] Regras de cálculo novas ou alteradas têm teste
- [ ] Spec atualizada (tarefas marcadas, critérios de aceite conferidos)
- [ ] Docs e `AGENTS.md` atualizados se algo descrito mudou
- [ ] Mudança de schema do banco tem migração
- [ ] Testado em homologação (para PRs `develop → main`)
