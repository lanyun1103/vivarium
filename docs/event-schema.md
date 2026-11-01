# Event schema

All ingest payloads are JSON. Each message has a top-level `type` and `session_id`. Timestamps use ISO 8601 unless noted.

Implementation: `@vivarium/schema` (Zod). HTTP: `POST /v1/events` with body `{ "events": [ ... ] }`.

## Envelope

| Field | Required | Description |
|-------|----------|-------------|
| `type` | yes | Event kind (see below) |
| `session_id` | yes | Unique id for this run |
| `at` | no | Event time (default: server receive time) |

Session-scoped fields may repeat on every event for idempotent adapters.

## `session.start`

Marks the beginning of an Agent run.

| Field | Type | Description |
|-------|------|-------------|
| `agent_id` | string | Routing **hint**. A product-line slug (`tianyan`) is kept when it matches a real line. A harness id (`claude-code:dry-run`) is stored as `reported_agent_id`; the session is routed separately. Prefer `#天眼` / `#company` in `task` when the hint is not a line. |
| `harness` | string | e.g. `claude-code`, `grok-bot` |
| `model` | string | Model id if known |
| `cwd` | string | Working directory (prefer relative or redacted) |
| `task` | string | Human-readable task summary |
| `host` | string | Machine or environment label |

## `session.turn`

One chat message in the transcript.

| Field | Type | Description |
|-------|------|-------------|
| `role` | `user` \| `assistant` \| `system` \| `tool` | Speaker |
| `content` | string | Plain text (or serialized blocks) |
| `tool_calls` | array? | `{ id, name, arguments }` |
| `model` | string? | Model used for this turn |
| `tokens` | object? | `{ prompt?, completion?, total? }` |
| `at` | string? | Turn timestamp |

## `session.step`

Structured progress within a session (plan steps, subagents, etc.).

| Field | Type | Description |
|-------|------|-------------|
| `step_id` | string | Stable step key |
| `title` | string | Display title |
| `status` | `pending` \| `running` \| `done` \| `failed` | Step state |
| `progress` | number? | 0–1 optional |

## `session.log`

Structured log line for the session timeline.

| Field | Type | Description |
|-------|------|-------------|
| `level` | `debug` \| `info` \| `warn` \| `error` | Severity |
| `message` | string | Log text |
| `at` | string? | Timestamp |

## `session.heartbeat`

Liveness and optional metrics while the Agent is running.

| Field | Type | Description |
|-------|------|-------------|
| `alive` | boolean | Whether the harness considers the session active |
| `metrics` | object? | Opaque key/value (CPU, queue depth, etc.) |

## `session.handoff`

Request or record a harness switch with packaged context.

| Field | Type | Description |
|-------|------|-------------|
| `from_harness` | string | Source harness id |
| `to_harness` | string | Target harness id |
| `transcript_ref` | string | Server-side pointer or hash |
| `task_digest` | string | Short summary for the target harness |

**Handoff package** (HTTP `POST /v1/sessions/:id/handoff`) may also include optional `turns[]` and `resume_prompt` for manual resume — see [handoff.md](./handoff.md).

See `examples/handoff-package.json` for a portable snapshot shape.

## `session.end`

| Field | Type | Description |
|-------|------|-------------|
| `outcome` | `success` \| `failed` \| `cancelled` | Final status |
| `summary` | string? | Optional closing summary |

## Redaction

Adapters **must not** emit secrets. For paths, prefer:

- Strip known secret env vars from `task` and `content`.
- Replace `$HOME` or `/Users/*` with `~` in `cwd` when posting to a shared server.
