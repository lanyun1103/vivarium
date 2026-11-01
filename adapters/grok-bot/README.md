# Grok Bot adapter

Report **Grok Bot**, Cursor cloud agents, or any Temporal-style worker to Vivarium using the same `session.*` schema as Claude Code — **without** Claude hooks.

## Environment

| Variable | Required | Description |
|----------|----------|-------------|
| `VIVARIUM_URL` | yes | API base URL (no trailing slash) |
| `VIVARIUM_TOKEN` | no | Bearer token if API enforces auth |
| `VIVARIUM_SESSION_ID` | no | Default session id for CLI commands |
| `VIVARIUM_AGENT_ID` | no | Override `agent_id` on `start` |
| `VIVARIUM_MODEL` | no | Model name (default `grok`) |

## CLI helper (from bot routine)

```bash
export VIVARIUM_URL=http://127.0.0.1:8787

# Start of run
pnpm --filter @vivarium/adapter-grok-bot report start \
  --task "Review PR" --model grok-3 --session-id my-run-1

# During run
pnpm --filter @vivarium/adapter-grok-bot report turn \
  --session-id my-run-1 --role user --content "What's the risk?"
pnpm --filter @vivarium/adapter-grok-bot report turn \
  --session-id my-run-1 --role assistant --content "Low risk; tests pass."
pnpm --filter @vivarium/adapter-grok-bot report step \
  --session-id my-run-1 --step-id t1 --title "Analyze" --status done
pnpm --filter @vivarium/adapter-grok-bot report heartbeat --session-id my-run-1

# End
pnpm --filter @vivarium/adapter-grok-bot report end \
  --session-id my-run-1 --outcome success --summary "Review complete"
```

Batch JSON (webhook-friendly):

```bash
pnpm --filter @vivarium/adapter-grok-bot report post --json '[{"type":"session.log","session_id":"my-run-1","level":"info","message":"ping"}]'
```

## Dry-run (web UI)

```bash
pnpm dev:api
pnpm dry-run:grok
# Open http://127.0.0.1:5173 — look for harness grok-bot
```

## Integration notes

- Call `start` once per agent run, `end` on completion; use stable `--session-id` from your orchestrator.
- Prefer redacted `cwd` (`~/project`); never send secrets in `content`.
- Failures throw to stderr — wrap in your bot with try/catch if you need fail-soft (unlike Claude hooks).

See [docs/adapters.md](../../docs/adapters.md) · [docs/plugins.md](../../docs/plugins.md) · [docs/handoff.md](../../docs/handoff.md).
