# 008. Login sem senha e sincronização entre aparelhos

- **Status**: Rascunho
- **Marco**: 7 (fase 2)
- **Relacionado**: [ADR 0004](../adr/0004-sincronizacao-dexie-firestore.md) (substitui a [ADR 0003](../adr/0003-firebase-na-fase-2.md)), [006-backup-e-persistencia](006-backup-e-persistencia.md), [ARCHITECTURE.md](../ARCHITECTURE.md)

## Contexto

Na fase 1 cada aparelho tem os seus dados, e o backup JSON é a única ponte entre o Mac e o Android. Esta spec liga os dois: o usuário entra com uma conta Microsoft ou Google, sem senha, e os intervalos, dias sem meta e configurações passam a ser os mesmos nos dois aparelhos. O app continua funcionando sem internet e sem login, como hoje.

## Requisitos

### Login

- R1. Login só por provedor externo, sem senha do app: **Microsoft** (obrigatório) e **Google**. Não existe cadastro com e-mail e senha.
- R2. O login é opcional. Sem login o app funciona como na fase 1, só no aparelho.
- R3. O bloco **Conta** fica na aba Dados: "Entrar com Microsoft", "Entrar com Google"; logado, mostra nome, e-mail, provedor, estado da sincronização e "Sair".
- R4. Logado com um provedor, o usuário pode **vincular** o outro à mesma conta (ex.: e-mail da Microsoft diferente do Gmail). Os dois logins levam aos mesmos dados.
- R5. A sessão dura até o usuário sair: abrir o app de novo, mesmo offline, não pede login.

### Sincronização

- R6. **Offline primeiro**: toda leitura e gravação continua indo para o IndexedDB local, na hora, com ou sem rede. A nuvem é atualizada em segundo plano.
- R7. A sincronização roda ao abrir o app, ao voltar para o primeiro plano, quando a rede volta, alguns segundos depois de cada gravação e a cada minuto com o app aberto.
- R8. Conflito: o mesmo registro mudou nos dois aparelhos antes de sincronizar. Vence a **versão gravada por último** (`updatedAt`), registro a registro. Apagar também é uma mudança, com data, e segue a mesma regra.
- R9. Dois intervalos abertos depois de sincronizar (entrou no Mac e no Android sem rede) não travam nada: o dia aparece como irregular, a tela Hoje mostra o aviso e o botão Sair fecha o mais recente. O usuário corrige o outro à mão.
- R10. A aba Dados mostra o estado: "Sincronizado às 14:32", "Sincronizando…", "Sem internet: 3 alterações esperando" ou o erro. Um botão "Sincronizar agora".
- R11. Produção e homologação sincronizam em lugares separados na nuvem, como já acontece com o banco local.

### Primeiro login neste aparelho

- R12. Nuvem vazia e aparelho com dados: os dados do aparelho sobem sem perguntar.
- R13. Nuvem com dados e aparelho vazio: os dados da nuvem descem sem perguntar.
- R14. Os dois com dados: a tela mostra um resumo dos dois lados (quantos intervalos, de quando a quando) e oferece **Juntar** (recomendado: une pelos ids, e onde o mesmo registro existe nos dois vale o mais recente), **Usar só os da nuvem** (descarta os do aparelho) ou **Cancelar** (sai da conta). Antes de qualquer opção que descarta algo, a tela oferece baixar um backup.
- R15. Se o aparelho já sincronizou com outra conta, entrar com uma conta diferente pede confirmação antes de misturar os dados.
- R16. Sair da conta mantém os dados no aparelho e para a sincronização. Alterações ainda não enviadas geram um aviso antes de sair.

### Segurança

- R17. Regras do Firestore: cada usuário só lê e grava em `users/{seu uid}/…`. Nada é público. Os documentos são validados nas regras (campos, tipos e tamanhos), espelhando o repositório.
- R18. Só o login do próprio Afonso precisa funcionar, mas qualquer conta pode entrar e só vê os próprios dados (vazios). Não há lista de usuários permitidos.

### Backup

- R19. Baixar backup continua igual e funciona sem login.
- R20. Restaurar com a sincronização ligada substitui os dados **também na nuvem** e, depois, no outro aparelho. A confirmação avisa isso.

## Critérios de aceite

- [ ] CA1. Sem login, todas as telas funcionam como antes e nenhuma chamada ao Firebase é feita.
- [ ] CA2. Entrar com Microsoft e depois com Google (vinculado) leva ao mesmo `uid` e aos mesmos dados.
- [ ] CA3. Bato a entrada no Mac sem rede; o intervalo aparece na hora. Quando a rede volta, ele aparece no Android em até um minuto com o app aberto, ou ao abrir o app.
- [ ] CA4. Edito a observação do mesmo intervalo no Mac (10:00) e no Android (10:05), os dois offline. Depois de sincronizar, os dois aparelhos mostram a do Android.
- [ ] CA5. Apago um intervalo no Android e edito o mesmo no Mac antes, offline. Depois de sincronizar, vale a ação mais recente nos dois aparelhos.
- [ ] CA6. Entrada batida nos dois aparelhos offline: depois de sincronizar há dois intervalos abertos, o dia fica irregular e Sair fecha o mais recente.
- [ ] CA7. Primeiro login com 20 intervalos no aparelho e nuvem vazia: os 20 sobem. Num segundo aparelho vazio, os 20 descem.
- [ ] CA8. Primeiro login com dados nos dois lados: a tela mostra o resumo; Juntar une pelos ids; Cancelar não muda nada em nenhum lado.
- [ ] CA9. Com o usuário A logado, uma leitura ou gravação em `users/B/…` é negada (teste no emulador do Firestore).
- [ ] CA10. Um documento com `end` antes de `start`, ou `project` com mais de 15 caracteres, é negado pelas regras.
- [ ] CA11. Restaurar um backup com a sincronização ligada deixa a nuvem e o outro aparelho iguais ao backup.
- [ ] CA12. Dados de homologação nunca aparecem na produção, e o contrário.
- [ ] CA13. Sair com alterações pendentes mostra o aviso; depois de sair os dados continuam no aparelho.
- [ ] CA14. O bloco Conta cabe em 390 px nos temas claro e escuro; o login funciona no Chrome do Mac e no app instalado no Android.

## Fora do escopo

- Senha, link por e-mail, passkey, GitHub e Apple.
- Mesclar campo a campo: o conflito é resolvido pelo registro inteiro.
- Compartilhar dados entre pessoas, ou mais de um usuário por aparelho ao mesmo tempo.
- Apagar a conta e os dados da nuvem pela tela (dá para fazer no console do Firebase).
- Atualização em tempo real (listener): a sincronização periódica basta para quem troca de aparelho.

## Desenho

### Visão geral

O Dexie continua sendo a fonte da verdade no aparelho, e as telas não mudam. Um **motor de sincronização** em `src/sync/` empurra as mudanças locais para o Firestore e puxa as remotas para o Dexie. Ver a ADR 0004 para o porquê de não usar o cache offline do Firestore como repositório.

```
UI ─▶ repositório ─▶ Dexie (IndexedDB)
                        │  outbox de mudanças
                        ▼
                   src/sync/engine ◀──▶ Firestore (firebase/firestore/lite)
                        ▲
                   src/sync/auth  ──▶ Firebase Auth (Microsoft, Google)
```

### Firebase

- SDK modular `firebase`, só `firebase/app`, `firebase/auth` e `firebase/firestore/lite` (sem listener e sem cache próprio, bem menor que o Firestore completo). Carregado com `import()` só quando há login, para não pesar no app de quem não entra (CA1).
- A configuração web do Firebase (apiKey, projectId…) é pública por natureza e vai em `src/lib/firebaseConfig.ts`. Quem protege os dados são as regras e os domínios autorizados.
- Login com `signInWithPopup` e `OAuthProvider('microsoft.com')` / `GoogleAuthProvider`; `linkWithPopup` para vincular. Popup, e não redirect, porque o redirect do Firebase Auth deixou de funcionar fora do domínio `firebaseapp.com` com o particionamento de armazenamento do Chrome, e o app está no GitHub Pages.
- Persistência da sessão: `indexedDBLocalPersistence`.
- Domínios autorizados: `afonsohenrique.github.io` e `localhost`.

### Dados na nuvem

```
users/{uid}/envs/{prod|hml}/intervals/{id}
users/{uid}/envs/{prod|hml}/daysOff/{AAAA-MM-DD}
users/{uid}/envs/{prod|hml}/meta/settings
```

Cada documento é o registro local mais `updatedAt` (do aparelho, decide o conflito), `deletedAt` (`null` ou instante: apagar vira marca, para o outro aparelho saber) e `syncedAt` (`serverTimestamp()`, cursor de leitura). `DayOff` e `Settings` ganham `updatedAt`, que hoje só o intervalo tem.

### Banco local: versão 4 do schema

- `daysOff` e `settings` ganham `updatedAt` (o `upgrade` preenche com o instante da migração).
- Tabela nova `outbox`: `key` (`intervals/{id}`, `daysOff/{data}`, `settings`), `updatedAt`. Toda gravação e todo apagar do repositório escreve na outbox na mesma transação.
- Tabela nova `tombstones`: `key`, `deletedAt`. Apagar remove o registro da tabela de sempre (as consultas não mudam) e guarda a marca aqui até ela subir.
- Tabela nova `syncState` (uma linha): `uid` do aparelho, `lastPulledAt`, `lastSyncAt`, último erro.

### Motor (`src/sync/engine.ts`)

- **Enviar**: para cada item da outbox, lê o registro (ou a marca) e grava no Firestore numa transação que só escreve se o `updatedAt` remoto for menor ou igual. Depois tira da outbox. Em lotes de até 500.
- **Receber**: consulta cada coleção com `syncedAt > lastPulledAt` e aplica no Dexie quando o remoto é mais novo que o local; marca remota apaga o local. Avança `lastPulledAt`.
- Ordem: enviar, depois receber. Um ciclo por vez (trava em memória e `navigator.locks` entre abas).
- A regra de conflito é pura em `src/lib/sync.ts` (`resolve(local, remote)`), com teste.
- Gravações que vêm da sincronização não entram na outbox, para não voltarem em eco.
- `useRangeData` já recarrega em `visibilitychange`; ganha também um evento `ponto:synced` disparado quando um ciclo traz mudanças.

### Regras do Firestore

`firestore.rules` no repositório, com `match /users/{uid}/{document=**} { allow read, write: if request.auth.uid == uid }` e validação por coleção. Testes em `firestore.rules.test.ts` com `@firebase/rules-unit-testing` e o emulador, num script `npm run test:rules` (fora do `npm test`, porque precisa de Java). O deploy das regras é manual pelo Afonso (`firebase deploy --only firestore:rules`) até valer a pena automatizar.

### Primeiro login

`src/lib/firstSync.ts` (puro) decide entre subir, descer ou perguntar, a partir das contagens dos dois lados e do `uid` guardado em `syncState` (R12 a R15). Juntar = marcar tudo do aparelho na outbox e rodar um ciclo normal; o `updatedAt` resolve os repetidos. Usar só os da nuvem = `replaceAll` com os dados remotos, sem outbox.

### Backup

`replaceAll` com a sincronização ligada coloca na outbox tudo o que foi gravado e cria marcas para o que sumiu (R20). O formato do arquivo não muda (`version: 1`); `updatedAt` de dias sem meta e configurações é preenchido na restauração quando faltar.

### Dependências novas

- `firebase`: login com Microsoft e Google e acesso ao Firestore. Fazer à mão o OAuth dos dois provedores e um backend seria muito mais trabalho.
- `@firebase/rules-unit-testing` e `firebase-tools` (dev): testar as regras no emulador.

### O que o Afonso precisa fazer

1. Criar o projeto no Firebase (plano Spark, gratuito) e ativar o Firestore.
2. Em Authentication, ativar Google e Microsoft, e adicionar `afonsohenrique.github.io` aos domínios autorizados.
3. Registrar um app no Microsoft Entra (portal do Azure) com o redirect `https://<projeto>.firebaseapp.com/__/auth/handler` e copiar o client id e o secret para o provedor Microsoft do Firebase.
4. Mandar a configuração web do Firebase (o bloco `firebaseConfig`).

## Tarefas

- [ ] T1. ADR 0004 e esta spec aprovadas.
- [ ] T2. Schema v4 (`outbox`, `tombstones`, `syncState`, `updatedAt` em dias sem meta e configurações) + migração e testes.
- [ ] T3. Repositório grava na outbox e nas marcas; `replaceAll` com sync ligado (R20) + testes.
- [ ] T4. `lib/sync.ts` (conflito) e `lib/firstSync.ts` (primeiro login) + testes (CA4–CA8).
- [ ] T5. `src/sync/engine.ts` com Firestore lite, gatilhos e evento `ponto:synced` + testes com o Firestore simulado.
- [ ] T6. `src/sync/auth.ts`: login, vínculo e saída; bloco Conta na aba Dados (R3, R4, R10, R16).
- [ ] T7. Tela do primeiro login com resumo e opções (R14, R15).
- [ ] T8. `firestore.rules` + testes no emulador (CA9, CA10).
- [ ] T9. Conferência no Mac e no Android instalado, nos dois ambientes (CA3, CA12, CA14).
- [ ] T10. Atualizar PRODUCT.md, ARCHITECTURE.md, AGENTS.md e o índice de specs.
