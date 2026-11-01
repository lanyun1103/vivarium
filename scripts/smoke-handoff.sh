#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DB_DIR="$(mktemp -d)"
export VIVARIUM_DB_PATH="${DB_DIR}/vivarium.db"
export VIVARIUM_URL="http://127.0.0.1:8796"
export PORT=8796

cleanup() {
  if [[ -n "${API_PID:-}" ]]; then kill "${API_PID}" 2>/dev/null || true; fi
  rm -rf "${DB_DIR}"
}
trap cleanup EXIT

cd "${ROOT}"
pnpm --filter @vivarium/adapter-claude-code test:transcript

pnpm --filter @vivarium/api exec node --import tsx src/index.ts &
API_PID=$!
sleep 1

OUT="$(pnpm dry-run:claude)"
SESSION_ID="$(echo "${OUT}" | tail -1 | sed -n 's/.*"session_id"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')"
[[ -n "${SESSION_ID}" ]] || { echo "no session_id"; exit 1; }

HANDOFF="$(curl -fsS -X POST "${VIVARIUM_URL}/v1/sessions/${SESSION_ID}/handoff" \
  -H "Content-Type: application/json" \
  -d '{"to_harness":"grok-bot","max_turns":10}')"

echo "${HANDOFF}" | grep -q '"resume_prompt"' || { echo "missing resume_prompt"; exit 1; }
echo "${HANDOFF}" | grep -q '"task_digest"' || { echo "missing task_digest"; exit 1; }
echo "${HANDOFF}" | grep -q 'session.handoff' || echo "${HANDOFF}" | grep -q '"from_harness"' 

echo "smoke-handoff: OK ${SESSION_ID}"
