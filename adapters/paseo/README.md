# Paseo adapter

Maps a **Paseo agent run** snapshot into Vivarium `session.*` events. Live daemon wiring uses a documented HTTP contract; **M4 ships mock/dry-run** until real Paseo API credentials and paths are confirmed.

## Environment

| Variable | Required | Description |
|----------|----------|-------------|
| `VIVARIUM_URL` | yes | Vivarium API |
| `VIVARIUM_TOKEN` | no | Vivarium auth |
| `PASEO_DAEMON_URL` | poll only | Base URL for Paseo daemon |
| `PASEO_RUN_ID` | poll only | Run id to fetch |
| `PASEO_DAEMON_TOKEN` | no | Bearer for daemon |

## Adapter contract (daemon → Vivarium)

Implement (or mock) daemon endpoint:

```http
GET {PASEO_DAEMON_URL}/v1/runs/{run_id}
Authorization: Bearer {PASEO_DAEMON_TOKEN}
```

Response body:

```json
{
  "run": {
    "run_id": "…",
    "agent_id": "…",
    "host": "…",
    "status": "running|idle|done|failed",
    "model": "optional",
    "cwd": "optional",
    "task": "optional",
    "dialogue": [{ "role": "user|assistant", "content": "…", "at": "ISO" }],
    "steps": [{ "id": "…", "title": "…", "status": "running" }]
  }
}
```

TypeScript type: `tools/types.ts` (`PaseoRunSnapshot`).

Mapper: `tools/map-run.ts` → batch POST to Vivarium.

## Commands

```bash
export VIVARIUM_URL=http://127.0.0.1:8787

# Dry-run (mock snapshot — shows in web UI)
pnpm dry-run:paseo

# Ingest fixture file
pnpm --filter @vivarium/adapter-paseo ingest --file adapters/paseo/fixtures/mock-run.json

# Live poll (needs real daemon matching contract above)
PASEO_DAEMON_URL=http://127.0.0.1:7741 PASEO_RUN_ID=abc \
  pnpm --filter @vivarium/adapter-paseo poll
```

## Gaps (M4)

- **No verified public Paseo OpenAPI** in this repo — `poll-daemon.ts` targets the contract above; adjust path/shape when official docs exist.
- **Credentials**: `PASEO_DAEMON_TOKEN` is placeholder; you must supply real auth for live polls.
- **Streaming dialogue**: mapper sends one batch per sync; no continuous webhook yet.
- **Duplicate turns** if you poll the same run repeatedly without idempotency on the server.

See [docs/adapters.md](../../docs/adapters.md).
