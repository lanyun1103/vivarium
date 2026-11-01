# Roadmap

Milestone overview for Vivarium / 活体台. Scope is intentionally incremental; each milestone should ship a demoable vertical slice.

| Milestone | Focus | Deliverables |
|-----------|--------|--------------|
| **M0** | Skeleton | Monorepo, schema, SDK stub, API stub, web shell, docs, example adapter + plugin ✅ |
| **M1** | Persistence | SQLite storage, query APIs, smoke tests, [D1 mapping doc](./storage.md) ✅ |
| **M2** | Claude Code adapter | Installable SessionStart/End + turn hooks, dry-run, smoke, fail-soft ✅ |
| **M3** | Web console | Agent/session cards, steps + transcript replay, polling UI, theme CSS vars ✅ |
| **M3.5** | Transcript + handoff PoC | JSONL ingest (Claude Code), `POST …/handoff`, web 换马 button ✅ |
| **M3.6** | Plugin host | Local skin/emoji packs, semantic keys, web skin picker ✅ |
| **M4** | Multi-harness adapters | Grok Bot CLI ingest, Paseo snapshot mapper + dry-run ✅ |
| **M5** | OSS polish | LICENSE, README, CONTRIBUTING, SECURITY, GitHub templates ✅ |
| **M6** | Live + ops | WebSocket/SSE; OIDC; retention; optional integrations (see below). Not started. |
| **M7** | Product-line agents | First-class lines (天眼 / 公司 / 待分拣…), light router, brain skeleton, UI home by line. ✅ this slice. Real LLM calls stay behind a stub. |

## Product notes (not committed code)

- **TickTick / 滴答清单 migration:** A possible future integration for task sync has **not** been evaluated or implemented in this repository. Any decision to connect Vivarium to external task systems belongs in product planning, not M5/M6 code drops.

## Light router vs brain (M7)

Two different jobs. Do not fold them into one “smart agent”.

| | Light router | Unified model (brain) |
|--|----------------|------------------------|
| When | Once, at `session.start` (and again only if the session is not locked) | While a product line is alive |
| Input | cwd / repo, `#tags`, task keywords, optional one-shot light model | Sessions already on a line |
| Output | `agent_id` + confidence. Below threshold → **inbox / 待分拣**. Never a blind assign. | Plain-language progress, plus suggestions: `reassign`, `nudge`, `summary`, `handoff` |
| Does not | Track progress or write nudge copy | Replace the coding model inside a harness, or send mail / chat / tool calls |

**In scope:** product-line Agent records, routing into those lines, and a brain that can describe a line and propose the next human action.

**Still out of scope:** harness-internal tool orchestration (which tool the coding model calls, in what order). Adapters stay reporting-only. Classification is the router. Progress and per-line custom copy are the brain.

Per-line behavior is a small policy object (`summary_style`, `nudge_copy`, `aliases`, `cwd_hints`) stored on the agent. Tianyan and company already differ. A later plugin slot can override the same shape.

## Non-goals (for now)

- Replacing the coding model inside a harness, or orchestrating that harness’s tools
- Letting the light router track progress, or letting the brain execute external sends
- Storing raw secrets or full filesystem snapshots
- Hosted SaaS (self-host first; optional managed offering is out of scope until M6+)

## How to help

Pick a milestone issue or propose a narrow PR against `main`. See [CONTRIBUTING.md](../CONTRIBUTING.md).

## Related docs

- [Adapters](./adapters.md) · [Plugins](./plugins.md) · [Handoff](./handoff.md) · [Architecture](./architecture.md)
