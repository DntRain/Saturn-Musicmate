#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

claude -p "$(cat docs/claude-ui-brief.md)" \
  --permission-mode plan \
  --allowedTools Read,Grep,Glob \
  --max-budget-usd 2

