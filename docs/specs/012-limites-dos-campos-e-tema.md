# 012. Limites nos campos do intervalo e escolha de tema

- **Status**: Rascunho
- **Marco**: 5.3
- **Relacionado**: [005-azure-devops-no-intervalo](005-azure-devops-no-intervalo.md), [006-backup-e-persistencia](006-backup-e-persistencia.md), [007-projeto-e-work-item-na-exportacao](007-projeto-e-work-item-na-exportacao.md), [008-login-e-sincronizacao](008-login-e-sincronizacao.md)

## Contexto

A observação do intervalo não tem limite, e os campos Work item e Task aceitam qualquer texto enquanto se digita (o erro só aparece ao salvar). A observação vira a coluna Descricao da planilha e o lançamento no Azure DevOps, então um texto curto basta, e os ids do DevOps são números de até 10 dígitos.

O app também só segue o tema do sistema. Dá para querer o tema escuro no celular com o sistema claro, ou o contrário, então o tema passa a ter uma escolha manual.

## Requisitos

### Observação até 200 caracteres

- R1. A observação do intervalo tem no máximo **200 caracteres**, contados depois de tirar os espaços das pontas (como já é gravada). Vazio continua valendo.
- R2. Na folha do intervalo, o campo Observação ganha um contador `N/200`, como o do Projeto, e não deixa digitar além de 200 (`maxLength`). Colar um texto maior corta no limite, que é o comportamento do navegador.
- R3. O repositório recusa gravar uma observação nova com mais de 200 caracteres (`invalid-interval`, "A observação deve ter no máximo 200 caracteres."), na criação e na edição.
- R4. **Observações antigas maiores que 200 ficam como estão.** Nada é cortado nem migrado. Ao editar um intervalo assim, o contador aparece em vermelho (ex.: `250/200`), mas dá para salvar mudanças nos outros campos sem mexer na observação. Só uma observação **alterada** precisa caber em 200. Motivo: não perder texto que já existe e não travar a edição de um horário por causa da observação.
- R5. **Backup**: a restauração aceita observações de qualquer tamanho, sem cortar. O backup é uma cópia dos dados; recusar o arquivo inteiro por causa de uma observação antiga impediria restaurar um backup feito pelo próprio app, e cortar perderia texto sem avisar. O limite vale para o que for digitado depois.
- R6. **Sincronização** (spec 008): as regras do Firestore continuam aceitando até 2000 caracteres na observação, pelo mesmo motivo do R5. Nenhuma mudança nas regras.
- R7. A observação do **dia sem meta** não muda (não foi pedido).

### Work item e Task até 10 dígitos

- R8. Os campos Work item e Task da folha **só aceitam dígitos** e no máximo **10**. Ao digitar ou colar, o que não é dígito é descartado na hora: colar `#123567` vira `123567`, e letras ou espaços não entram. O teclado numérico do celular continua (`inputMode="numeric"`).
- R9. O limite de valor continua o de hoje: inteiro de 1 até 2147483647 (inteiro de 32 bits, o limite dos ids do Azure DevOps), que tem 10 dígitos. Um número de 10 dígitos acima disso (ex.: `9999999999`) ou `0` dá erro ao salvar: "O work item deve ser um número de até 10 dígitos, ex.: 123567." (e o mesmo para a task). Assim o limite de 10 dígitos vale também no repositório e na importação, que já recusam ids fora dessa faixa.
- R10. **Backup**: nada muda. Um id que não é inteiro de 1 a 2147483647 já recusa o arquivo ("Intervalo N com work item inválido."). Como todo id aceito até hoje tem no máximo 10 dígitos, nenhum backup existente deixa de abrir.

### Escolha de tema

- R11. A aba **Dados** ganha uma seção **Aparência**, a primeira da aba, com três opções lado a lado (botões de escolha única): **Sistema** (padrão), **Claro** e **Escuro**.
- R12. **Sistema** segue o tema do aparelho e acompanha a mudança na hora (ex.: o modo escuro automático à noite), como hoje. **Claro** e **Escuro** fixam o tema, seja qual for o do sistema.
- R13. A escolha vale na hora, em todas as telas, e também para os controles nativos (seletor de hora, calendário, barras de rolagem), via `color-scheme`.
- R14. A escolha fica **neste aparelho** (`localStorage`): não vai para o backup nem para a sincronização, porque é uma preferência do aparelho (o Mac pode ficar claro e o celular escuro). Produção e homologação estão no mesmo endereço, então compartilham a escolha. Sem `localStorage` (aba privada), o app segue o sistema e a escolha vale só até fechar a aba.
- R15. Ao abrir o app, o tema escolhido já aparece no primeiro quadro, sem piscar o tema do sistema antes.
- R16. A cor da barra de status (`theme-color`, azul) não muda com o tema.

## Critérios de aceite

- [ ] CA1. Dado a folha de um intervalo novo, quando digito 200 caracteres na observação, então o contador mostra `200/200` e o 201º não entra.
- [ ] CA2. Dado o repositório, quando crio ou edito um intervalo com observação de 201 caracteres (sem contar espaços nas pontas), então ele falha com `invalid-interval`; com 200, grava.
- [ ] CA3. Dado um intervalo gravado com observação de 250 caracteres, quando abro a folha, então vejo o texto inteiro e o contador `250/200` em vermelho; quando mudo só o fim e salvo, então grava e a observação continua com 250. Quando mudo a observação e ela ainda tem mais de 200, então o salvar mostra "A observação deve ter no máximo 200 caracteres.".
- [ ] CA4. Dado um backup com uma observação de 500 caracteres, quando restauro, então ele abre e a observação volta inteira.
- [ ] CA5. Dado o campo Work item, quando colo `#123 567a`, então o campo fica `123567`; quando digito o 11º dígito, então ele não entra.
- [ ] CA6. Dado o Work item `9999999999` ou `0`, quando salvo, então aparece "O work item deve ser um número de até 10 dígitos, ex.: 123567."; com `2147483647`, grava. O mesmo para a Task.
- [ ] CA7. Dado o sistema no tema claro, quando escolho **Escuro** na aba Dados, então o app inteiro fica escuro na hora; quando recarrego, então abre escuro já no primeiro quadro.
- [ ] CA8. Dado **Sistema** escolhido, quando o sistema troca de claro para escuro, então o app troca junto, sem recarregar.
- [ ] CA9. Dado o sistema no escuro e **Claro** escolhido, então as telas, a folha do intervalo e o seletor de hora ficam claros.
- [ ] CA10. Em 390×800, nos temas claro e escuro, a seção Aparência e a folha com os contadores cabem sem quebrar o layout nem rolar na horizontal.

## Fora do escopo

- Limite na observação do dia sem meta.
- Cortar ou migrar observações antigas maiores que 200.
- Mudar as regras do Firestore.
- Levar o tema no backup ou sincronizar entre aparelhos.
- Outros temas ou cor de destaque escolhida pelo usuário.
- Trocar a cor da barra de status conforme o tema.

## Desenho

### Limites

- `src/lib/types.ts`: `NOTE_MAX_LENGTH = 200` e `DEVOPS_ID_MAX_DIGITS = 10`, ao lado de `PROJECT_MAX_LENGTH`.
- `src/lib/devops.ts`: `digitsOnly(texto)` tira tudo que não é dígito e corta em `DEVOPS_ID_MAX_DIGITS` (usada no `onChange` dos campos). `parseDevOpsId` continua aceitando `#` e espaços, para dados vindos de fora do formulário.
- `src/lib/clock.ts`: `readIntervalForm` recebe a observação original (vazia num intervalo novo) e só confere o limite quando a observação mudou (R4). Mensagens novas do work item e da task (R9).
- `src/db/repository.ts`: `note(valor, atual?)` confere o limite na criação e quando o `patch.note` é diferente da observação atual; `undefined` mantém.
- `src/lib/backup.ts`: sem mudança de validação (R5, R10); um teste fixa que uma observação longa passa inteira.
- `IntervalSheet`: contador `N/200` (classe de erro quando passa), `maxLength={NOTE_MAX_LENGTH}` na observação, `maxLength={10}` e `digitsOnly` nos ids.
- Sem mudança na estrutura dos dados salvos, sem migração do Dexie.

### Tema

- `src/lib/theme.ts` (lógica pura): `type ThemeChoice = 'system' | 'light' | 'dark'`, `THEME_KEY = 'ponto-theme'` e `parseThemeChoice(valor)`, que devolve `'system'` para qualquer valor desconhecido ou ausente. Com testes.
- `src/features/shared/theme.ts`: `readThemeChoice()`, `saveThemeChoice()` (com `try/catch`, como `lastBackup.ts`) e `applyTheme(escolha)`, que põe `data-theme="light|dark"` no `<html>` ou o remove em **Sistema**.
- `index.html`: um `<script>` pequeno no `<head>`, antes do CSS, lê `localStorage['ponto-theme']` e põe o `data-theme`, para o R15. Um teste confere que a chave do `index.html` é a mesma de `THEME_KEY`.
- `src/index.css`: as cores escuras passam a valer em `:root[data-theme='dark']` e em `@media (prefers-color-scheme: dark) { :root:not([data-theme='light']) }`. `color-scheme` vira `light` ou `dark` quando há escolha fixa e continua `light dark` em Sistema.
- `DataScreen`: seção `AppearanceSection` com três botões (`role="radiogroup"`, `aria-checked`), no topo da aba.
- Sem mudança no repositório nem no banco: o tema não é dado do app.

## Tarefas

- [ ] T1. Constantes, `digitsOnly` e testes (CA5, CA6).
- [ ] T2. Limite da observação em `readIntervalForm` e no repositório, com o caso da observação antiga (CA2, CA3), e teste do backup com observação longa (CA4).
- [ ] T3. Contadores e filtros na folha do intervalo (CA1, CA3, CA5).
- [ ] T4. `theme.ts` (lib e shared), script no `index.html`, CSS por `data-theme` e seção Aparência (CA7–CA9).
- [ ] T5. Conferência headless em 390×800, claro e escuro, com o sistema nos dois temas (CA10).
- [ ] T6. Atualizar PRODUCT.md, ARCHITECTURE.md (se citar o tema), AGENTS.md (estrutura) e o índice de specs.
