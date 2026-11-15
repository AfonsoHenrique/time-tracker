# 0004. Sincronização: Dexie local com Firestore, login Microsoft e Google

- **Status**: Proposto
- **Data**: 2026-11-15
- **Substitui**: [0003](0003-firebase-na-fase-2.md)

## Contexto

A ADR 0003 propôs Firebase com login Google e uma implementação Firestore do repositório. Ao detalhar a fase 2 (spec 008), três pontos mudaram:

- O login tem de ser sem senha, com **Microsoft** obrigatório; Google entra como segunda opção, prática no Android.
- O app precisa continuar funcionando **sem login**, como na fase 1.
- O repositório tem regras que precisam de transação local (um só intervalo aberto, `replaceAll` tudo ou nada). O cache offline do Firestore não faz transação sem rede.

## Decisão (proposta)

- **Firebase Auth** com os provedores Microsoft e Google, login por popup, vínculo dos dois na mesma conta.
- O **Dexie continua sendo o repositório** e a fonte da verdade no aparelho. Um motor de sincronização próprio (`src/sync/`) envia uma fila de mudanças (outbox) e recebe as mudanças remotas por um cursor de `serverTimestamp`.
- **Firestore lite** (`firebase/firestore/lite`), sem listener e sem cache, porque o cache já é o Dexie.
- Conflito por **última gravação vence**, registro a registro, pelo `updatedAt`. Apagar vira marca (`deletedAt`).
- Dados em `users/{uid}/envs/{prod|hml}/…`, protegidos por regras que só deixam o próprio usuário ler e gravar.

## Alternativas consideradas

- **Firestore com cache persistente no lugar do Dexie** (ADR 0003): menos código de sincronização, mas o app passaria a depender do Firebase mesmo sem login, as transações não funcionam offline, a migração dos dados locais vira um caso à parte e os testes com `fake-indexeddb` teriam de ser refeitos.
- **Supabase**: Postgres completo, mas sem modo offline pronto e com pausa de projetos gratuitos sem uso.
- **Link por e-mail** como login: sem senha, mas no Android o link abre no navegador e não no app instalado.
- **Passkey**: o Firebase Auth não oferece nativamente.
- **GitHub**: funciona, mas não acrescenta nada para um único usuário que já tem Microsoft e Google.

## Consequências

- As telas e a regra "UI não importa Dexie" não mudam; o repositório ganha a outbox e as marcas de apagado (schema v4).
- A regra de conflito é simples e testável, mas depende do relógio dos aparelhos. Para um usuário com Mac e Android sincronizados por NTP, a diferença é desprezível.
- O Firebase só é carregado com login, então quem não entra não paga o tamanho do SDK.
- Plano gratuito (Spark) sobra para um usuário.
