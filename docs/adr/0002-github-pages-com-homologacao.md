# 0002. GitHub Pages com homologação em `/hml/`

- **Status**: Aceito
- **Data**: 2026-11-08

## Contexto

Um PWA precisa de HTTPS para ser instalado no Android. Queríamos hospedagem estática gratuita e, depois, um ambiente de homologação. O GitHub Pages publica um único site por repositório.

## Decisão

Publicar no GitHub Pages via GitHub Actions. A `main` vai para `/time-tracker/` (produção) e a `develop` para `/time-tracker/hml/` (homologação). Um push em qualquer uma das duas reconstrói e publica as duas.

## Consequências

- Sem contas novas além do GitHub.
- Mesma origem para os dois ambientes, o que exige banco IndexedDB com nome por ambiente e `navigateFallbackDenylist` no service worker de produção.
- O ambiente `github-pages` precisa liberar deploy das branches `main` e `develop`.
- Se um dia quisermos prévia por PR ou origens separadas, a alternativa é o Cloudflare Pages.
