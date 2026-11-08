# CLAUDE.md

As instruções do projeto ficam em [AGENTS.md](AGENTS.md), compartilhadas com qualquer agente de IA:

@AGENTS.md

## Específico do Claude Code

- Ao receber uma tarefa de funcionalidade, abra a spec correspondente em `docs/specs/` antes de planejar. Se não houver, proponha uma usando `docs/specs/_template.md`.
- Ao concluir uma tarefa da spec, marque o item na seção **Tarefas** dela no mesmo PR.
- Para verificar a interface, rode `npm run build && npx vite preview` e abra `http://localhost:4173/time-tracker/` num navegador headless com viewport de celular (390×800).

## Configuração do Claude Code (`.claude/`)

- `settings.json`: comandos de build, teste, lint e git liberados sem pedir permissão; push forçado e push direto em `main`/`develop` bloqueados.
- Hook **PostToolUse**: depois de editar um `.ts`/`.tsx` em `src/`, roda `oxlint` no arquivo e `tsc -b --noEmit`. Se falhar, o erro volta para o Claude corrigir na hora.
- Hook **SessionStart**: instala as dependências quando `node_modules` não existe (sessões na nuvem).
- Ajustes pessoais vão em `.claude/settings.local.json` (ignorado pelo git).
