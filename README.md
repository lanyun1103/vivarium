# Vivarium / 活体台

**Harness-agnostic Agent lifecycle + chat observability.** Self-hosted. Cute UI. Plugin system inspired by DeepSeek Harness — *everything is a plugin*.

活体台 (Vivarium) watches your Agents from the outside: hooks and adapters report session metadata and full chat transcripts to a server you control. The web UI shows Agent cards — running state, current step, standard flow, historical logs, and transcript replay. **One-click handoff** packages context so the same conversation can continue on another harness (Claude Code ↔ Grok Bot ↔ Paseo, and more).

> **Status:** M3.6 — **plugin host** loads local skin/emoji packs with semantic agent icons + skin picker. See [plugins](docs/plugins.md).

## Why

| Problem | Vivarium direction |
|--------|---------------------|
| Each harness has its own logs and UI | Unified event schema + one dashboard |
| Switching tools loses context | Handoff packages with `transcript_ref` |
| Branding and delight are ad hoc | Theme, emoji, and avatar **plugins** with stable semantic keys |

## Architecture

```
adapters/ (Claude Code hooks, …)
        │  POST /v1/events
        ▼
packages/api   ──►  SQLite (VIVARIUM_DB_PATH)
        │  GET /v1/sessions, /v1/agents, /v1/sessions/:id
        ▲
packages/web   ──►  Console UI (cards, steps, transcript — polls GET APIs)
```

- **Web env** — `VITE_VIVARIUM_URL` / `VITE_VIVARIUM_TOKEN` ([packages/web/.env.example](packages/web/.env.example)); dev uses Vite proxy to `:8787`

- **Schema** — `@vivarium/schema` (Zod): `session.start`, `session.turn`, `session.step`, `session.log`, `session.heartbeat`, `session.handoff`, `session.end`
- **SDK** — `@vivarium/sdk` thin client for adapters
- **Storage** — [docs/storage.md](docs/storage.md) (D1 mapping notes)
- **Plugins** — manifest + slots (`theme`, `emoji`, `avatar`, future `adapter`); see [docs/plugins.md](docs/plugins.md)

Deep docs: [architecture](docs/architecture.md) · [event schema](docs/event-schema.md) · [plugins](docs/plugins.md) · [roadmap](docs/roadmap.md)

## Quick start

**Requirements:** Node.js 20+, [pnpm](https://pnpm.io) 9+

```bash
pnpm install
pnpm typecheck
pnpm build
pnpm smoke:api
pnpm smoke:claude   # API + adapter dry-run + restart readback
```

Terminal A — API (SQLite under `./data/vivarium.db` by default):

```bash
pnpm dev:api
# http://127.0.0.1:8787/health
```

Terminal B — web console:

```bash
pnpm dev:web
# http://127.0.0.1:5173 — polls /v1/sessions & session detail
```

Try it end-to-end:

```bash
# Terminal A: pnpm dev:api
# Terminal B: pnpm dev:web
pnpm dry-run:claude   # posts fixture session → refresh UI
pnpm smoke:handoff  # handoff package from dry-run session
```

Handoff: [docs/handoff.md](docs/handoff.md) — web **换马 / Handoff** button or `POST /v1/sessions/:id/handoff`.

### Skins / plugins (M3.6)

```bash
pnpm dev:api & pnpm dev:web   # sync-plugins runs automatically
# Top bar → Skin → "Mint Pop" or "Example Pastel"
```

Add packs under `plugins/` — see [docs/plugins.md](docs/plugins.md).

Optional: `VIVARIUM_DB_PATH`, `VIVARIUM_TOKEN` on API; matching `VITE_VIVARIUM_TOKEN` on web (see [.env.example](.env.example) and [packages/web/.env.example](packages/web/.env.example)).

### Query persisted data

```bash
curl -s http://127.0.0.1:8787/v1/sessions | jq
curl -s http://127.0.0.1:8787/v1/agents | jq
curl -s http://127.0.0.1:8787/v1/sessions/<session_id> | jq
```

### Claude Code hooks (M2)

Install into your project (copy-paste):

```bash
./adapters/claude-code/install.sh --project "$(pwd)"
# edit .claude/vivarium.env → VIVARIUM_URL (+ token if needed)
pnpm dev:api
```

Dry-run without Claude Code: `pnpm dry-run:claude`. Full doc: [adapters/claude-code/README.md](adapters/claude-code/README.md).

### Example plugin

[plugins/example-skin/manifest.json](plugins/example-skin/manifest.json) demonstrates theme + emoji slot layout.

## Privacy

Do **not** send secrets to Vivarium. Redact absolute paths where possible (`$HOME` → `~`). See [docs/event-schema.md](docs/event-schema.md).

## Contributing

[CONTRIBUTING.md](CONTRIBUTING.md) — `pnpm typecheck`, `pnpm smoke:api`, and `pnpm smoke:claude` before adapter PRs.

## License

[Apache-2.0](LICENSE)
