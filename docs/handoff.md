# Handoff (M3.5 PoC)

Vivarium **handoff** packages conversation context so you can continue on another harness manually. This is not live remote execution — download JSON + paste `resume_prompt` or follow CLI hints.

## API

```http
POST /v1/sessions/:sessionId/handoff
Content-Type: application/json

{
  "to_harness": "grok-bot",
  "max_turns": 20
}
```

Response:

- `package` — `@vivarium/schema` `handoffPackage` (includes optional `turns`, `resume_prompt`)
- `event` — persisted `session.handoff` event
- `resume` — copy-paste helpers (`claude_code`, `generic_curl`)

`transcript_ref` points at the server session (`vivarium://<session_id>?turns=N`).

## Web UI

Open a session → **换马 / Handoff** → choose target harness → **Generate handoff** → download JSON and read instructions.

## Manual resume (Claude Code)

```bash
# after downloading vivarium-handoff-<session>.json as handoff.json
claude "Continue this Vivarium handoff:" "$(jq -r .resume_prompt handoff.json)"
```

Or paste the `resume_prompt` field into any harness as the first user message.

## Transcript richness (Claude Code)

On **SessionEnd**, the adapter attempts to parse Claude Code `transcript_path` JSONL (see [adapters/claude-code/README.md](../adapters/claude-code/README.md)). Hooks remain fail-soft.

Gaps:

- Duplicate turns possible (hooks + JSONL overlap)
- Tool payloads summarized as `[tool:name]` text only
- Very large transcripts truncated by `VIVARIUM_TRANSCRIPT_MAX_LINES` (default 400)

## Verify

```bash
pnpm smoke:handoff
```

See also [adapters.md](./adapters.md) · [plugins.md](./plugins.md) · [event-schema.md](./event-schema.md) (`session.handoff`) · [README](../README.md).
