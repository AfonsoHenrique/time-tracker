# 0005. Azure DevOps com token de acesso pessoal guardado no aparelho

- **Status**: Proposto
- **Data**: 2026-11-21

## Contexto

A fase 3 lança as horas dos intervalos nas tasks do Azure DevOps (spec 013). O app é um PWA estático no GitHub Pages, sem backend, e o Firebase só cuida do login e da sincronização do próprio app.

O usuário é PJ: a organização do Azure DevOps é do cliente, num tenant do Microsoft Entra ID que ele não administra.

A API REST do Azure DevOps aceita chamadas direto do navegador: responde ao `OPTIONS` com `Access-Control-Allow-Origin: *` e aceita o cabeçalho `Authorization` (conferido em 2026-11-21).

## Decisão (proposta)

Autenticar com um **token de acesso pessoal (PAT)** que o usuário gera no Azure DevOps, só com o escopo **Work Items (Read & write)**, e cola na aba Dados.

- O PAT e a organização ficam no `localStorage` do aparelho, com a chave do ambiente. Não vão para o IndexedDB sincronizado, para o Firestore nem para o backup.
- O app chama `dev.azure.com` direto do navegador, sem servidor no meio.
- Cada aparelho configura o seu token.

## Alternativas consideradas

- **Login Microsoft (Entra ID) com MSAL e PKCE**: sem segredo guardado e com token curto. Mas exige registrar o app e, quase sempre, o consentimento de um administrador do tenant do cliente para o recurso do Azure DevOps. Para um PJ isso depende de terceiros e pode nunca sair. O OAuth antigo do próprio Azure DevOps não aceita apps novos.
- **PAT sincronizado pelo Firestore**: configuraria uma vez só, mas o segredo passaria a ficar na nuvem, legível por quem tiver acesso à conta do Firebase. Não compensa evitar colar o token duas vezes.
- **Backend próprio (Cloud Function) guardando o token**: tira o token do navegador, mas cria servidor, custo e um ponto a mais para manter, contra o ADR 0001.

## Consequências

- O PAT fica legível por qualquer script que rode na origem `afonsohenrique.github.io`. O app não carrega scripts de terceiros, e o escopo mínimo limita o estrago a work items.
- O PAT expira (no máximo um ano, e a organização pode exigir menos). O app trata 401/403 e pede um token novo.
- A organização pode proibir PAT por política. Nesse caso o lançamento não funciona e a saída é a alternativa do Entra ID, num ADR novo.
- Se o app fechar entre atualizar a task e marcar os intervalos como declarados, um novo lançamento somaria de novo. O comentário no histórico da task registra cada lançamento para conferir.
