#!/usr/bin/env bash
# Hook SessionStart: instala as dependências se ainda não estiverem instaladas
# (útil em sessões na nuvem, que começam com um clone limpo).
set -uo pipefail
cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0
if [ ! -d node_modules ]; then
  npm ci --no-audit --no-fund >/dev/null 2>&1 || npm install --no-audit --no-fund >/dev/null 2>&1
fi
exit 0
