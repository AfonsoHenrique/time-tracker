# 002. Tela Hoje

- **Status**: Rascunho
- **Marco**: 3
- **Relacionado**: [PRODUCT.md](../PRODUCT.md), [001-dados-e-regras](001-dados-e-regras.md)

## Contexto

É a tela que abre o app e a que mais vai ser usada: bater a entrada e a saída, ver quanto já foi feito no dia e quanto falta no dia e na semana. Também é onde se corrige um intervalo, se escreve a observação e se marca um dia sem meta.

## Requisitos

- R1. Um botão grande **Entrar** / **Sair**. Entrar abre um intervalo agora e Sair fecha o intervalo aberto agora, no minuto exato.
- R2. Enquanto houver um intervalo aberto, um **cronômetro** mostra o tempo desde a entrada (`H:MM:SS`), atualizado a cada segundo.
- R3. Resumo do dia mostrado: **trabalhado hoje**, **falta no dia** (ou excedente, quando passar da meta) e **falta na semana** (da semana do dia mostrado). Os valores incluem o intervalo aberto e sobem sozinhos.
- R4. **Lista de intervalos** do dia, em ordem de início, com início, fim (ou "agora"), duração e observação.
- R5. **Editar** um intervalo: início, fim e observação. **Apagar** com confirmação. **Adicionar** um intervalo manual (esqueceu de bater).
- R6. **Setas ‹ ›** trocam de dia e um botão **Hoje** volta para o dia atual. A data mostrada vem no formato "Segunda, 9 de novembro".
- R7. Em outro dia que não hoje, o botão Entrar/Sair não aparece. Dá para ver, editar, adicionar e apagar intervalos normalmente.
- R8. Interruptor **Dia sem meta** nos dias úteis. Ligado, a meta do dia vira 0 e a da semana cai 8h.
- R9. Se o dia for irregular, aparece um aviso com o motivo em texto (ex.: "Intervalo aberto de um dia anterior").
- R10. Ao voltar para o app (aba ou PWA voltando ao primeiro plano), os dados são recarregados e, se a data mudou, o dia atual é atualizado.
- R11. Funciona bem num celular de 390 px de largura e no tema escuro.

## Critérios de aceite

- [ ] CA1. Dado nenhum intervalo aberto, quando toco em Entrar às 08:03, então aparece um intervalo 08:03–agora, o botão vira Sair e o cronômetro começa.
- [ ] CA2. Dado um intervalo aberto, quando toco em Sair às 12:00, então o intervalo fecha em 12:00, o cronômetro some e o trabalhado do dia soma esse intervalo.
- [ ] CA3. Dado 08:00–12:00 fechado e 13:00–agora com o relógio em 14:30, então o trabalhado mostra 5:30 e falta no dia mostra 2:30.
- [ ] CA4. Dado 9:00 trabalhadas num dia útil, então a tela mostra excedente +1:00 em vez de "falta".
- [ ] CA5. Dado um intervalo 08:00–12:00, quando edito o fim para 11:30 e a observação para "daily", então a lista, o trabalhado e a falta mudam na hora.
- [ ] CA6. Quando edito um intervalo com o fim antes do início, então aparece um erro no formulário e nada é gravado.
- [ ] CA7. Quando apago um intervalo e confirmo, ele some da lista. Se cancelo, nada muda.
- [ ] CA8. Dado um intervalo aberto, quando tento salvar outro intervalo sem fim, então aparece o erro "Já existe um intervalo aberto".
- [ ] CA9. Na tela de ontem, o botão Entrar/Sair não aparece e o botão Hoje aparece.
- [ ] CA10. Dada uma segunda útil, quando ligo Dia sem meta, então a meta do dia vira 0 e a falta da semana cai 8h. Num sábado o interruptor não aparece.
- [ ] CA11. Dado um intervalo aberto de ontem, então a tela de ontem mostra o aviso de dia irregular. Hoje, o botão mostra Sair, para fechar esse intervalo.
- [ ] CA12. O app abre direto na tela Hoje, em 390×800, sem rolagem horizontal, nos temas claro e escuro.

## Fora do escopo

- Tela Semana, abas e navegação entre telas (spec 003).
- Período 26–25 e exportação (spec 004).
- Backup e restauração (spec 005).
- Configurações editáveis (meta diária, dias úteis): continuam no padrão.
- Notificações e lembretes de bater ponto.

## Desenho

- `src/features/today/TodayScreen.tsx`: a tela. `useToday(day)` (hook no mesmo diretório) carrega os intervalos do dia, os da semana, os dias sem meta e o intervalo aberto pelo repositório, e expõe as ações (entrar, sair, salvar, apagar, alternar dia sem meta). Depois de cada ação, recarrega. Sem `dexie-react-hooks`, para a tela não depender do Dexie.
- `src/lib/clock.ts` (puro, com teste): `formatElapsed(start, now)` → `H:MM:SS`, `formatDayTitle(day)` → "Segunda, 9 de novembro", `parseTimeInput(day, 'HH:MM')` → instante, e a montagem de início e fim a partir do formulário.
- `src/lib/irregular.ts` ganha `describeIrregularity(kind)` com o texto de cada motivo.
- Relógio: um `useNow()` que atualiza a cada segundo só enquanto houver intervalo aberto. Sem intervalo aberto, atualiza a cada minuto, para trocar o dia na virada.
- Edição: uma folha (`<dialog>`) com campos `type="time"` para início e fim no dia mostrado e um campo de texto para a observação. Fim vazio = intervalo aberto. Fim antes do início é erro. Um intervalo que passa da meia-noite continua possível, mas só aparece pelo Entrar/Sair, e fica marcado como irregular.
- Erros do repositório (`RepositoryError.code`) viram mensagens em português na tela.
- Componentes reutilizáveis (botão grande, cartão de resumo) em `src/components/` quando servirem também à spec 003.
- Testes: as regras novas ficam em `src/lib/` com Vitest. A tela é conferida com o build de produção num navegador headless (390×800, claro e escuro), como diz o CLAUDE.md. Não entra Testing Library por enquanto.

## Tarefas

- [ ] T1. `lib/clock.ts` + testes (cronômetro, título do dia, leitura de HH:MM).
- [ ] T2. `describeIrregularity` + teste.
- [ ] T3. `useNow` e `useToday` sobre o repositório.
- [ ] T4. `TodayScreen`: botão Entrar/Sair, cronômetro, resumo, setas e botão Hoje (CA1–CA4, CA9).
- [ ] T5. Lista de intervalos e folha de edição, adição e exclusão (CA5–CA8).
- [ ] T6. Dia sem meta e aviso de irregularidade (CA10, CA11).
- [ ] T7. Estilos para celular e tema escuro; conferência headless (CA12).
- [ ] T8. Atualizar AGENTS.md, ARCHITECTURE.md e o índice de specs.
