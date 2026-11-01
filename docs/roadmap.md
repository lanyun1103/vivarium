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
| **M5** | Live + polish | WebSocket/SSE; OSS packaging docs |
| **M6** | Handoff + ops | Handoff CLI hardening; OIDC, retention; TickTick (optional) |

## Non-goals (for now)

- Replacing harness orchestration or model routing
- Storing raw secrets or full filesystem snapshots
- Hosted SaaS (self-host first; optional managed offering is out of scope until M6+)

## How to help

Pick a milestone issue (once filed) or propose a narrow PR against the current milestone. See [CONTRIBUTING.md](../CONTRIBUTING.md).
