#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$ROOT_DIR/.env.local"

cat <<'EOF'
Paste your QQ Music cookie below, then press Enter.

How to copy it:
1. Open https://y.qq.com and log in.
2. Open DevTools.
3. Go to Application -> Cookies -> https://y.qq.com.
4. Copy the Cookie request header value, for example:
   uin=...; qm_keyst=...; qqmusic_key=...

Do not share this cookie with anyone.
EOF

printf "\nQQ_MUSIC_COOKIE> "
IFS= read -r COOKIE

if [[ -z "${COOKIE// }" ]]; then
  echo "Cookie is empty; nothing was saved." >&2
  exit 1
fi

if [[ "$COOKIE" != *"="* || "$COOKIE" != *";"* ]]; then
  echo "This does not look like a browser cookie header." >&2
  echo "Expected something like: uin=...; qm_keyst=..." >&2
  exit 1
fi

umask 077
{
  echo "# Local secrets for Musicmate. Do not commit this file."
  printf "QQ_MUSIC_COOKIE=%q\n" "$COOKIE"
} > "$ENV_FILE"
chmod 600 "$ENV_FILE"

echo "Saved QQ_MUSIC_COOKIE to $ENV_FILE"
echo "Now run: ./scripts/start-all.sh /tmp/musicmate-empty \"周杰伦 晴天\""
