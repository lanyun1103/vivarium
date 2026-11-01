#!/usr/bin/env bash
set +e
set -u

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/common.sh
source "${SCRIPT_DIR}/lib/common.sh"

if [[ -f "${CLAUDE_PROJECT_DIR:-}/.claude/vivarium.env" ]]; then
  vivarium_load_env "${CLAUDE_PROJECT_DIR}/.claude/vivarium.env"
elif [[ -f "${HOME}/.claude/vivarium.env" ]]; then
  vivarium_load_env "${HOME}/.claude/vivarium.env"
fi

vivarium_run_hook Stop
exit 0
