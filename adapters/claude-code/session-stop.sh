#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

session_id="${CLAUDE_SESSION_ID:-${PPID}-unknown}"
now="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"

payload="[
  {\"type\":\"session.end\",\"session_id\":\"${session_id}\",\"at\":\"${now}\",\"outcome\":\"success\",\"summary\":\"SessionStop hook\"}
]"

"${SCRIPT_DIR}/post-event.sh" "${payload}"
