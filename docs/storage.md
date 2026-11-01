# Storage (M1)

Vivarium persists validated events in **SQLite** for local and self-hosted deployments. The same logical schema is intended to map to **Cloudflare D1** on Workers without changing adapter payloads.

## Environment

| Variable | Default | Description |
|----------|---------|-------------|
| `VIVARIUM_DB_PATH` | `./data/vivarium.db` (relative to API process cwd) | SQLite file location |
| `VIVARIUM_TOKEN` | *(unset = open)* | Bearer token for all `/v1/*` routes |

Create the parent directory automatically on boot. WAL mode is enabled for safer concurrent reads.

## Tables

### `sessions`

Denormalized row per `session_id` for listing and card metadata. Updated from `session.start`, touched on every event, finalized on `session.end`.

| Column | Source |
|--------|--------|
| `session_id` | PK |
| `agent_id`, `harness`, `model`, `cwd`, `task`, `host` | `session.start` |
| `started_at` | first `session.start.at` |
| `updated_at` | latest event time |
| `ended_at`, `outcome`, `summary` | `session.end` |

### `events`

Append-only log of every ingested event.

| Column | Description |
|--------|-------------|
| `id` | Auto-increment order (transcript ordering) |
| `session_id`, `type`, `at` | Indexed fields |
| `payload` | Full JSON event (schema-validated at ingest) |
| `received_at` | Server insert time |

### `schema_migrations`

Single-row version tracker (`version = 1` for M1). Future migrations bump this and run `ALTER` / new tables in code.

## Query API

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/v1/sessions?limit=50` | Recent sessions (metadata) |
| `GET` | `/v1/agents?limit=50` | Recent agents (latest session per `agent_id`) |
| `GET` | `/v1/sessions/:sessionId` | Session + **steps** (latest per `step_id`) + **turns** (ordered transcript) |
| `POST` | `/v1/events` | Batch ingest (unchanged contract) |

## Cloudflare D1 (later)

Map tables 1:1 in D1 SQL:

- Use `TEXT` for timestamps (ISO 8601), `TEXT` JSON for `payload`.
- Replace `better-sqlite3` with D1 binding in a Worker; keep `@vivarium/schema` validation in shared code.
- Large transcript exports (M4+) may offload blob storage to R2 while keeping `events` rows in D1 or pruning old payloads.

No D1 adapter ships in M1; this document is the migration reference.

## Verify persistence

```bash
pnpm smoke:api
```

Or manually: start API, `POST /v1/events`, stop process, restart, `GET /v1/sessions/:id`.
