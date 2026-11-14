#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
if ! command -v node >/dev/null 2>&1; then
 echo 'Node.js 22 ou superior nao encontrado. Instale o Node.js oficial e tente novamente.'
 exit 1
fi
node scripts/setup-wizard.mjs
