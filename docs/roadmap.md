# Roadmap

Milestone overview for Vivarium / 活体台. Scope is intentionally incremental; each milestone should ship a demoable vertical slice.

| Milestone | Focus | Deliverables |
|-----------|--------|--------------|
| **M0** | Skeleton | Monorepo, schema, SDK stub, API stub, web shell, docs, example adapter + plugin ✅ |
| **M1** | Persistence | SQLite storage, query APIs, smoke tests, [D1 mapping doc](./storage.md) ✅ |
| **M2** | Live cards | WebSocket or SSE; running state, current step, log tail; plugin theme loader |
| **M3** | Transcript replay | Turn timeline, tool call chips, search; emoji plugin resolution |
| **M4** | Handoff | Server-side transcript_ref, export/import package, CLI to resume on second harness |
| **M5** | Adapters | First-party hooks: Claude Code, Cursor/Grok Bot sketch, Paseo community adapter template |
| **M6** | Hardening | Auth (OIDC/API keys), multi-tenant, retention policies, signed plugins |

## Non-goals (for now)

- Replacing harness orchestration or model routing
- Storing raw secrets or full filesystem snapshots
- Hosted SaaS (self-host first; optional managed offering is out of scope until M6+)

## How to help

Pick a milestone issue (once filed) or propose a narrow PR against the current milestone. See [CONTRIBUTING.md](../CONTRIBUTING.md).
