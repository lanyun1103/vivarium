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

### `agents` (M7)

One row per product line. Seeded lines include `inbox` (待分拣), `tianyan`, `company`, `reverse`, `feishu-monitor`, and `grok-product`. `INSERT OR IGNORE` keeps later edits to display name.

| Column | Description |
|--------|-------------|
| `agent_id` | Slug, primary key (`inbox`, `tianyan`, …) |
| `display_name`, `line` | Label and line slug |
| `avatar` | Emoji, path, or URL. Empty is fine. |
| `archived` | `1` hides the line from the default list and from routing |
| `description` | Short copy for the card |
| `policy_json` | Plugin-shaped policy: aliases, cwd hints, summary style, nudge / handoff copy |
| `created_at`, `updated_at` | ISO timestamps |

`sessions.agent_id` points at one of these rows after routing. Added columns: `reported_agent_id`, `route_confidence`, `route_source`, `route_reason`, `agent_locked`. Legacy harness-scoped ids (`claude-code:dry-run`) are copied into `reported_agent_id` and the session is moved to `inbox`.

### `schema_migrations`

Version tracker. `1` is the M1 event log. `2` adds product-line agents. Migrations only `ALTER` / add tables.

## Query API

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/v1/sessions?limit=50&agent_id=` | Recent sessions. Optional product-line filter. |
| `GET` | `/v1/agents?limit=50&include_archived=1` | Product lines (not harness ids), with running counts |
| `POST` | `/v1/agents` | Create a line (`agent_id`, `display_name`, optional `policy`) |
| `GET` | `/v1/agents/:agentId` | Line, policy, and its sessions |
| `PATCH` | `/v1/agents/:agentId` | Rename, avatar, archive, or replace policy fields. `inbox` cannot be archived. |
| `POST` | `/v1/sessions/:sessionId/reassign` | Brain move onto a line and lock it against the next ingest |
| `POST` | `/v1/brain/suggest` | `{ agent_id }` or `{ session_id }` → progress text + suggestions. Nothing is sent. |
| `GET` | `/v1/sessions/:sessionId` | Session + **steps** + **turns** |
| `POST` | `/v1/events` | Batch ingest. `session.start` is routed; the stored event payload is unchanged. |

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
