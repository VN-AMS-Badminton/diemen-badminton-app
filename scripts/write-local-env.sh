#!/usr/bin/env bash
# Writes .env.local with values from the running local Supabase stack.
# Usage: npm run db:env  (after `npm run db:start`)
#
# Why a script: `supabase start` prints the local API URL + anon/service keys
# but doesn't write them into your project. This script reads `supabase
# status -o env` and merges the relevant values into .env.local without
# clobbering other variables you may have set (e.g. SESSION_SECRET).

set -euo pipefail

if ! supabase status >/dev/null 2>&1; then
  echo "supabase is not running — run \`npm run db:start\` first" >&2
  exit 1
fi

# Get URL + keys from the running stack
RAW=$(supabase status -o env)
API_URL=$(echo "$RAW" | grep '^API_URL=' | cut -d= -f2- | tr -d '"')
ANON_KEY=$(echo "$RAW" | grep '^ANON_KEY=' | cut -d= -f2- | tr -d '"')
SERVICE_ROLE_KEY=$(echo "$RAW" | grep '^SERVICE_ROLE_KEY=' | cut -d= -f2- | tr -d '"')

ENV_FILE=".env.local"

# Generate a SESSION_SECRET if .env.local does not yet have one.
SESSION_SECRET=""
if [[ -f "$ENV_FILE" ]]; then
  SESSION_SECRET=$(grep -E '^SESSION_SECRET=' "$ENV_FILE" | cut -d= -f2- || true)
fi
if [[ -z "$SESSION_SECRET" ]]; then
  SESSION_SECRET=$(openssl rand -base64 48 | tr -d '\n')
fi

# Preserve TIKKIE_DEFAULT_URL if already set
TIKKIE_URL=""
if [[ -f "$ENV_FILE" ]]; then
  TIKKIE_URL=$(grep -E '^TIKKIE_DEFAULT_URL=' "$ENV_FILE" | cut -d= -f2- || true)
fi

cat > "$ENV_FILE" <<EOF
# Local development environment — points to local Supabase stack.
# Regenerate with: npm run db:env
NEXT_PUBLIC_SUPABASE_URL=${API_URL}
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=${ANON_KEY}
SUPABASE_SECRET_KEY=${SERVICE_ROLE_KEY}

NEXT_PUBLIC_APP_URL=http://localhost:3000
SESSION_SECRET=${SESSION_SECRET}
TIKKIE_DEFAULT_URL=${TIKKIE_URL:-https://tikkie.me/pay/example}
EOF

echo "Wrote $ENV_FILE pointing to ${API_URL}"
echo "Studio: http://127.0.0.1:54323"
