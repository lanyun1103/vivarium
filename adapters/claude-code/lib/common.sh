#!/usr/bin/env bash
# Shared helpers for Claude Code Vivarium hooks — fail soft, never block Claude.
set +e
set -u

vivarium_adapter_root() {
  cd "$(dirname "${BASH_SOURCE[1]}")" && pwd
}

vivarium_repo_root() {
  cd "$(vivarium_adapter_root)/../.." && pwd
}

vivarium_tsx() {
  local repo
  repo="$(vivarium_repo_root)"
  if [[ -x "${repo}/node_modules/.bin/tsx" ]]; then
    echo "${repo}/node_modules/.bin/tsx"
    return 0
  fi
  if command -v tsx >/dev/null 2>&1; then
    command -v tsx
    return 0
  fi
  return 1
}

vivarium_load_env() {
  local env_file="${1:-}"
  if [[ -n "${env_file}" && -f "${env_file}" ]]; then
    # shellcheck disable=SC1090
    set -a
    source "${env_file}"
    set +a
  fi
}

vivarium_run_hook() {
  local hook_name="${1:?hook name}"
  local tsx_bin
  tsx_bin="$(vivarium_tsx)" || {
    echo "[vivarium] tsx not found; run pnpm install in vivarium repo" >&2
    return 0
  }
  local adapter
  adapter="$(vivarium_adapter_root)"
  "${tsx_bin}" "${adapter}/tools/hook-run.ts" "${hook_name}"
  return 0
}
