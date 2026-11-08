# Ponto (time-tracker)

PWA pessoal para registrar entradas e saídas do trabalho, acompanhar a meta de 40h semanais e exportar os intervalos no formato da planilha de horas.

Os dados ficam só no aparelho (IndexedDB). Não há servidor nem login nesta fase.

## Rodar localmente

```bash
npm install
npm run dev
```

## Comandos

| Comando | O que faz |
|---|---|
| `npm run dev` | Servidor de desenvolvimento |
| `npm test` | Testes (Vitest) |
| `npm run lint` | Lint (oxlint) |
| `npm run build` | Build de produção em `dist/` |
| `npm run preview` | Serve o build localmente |

## Publicação

Cada push na `main` publica o app no GitHub Pages pelo workflow `.github/workflows/deploy.yml`.
Endereço: https://afonsohenrique.github.io/time-tracker/

Para instalar: abra o endereço no Chrome (Mac ou Android) e use "Instalar app" / "Adicionar à tela inicial".

## Stack

Vite, React, TypeScript, vite-plugin-pwa, Dexie (IndexedDB) e date-fns.
