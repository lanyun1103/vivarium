#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${VIVARIUM_URL:-}" ]]; then
  echo "VIVARIUM_URL is required" >&2
  exit 1
fi

payload="${1:?JSON events array required}"

auth=()
if [[ -n "${VIVARIUM_TOKEN:-}" ]]; then
  auth=(-H "Authorization: Bearer ${VIVARIUM_TOKEN}")
fi

curl -fsS -X POST "${VIVARIUM_URL}/v1/events" \
  -H "Content-Type: application/json" \
  "${auth[@]}" \
  -d "{\"events\": ${payload}}"
