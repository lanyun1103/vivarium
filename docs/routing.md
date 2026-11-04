# Product lines, light router, brain

Vivarium’s **Agent** is a product line: a named workflow that can outlive any one chat. Examples seeded in SQLite: `tianyan` (天眼), `company` (公司), `reverse` (逆向), `feishu-monitor` (飞书监控), `grok-product`, and `inbox` (待分拣).

A **session** is one harness run. It always stores a real product-line `agent_id`. Adapters keep posting the same events as before.

## What adapters send

`session.start.agent_id` is a hint.

| Hint | Result |
|------|--------|
| Exact slug of a live line (`tianyan`, or `VIVARIUM_AGENT_ID=tianyan`) | That line, confidence 0.92 |
| `harness:slug` such as `claude-code:dry-run` | Not a line. Other signals are tried; otherwise inbox |
| `#天眼`, `#company`, `#line:reverse` in `task` | That line, and this beats the hint |
| Task keywords (`飞书`, `company`, …) or a cwd segment (`~/src/company`) | That line |
| Anything under 0.6 confidence | **inbox**. The guessed line is not written onto the session |

The original hint is kept on `reported_agent_id`. The event JSON in `events.payload` is not rewritten, so old ingest clients keep working. Rows that already used a harness-scoped id are moved to inbox on the v2 migration.

`POST /v1/sessions/:id/reassign` sets the line and locks it. A later `session.start` for the same id will not move it again.

## Light router

Rules, then an optional model. The model is one shot. It does not watch the session and it does not write nudges.

```text
VIVARIUM_LIGHT_MODEL=stub
```

The stub is deterministic and offline: `llm:<slug>` at confidence 0.74, `llm:low:<slug>` at 0.35 (inbox). Put the token in `cwd` or `task`. It never overrides a `#tag`.

If both `VIVARIUM_LIGHT_MODEL_URL` and `VIVARIUM_LIGHT_MODEL_API_KEY` are set, the API POSTs `{ input, candidates }` and expects `{ agent_id, confidence, reason }`. Timeouts and non-200 responses abstain. There is no built-in call to a hosted chat model in this slice.

## Brain

`POST /v1/brain/suggest` with `{ "agent_id": "tianyan" }` or `{ "session_id": "…" }`.

```json
{
  "summary": { "text": "天眼：1 个会话进行中…", "running": 1, "ended": 0, "total": 1 },
  "suggestions": [
    { "kind": "summary", "text": "…" },
    { "kind": "nudge", "session_id": "…", "text": "…" },
    { "kind": "reassign", "target_agent_id": "company", "text": "…" },
    { "kind": "handoff", "text": "…" }
  ]
}
```

Kinds are `reassign`, `nudge`, `summary`, `handoff`. The handler does not send email, chat, or harness commands. Applying a reassign is a separate `POST …/reassign` (the web button does only that).

Copy comes from the line policy (`policy_json`): `summary_style` (`ops` | `product` | `inbox`), `nudge_copy`, `handoff_hint`, `aliases`, `cwd_hints`. Tianyan’s summary talks about steps; company’s talks about parallel product work. `PATCH /v1/agents/:id` can change the copy without a code change. New lines created from the UI get a default product policy and are picked up by `#slug` and a cwd segment of the same name.

## Out of scope

The brain is not the model that edits code inside Claude Code, Grok, or Paseo. It does not choose their tools. Adapters remain reporters.
