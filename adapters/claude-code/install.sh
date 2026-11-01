#!/usr/bin/env bash
# Install Vivarium Claude Code hooks into a project or user settings.
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: install.sh [--project DIR] [--user] [--dry-run]

  --project DIR   Install into DIR/.claude (default: current directory)
  --user          Also print ~/.claude merge instructions (does not overwrite user settings)
  --dry-run       Print actions without writing files

Writes:
  .claude/vivarium.env.example  → copy to vivarium.env and edit
  .claude/hooks/vivarium/*.sh   → wrappers calling this repo's adapter
  .claude/settings.local.json   → merges SessionStart, SessionEnd, optional UserPromptSubmit

Requires: pnpm install at vivarium repo root (for tsx + schema).
EOF
}

TARGET="${PWD}"
USER_HINT=false
DRY=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --project)
      TARGET="${2:?}"
      shift 2
      ;;
    --user)
      USER_HINT=true
      shift
      ;;
    --dry-run)
      DRY=true
      shift
      ;;
    -h | --help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage
      exit 1
      ;;
  esac
done

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ADAPTER="${REPO_ROOT}/adapters/claude-code"
CLAUDE_DIR="${TARGET}/.claude"
HOOKS_DIR="${CLAUDE_DIR}/hooks/vivarium"
SETTINGS="${CLAUDE_DIR}/settings.local.json"

run() {
  if [[ "${DRY}" == true ]]; then
    echo "[dry-run] $*"
  else
    "$@"
  fi
}

run mkdir -p "${HOOKS_DIR}"

write_wrapper() {
  local name="$1"
  local hook="$2"
  local path="${HOOKS_DIR}/${name}"
  if [[ "${DRY}" == true ]]; then
    echo "[dry-run] write ${path}"
    return
  fi
  cat >"${path}" <<EOF
#!/usr/bin/env bash
set +e
export VIVARIUM_REPO="${REPO_ROOT}"
export CLAUDE_PROJECT_DIR="\${CLAUDE_PROJECT_DIR:-${TARGET}}"
# shellcheck disable=SC1091
[[ -f "\${CLAUDE_PROJECT_DIR}/.claude/vivarium.env" ]] && source "\${CLAUDE_PROJECT_DIR}/.claude/vivarium.env"
exec "\${VIVARIUM_REPO}/adapters/claude-code/${hook}"
EOF
  chmod +x "${path}"
}

write_wrapper "session-start.sh" "session-start.sh"
write_wrapper "session-end.sh" "session-end.sh"
write_wrapper "user-prompt-submit.sh" "user-prompt-submit.sh"
write_wrapper "stop-turn.sh" "stop-turn.sh"

ENV_EXAMPLE="${CLAUDE_DIR}/vivarium.env.example"
if [[ "${DRY}" == true ]]; then
  echo "[dry-run] write ${ENV_EXAMPLE}"
else
  cat >"${ENV_EXAMPLE}" <<EOF
# Copy to vivarium.env in this directory and fill in values.
VIVARIUM_URL=http://127.0.0.1:8787
# VIVARIUM_TOKEN=
# VIVARIUM_AGENT_ID=my-laptop-agent
# VIVARIUM_MAX_TURN_CHARS=8000
EOF
fi

FRAGMENT="${ADAPTER}/templates/settings.local.fragment.json"
if [[ ! -f "${FRAGMENT}" ]]; then
  echo "Missing template: ${FRAGMENT}" >&2
  exit 1
fi

merge_settings() {
  if [[ "${DRY}" == true ]]; then
    echo "[dry-run] merge hooks into ${SETTINGS}"
    return
  fi
  if command -v jq >/dev/null 2>&1; then
    if [[ -f "${SETTINGS}" ]]; then
      jq -s '
        .[0] as $a | .[1] as $b |
        ($a * $b) |
        .hooks = (($a.hooks // {}) * ($b.hooks // {}))
      ' "${SETTINGS}" "${FRAGMENT}" >"${SETTINGS}.tmp"
    else
      cp "${FRAGMENT}" "${SETTINGS}.tmp"
    fi
    mv "${SETTINGS}.tmp" "${SETTINGS}"
  else
    echo "jq not found — copy hooks from ${FRAGMENT} into ${SETTINGS} manually." >&2
    cp "${FRAGMENT}" "${CLAUDE_DIR}/settings.local.fragment.json"
  fi
}

merge_settings

if [[ "${DRY}" == false && ! -f "${CLAUDE_DIR}/vivarium.env" ]]; then
  cp "${ENV_EXAMPLE}" "${CLAUDE_DIR}/vivarium.env"
  echo "Created ${CLAUDE_DIR}/vivarium.env — set VIVARIUM_URL (and token if needed)."
fi

cat <<EOF

Installed Vivarium hooks under ${CLAUDE_DIR}

Next steps:
  1. Edit ${CLAUDE_DIR}/vivarium.env (VIVARIUM_URL, optional VIVARIUM_TOKEN)
  2. Ensure Vivarium API is running: pnpm dev:api (from ${REPO_ROOT})
  3. Run pnpm install once in ${REPO_ROOT}
  4. Open Claude Code in ${TARGET}; hooks run on SessionStart / SessionEnd
  5. Optional user turns: UserPromptSubmit hook is included (async) — assistant turns are NOT available yet

Verify without Claude Code:
  VIVARIUM_URL=http://127.0.0.1:8787 pnpm dry-run:claude

EOF

if [[ "${USER_HINT}" == true ]]; then
  cat <<EOF
For all projects (~/.claude/settings.json), copy the "hooks" block from:
  ${FRAGMENT}
Use paths under your vivarium checkout instead of \${CLAUDE_PROJECT_DIR}/.claude/hooks/vivarium/
EOF
fi
