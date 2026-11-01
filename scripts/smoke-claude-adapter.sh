#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DB_DIR="$(mktemp -d)"
export VIVARIUM_DB_PATH="${DB_DIR}/vivarium.db"
export VIVARIUM_URL="http://127.0.0.1:8798"
export PORT=8798

cleanup() {
  if [[ -n "${API_PID:-}" ]]; then kill "${API_PID}" 2>/dev/null || true; fi
  rm -rf "${DB_DIR}"
}
trap cleanup EXIT

cd "${ROOT}"
pnpm --filter @vivarium/api exec node --import tsx src/index.ts &
API_PID=$!
sleep 1

curl -fsS "${VIVARIUM_URL}/health" >/dev/null

OUT="$(pnpm dry-run:claude)"
echo "${OUT}"
SESSION_ID="$(echo "${OUT}" | tail -1 | sed -n 's/.*"session_id"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')"
if [[ -z "${SESSION_ID}" ]]; then
  echo "could not parse session_id from dry-run output" >&2
  exit 1
fi

detail=$(curl -fsS "${VIVARIUM_URL}/v1/sessions/${SESSION_ID}")
echo "${detail}" | grep -q 'Sample user prompt' || { echo "missing turn in session detail"; exit 1; }

kill "${API_PID}"
wait "${API_PID}" 2>/dev/null || true
API_PID=""

pnpm --filter @vivarium/api exec node --import tsx src/index.ts &
API_PID=$!
sleep 1

detail2=$(curl -fsS "${VIVARIUM_URL}/v1/sessions/${SESSION_ID}")
echo "${detail2}" | grep -q 'Sample user prompt' || { echo "session lost after API restart"; exit 1; }

echo "smoke-claude-adapter: OK ${SESSION_ID}"
