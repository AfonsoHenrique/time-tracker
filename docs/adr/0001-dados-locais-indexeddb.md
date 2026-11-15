# 0001. Dados só no aparelho (IndexedDB + Dexie) na fase 1

- **Status**: Aceito
- **Data**: 2026-11-08

## Contexto

App de uso pessoal, com histórico pequeno (quase sempre a última semana, raramente 30 dias). O objetivo é começar sem hospedagem de backend e sem login.

## Decisão

Guardar tudo no IndexedDB do navegador, usando o Dexie como camada de acesso. Sem backend e sem login na fase 1. Backup manual em JSON.

## Consequências

- Zero custo e zero infraestrutura.
- Os dados do Mac e do Android são independentes até a fase 2.
- Risco de perda se o navegador limpar os dados: mitigado com `navigator.storage.persist()`, app instalado pelo Chrome e backup JSON.
- O acesso a dados fica atrás de um repositório (`src/db/`) para facilitar a troca na fase 2.
