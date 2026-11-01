#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

session_id="${CLAUDE_SESSION_ID:-${PPID}-$(date +%s)}"
agent_id="${VIVARIUM_AGENT_ID:-claude-code-local}"
cwd="${PWD}"
if [[ -n "${HOME:-}" ]]; then
  cwd="${cwd/#$HOME/~}"
fi

task="${VIVARIUM_TASK:-Claude Code session}"
host="$(hostname -s 2>/dev/null || echo unknown)"
model="${VIVARIUM_MODEL:-unknown}"
now="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"

payload="[
  {\"type\":\"session.start\",\"session_id\":\"${session_id}\",\"at\":\"${now}\",\"agent_id\":\"${agent_id}\",\"harness\":\"claude-code\",\"model\":\"${model}\",\"cwd\":\"${cwd}\",\"task\":\"${task}\",\"host\":\"${host}\"},
  {\"type\":\"session.log\",\"session_id\":\"${session_id}\",\"at\":\"${now}\",\"level\":\"info\",\"message\":\"SessionStart hook fired\"}
]"

"${SCRIPT_DIR}/post-event.sh" "${payload}"
