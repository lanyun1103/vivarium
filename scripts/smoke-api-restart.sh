#!/usr/bin/env bash
# End-to-end: POST events, restart API process, GET session back.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DB_DIR="$(mktemp -d)"
DB_PATH="${DB_DIR}/vivarium.db"
export VIVARIUM_DB_PATH="${DB_PATH}"
export VIVARIUM_URL="http://127.0.0.1:8799"
export PORT=8799

SESSION_ID="http-smoke-$(date +%s)"

cleanup() {
  if [[ -n "${API_PID:-}" ]]; then kill "${API_PID}" 2>/dev/null || true; fi
  rm -rf "${DB_DIR}"
}
trap cleanup EXIT

cd "${ROOT}"
pnpm --filter @vivarium/api exec node --import tsx src/index.ts &
API_PID=$!
sleep 1

payload=$(cat <<EOF
{"events":[
  {"type":"session.start","session_id":"${SESSION_ID}","at":"2026-11-01T05:00:00Z","agent_id":"http-smoke","harness":"test","model":"m","cwd":"~/x","task":"restart smoke","host":"local"},
  {"type":"session.turn","session_id":"${SESSION_ID}","at":"2026-11-01T05:00:01Z","role":"user","content":"ping"}
]}
EOF
)

curl -fsS -X POST "${VIVARIUM_URL}/v1/events" -H "Content-Type: application/json" -d "${payload}" >/dev/null

kill "${API_PID}"
wait "${API_PID}" 2>/dev/null || true
API_PID=""

pnpm --filter @vivarium/api exec node --import tsx src/index.ts &
API_PID=$!
sleep 1

detail=$(curl -fsS "${VIVARIUM_URL}/v1/sessions/${SESSION_ID}")
echo "${detail}" | grep -q '"content":"ping"' || { echo "turn not found after restart"; exit 1; }
echo "smoke-api-restart: OK ${SESSION_ID}"
