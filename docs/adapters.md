# Adapters

Harness-specific shims that POST Vivarium **`session.*`** events to the ingest API. All adapters share:

| Variable | Description |
|----------|-------------|
| `VIVARIUM_URL` | API base (required), e.g. `http://127.0.0.1:8787` |
| `VIVARIUM_TOKEN` | Optional Bearer token |

Schema: [@vivarium/schema](../packages/schema) · HTTP: `POST /v1/events`

## Overview

| Harness | Package | Integration style | Dry-run |
|---------|---------|-------------------|---------|
| **Claude Code** | [adapters/claude-code](../adapters/claude-code) | SessionStart/End hooks (fail-soft) | `pnpm dry-run:claude` |
| **Grok Bot** | [adapters/grok-bot](../adapters/grok-bot) | CLI `report` subcommands from bot routines | `pnpm dry-run:grok` |
| **Paseo** | [adapters/paseo](../adapters/paseo) | Map daemon run snapshot → events; optional poll | `pnpm dry-run:paseo` |

## Quick demo (web UI)

```bash
pnpm dev:api
pnpm dev:web
pnpm dry-run:claude
pnpm dry-run:grok
pnpm dry-run:paseo
```

Open http://127.0.0.1:5173 — three harnesses with distinct cards/transcripts.

## Claude Code

Hook-based; installs into `.claude/settings.local.json`. See [adapters/claude-code/README.md](../adapters/claude-code/README.md).

## Grok Bot / Temporal-style agents

Use the CLI from worker code (no IDE hooks):

```bash
export VIVARIUM_URL=http://127.0.0.1:8787
pnpm --filter @vivarium/adapter-grok-bot report start --task "My job" --session-id run-42
pnpm --filter @vivarium/adapter-grok-bot report turn --session-id run-42 --role assistant --content "Done"
pnpm --filter @vivarium/adapter-grok-bot report end --session-id run-42
```

Webhook/cron: `report post --json '[{...}]'`.

Details: [adapters/grok-bot/README.md](../adapters/grok-bot/README.md).

## Paseo

1. **Dry-run / CI**: `pnpm dry-run:paseo` (mock snapshot).
2. **Fixture file**: `pnpm --filter @vivarium/adapter-paseo ingest --file fixtures/mock-run.json`.
3. **Live daemon** (when available): set `PASEO_DAEMON_URL`, `PASEO_RUN_ID`, optional `PASEO_DAEMON_TOKEN`, run `pnpm --filter @vivarium/adapter-paseo poll`.

The expected daemon JSON contract is documented in [adapters/paseo/README.md](../adapters/paseo/README.md). **M4 does not ship verified Paseo credentials or production endpoints** — adjust the poll client when official API docs are available.

## Privacy

Redact paths and secrets before POST. Adapters should not send API keys or tokens in event payloads.

See also [plugins.md](./plugins.md) · [handoff.md](./handoff.md) · [architecture.md](./architecture.md) · [event-schema.md](./event-schema.md).
