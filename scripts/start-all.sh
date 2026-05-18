#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [[ -f "$ROOT_DIR/.env.local" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT_DIR/.env.local"
  set +a
fi

if [[ -f "$ROOT_DIR/qqcookies.txt" ]]; then
  QQ_MUSIC_COOKIE="$(
    python - "$ROOT_DIR/qqcookies.txt" <<'PY'
import re
import sys
from pathlib import Path

text = Path(sys.argv[1]).read_text(errors="ignore")
text = re.sub(r"(?i)^cookie:\s*", "", text.strip())
parts = []
for raw in re.split(r"[;\n]+", text):
    raw = raw.strip()
    if not raw or "=" not in raw:
        continue
    key, value = raw.split("=", 1)
    key = key.strip()
    value = value.strip()
    if key and value:
        parts.append(f"{key}={value}")
print("; ".join(parts))
PY
  )"
  export QQ_MUSIC_COOKIE
fi

MUSIC_DIR="${1:-${MUSICMATE_MUSIC_DIR:-/tmp/musicmate-empty}}"
ONLINE_QUERY="${2:-${MUSICMATE_ONLINE_QUERY:-}}"
QQ_API_DIR="${MUSICMATE_QQ_API_DIR:-$ROOT_DIR/.services/qq-music-api}"
QQ_API_BASE="${MUSICMATE_QQ_API_BASE:-http://127.0.0.1:3200}"
QQ_API_PORT="${MUSICMATE_QQ_API_PORT:-3200}"
QQ_API_PID=""

cleanup() {
  if [[ -n "$QQ_API_PID" ]] && kill -0 "$QQ_API_PID" 2>/dev/null; then
    kill "$QQ_API_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT INT TERM

need_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

port_is_open() {
  if command -v nc >/dev/null 2>&1; then
    nc -z 127.0.0.1 "$QQ_API_PORT" >/dev/null 2>&1
  else
    (echo >/dev/tcp/127.0.0.1/"$QQ_API_PORT") >/dev/null 2>&1
  fi
}

wait_for_qq_api() {
  for _ in $(seq 1 40); do
    if port_is_open; then
      return 0
    fi
    sleep 0.25
  done
  echo "QQ Music API did not become ready on port $QQ_API_PORT." >&2
  return 1
}

prepare_music_dir() {
  mkdir -p "$MUSIC_DIR"
}

prepare_qq_api() {
  need_cmd npm

  if port_is_open; then
    echo "QQ Music API already running at $QQ_API_BASE"
    return 0
  fi

  if [[ ! -d "$QQ_API_DIR" ]]; then
    need_cmd git
    echo "Cloning Rain120/qq-music-api into $QQ_API_DIR"
    mkdir -p "$(dirname "$QQ_API_DIR")"
    git clone https://github.com/Rain120/qq-music-api.git "$QQ_API_DIR"
  fi

  if [[ ! -d "$QQ_API_DIR/node_modules" ]]; then
    echo "Installing QQ Music API dependencies"
    npm --prefix "$QQ_API_DIR" install
  fi

  echo "Starting QQ Music API at $QQ_API_BASE"
  PORT="$QQ_API_PORT" QQ_MUSIC_COOKIE="${QQ_MUSIC_COOKIE:-}" npm --prefix "$QQ_API_DIR" start >/tmp/musicmate-qq-api.log 2>&1 &
  QQ_API_PID="$!"
  wait_for_qq_api
}

start_musicmate() {
  need_cmd cargo
  export MUSICMATE_QQ_API_BASE="$QQ_API_BASE"
  if [[ -n "$ONLINE_QUERY" ]]; then
    export MUSICMATE_ONLINE_QUERY="$ONLINE_QUERY"
    echo "Online search query: $ONLINE_QUERY"
  fi
  echo "Starting Musicmate TUI with music directory: $MUSIC_DIR"
  echo "Press q in the TUI to quit."
  cd "$ROOT_DIR"
  cargo run -p musicmate -- "$MUSIC_DIR"
}

prepare_music_dir
prepare_qq_api
start_musicmate
