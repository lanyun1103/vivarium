# Vivarium / 活体台

**Harness-agnostic Agent lifecycle + chat observability.** Self-hosted. Cute UI. Plugin system inspired by DeepSeek Harness — *everything is a plugin*.

活体台 (Vivarium) watches your Agents from the outside: hooks and adapters report session metadata and full chat transcripts to a server you control. The web UI shows Agent cards — running state, current step, standard flow, historical logs, and transcript replay. **One-click handoff** packages context so the same conversation can continue on another harness (Claude Code ↔ Grok Bot ↔ Paseo, and more).

> **Status:** M0 skeleton — schemas, SDK, API stub, placeholder UI, docs, and example adapter/plugin. Not a production observability stack yet; see [roadmap](docs/roadmap.md).

## Why

| Problem | Vivarium direction |
|--------|---------------------|
| Each harness has its own logs and UI | Unified event schema + one dashboard |
| Switching tools loses context | Handoff packages with `transcript_ref` |
| Branding and delight are ad hoc | Theme, emoji, and avatar **plugins** with stable semantic keys |

## Architecture (M0)

```
adapters/ (Claude Code hooks, …)
        │  POST /v1/events
        ▼
packages/api   ──►  (M1: SQLite / D1)
        ▲
packages/web   ──►  Agent cards, replay (M2+)
```

- **Schema** — `@vivarium/schema` (Zod): `session.start`, `session.turn`, `session.step`, `session.log`, `session.heartbeat`, `session.handoff`, `session.end`
- **SDK** — `@vivarium/sdk` thin client for adapters
- **Plugins** — manifest + slots (`theme`, `emoji`, `avatar`, future `adapter`); see [docs/plugins.md](docs/plugins.md)

Deep docs: [architecture](docs/architecture.md) · [event schema](docs/event-schema.md) · [plugins](docs/plugins.md) · [roadmap](docs/roadmap.md)

## Quick start

**Requirements:** Node.js 20+, [pnpm](https://pnpm.io) 9+

```bash
pnpm install
pnpm typecheck
pnpm build
```

Terminal A — API stub (in-memory):

```bash
pnpm dev:api
# http://127.0.0.1:8787/health
```

Terminal B — web shell:

```bash
pnpm dev:web
# http://127.0.0.1:5173
```

Optional auth: set `VIVARIUM_TOKEN` on the API and the same value in adapter env (see [.env.example](.env.example)).

### Claude Code hooks

See [adapters/claude-code/README.md](adapters/claude-code/README.md). Set `VIVARIUM_URL` and optionally `VIVARIUM_TOKEN`, then wire `SessionStart` / `SessionStop` to the provided shell scripts.

### Example plugin

[plugins/example-skin/manifest.json](plugins/example-skin/manifest.json) demonstrates theme + emoji slot layout.

## Privacy

Do **not** send secrets to Vivarium. Redact absolute paths where possible (`$HOME` → `~`). See [docs/event-schema.md](docs/event-schema.md).

## Contributing

[CONTRIBUTING.md](CONTRIBUTING.md) — `pnpm typecheck` before PRs.

## License

[Apache-2.0](LICENSE)
