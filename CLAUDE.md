# CLAUDE.md

As instruções do projeto ficam em [AGENTS.md](AGENTS.md), compartilhadas com qualquer agente de IA:

@AGENTS.md

## Específico do Claude Code

- Ao receber uma tarefa de funcionalidade, abra a spec correspondente em `docs/specs/` antes de planejar. Se não houver, proponha uma usando `docs/specs/_template.md`.
- Ao concluir uma tarefa da spec, marque o item na seção **Tarefas** dela no mesmo PR.
- Para verificar a interface, rode `npm run build && npx vite preview` e abra `http://localhost:4173/time-tracker/` num navegador headless com viewport de celular (390×800).
