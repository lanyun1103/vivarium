#!/usr/bin/env bash
# Back-compat alias — Claude Code uses SessionEnd, not SessionStop.
set +e
exec "$(dirname "$0")/session-end.sh"
