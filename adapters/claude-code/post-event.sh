#!/usr/bin/env bash
set +e
set -u

# Legacy curl helper — prefer tools/hook-run.ts (schema validation).
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/common.sh
source "${SCRIPT_DIR}/lib/common.sh"

payload="${1:-[]}"

if [[ -z "${VIVARIUM_URL:-}" ]]; then
  exit 0
fi

tsx_bin="$(vivarium_tsx)" || exit 0
"${tsx_bin}" "${SCRIPT_DIR}/tools/post-events-cli.ts" --soft --events "${payload}" 2>/dev/null || exit 0
exit 0
