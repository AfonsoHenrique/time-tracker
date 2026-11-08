#!/usr/bin/env bash
# Hook PostToolUse: depois que o Claude edita um arquivo TypeScript em src/,
# roda oxlint no arquivo e o typecheck do projeto. Se algo falhar, sai com
# código 2 e o erro volta para o Claude corrigir na hora.
set -uo pipefail

file=$(jq -r '.tool_input.file_path // empty')
case "$file" in
  */src/*.ts | */src/*.tsx) ;;
  *) exit 0 ;;
esac

cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0
[ -d node_modules ] || exit 0

if ! out=$(npx --no-install oxlint "$file" 2>&1); then
  echo "oxlint falhou em $file:" >&2
  echo "$out" >&2
  exit 2
fi

if ! out=$(npx --no-install tsc -b --noEmit 2>&1); then
  echo "typecheck falhou:" >&2
  echo "$out" | head -40 >&2
  exit 2
fi

exit 0
