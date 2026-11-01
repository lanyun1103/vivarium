# Vivarium / 活体台

**Harness-agnostic Agent lifecycle + chat observability.** Self-hosted. Cute UI. Plugin system inspired by DeepSeek Harness — *everything is a plugin*.

Vivarium (活体台) collects `session.*` events from Claude Code, Grok Bot, Paseo, and other harnesses into **your** SQLite-backed API, then shows Agent cards, steps, transcript replay, and a **handoff** PoC in the web console.

> **Open source:** [Apache-2.0](LICENSE) · Docs below · Milestones tracked in [roadmap](docs/roadmap.md).  
> **Merge status:** Features land via stacked PRs (`M0`→`M5`); if you clone `main` before all PRs merge, check open PRs on [GitHub](https://github.com/lanyun1103/vivarium/pulls) for the latest adapters/plugins/handoff.

## Quick start

**Requirements:** Node.js 20+, [pnpm](https://pnpm.io) 9+

```bash
git clone https://github.com/lanyun1103/vivarium.git
cd vivarium
pnpm install
pnpm typecheck
```

**Terminal A — API** (SQLite at `./data/vivarium.db` by default):

```bash
pnpm dev:api
# http://127.0.0.1:8787/health
```

**Terminal B — web console:**

```bash
pnpm dev:web
# http://127.0.0.1:5173
```

**Seed demo sessions** (no harness install required):

```bash
pnpm dry-run:claude
pnpm dry-run:grok
pnpm dry-run:paseo
```

Optional env: `VIVARIUM_DB_PATH`, `VIVARIUM_TOKEN` ([.env.example](.env.example)); web: [packages/web/.env.example](packages/web/.env.example).

## Architecture (one line)

**Adapters** POST validated events → **API/SQLite** → **web UI** polls sessions, transcript, handoff, and plugin themes.

```
adapters/*  ──POST /v1/events──►  packages/api (SQLite)  ◄──GET──  packages/web
plugins/*   ──manifest/slots───►  CSS + semantic emoji in web
```

Details: [docs/architecture.md](docs/architecture.md) · [docs/storage.md](docs/storage.md) · [docs/event-schema.md](docs/event-schema.md)

## Documentation

| Topic | Guide |
|--------|--------|
| **Adapters** (Claude, Grok, Paseo) | [docs/adapters.md](docs/adapters.md) |
| **Plugins / skins** | [docs/plugins.md](docs/plugins.md) |
| **Handoff** (换马) | [docs/handoff.md](docs/handoff.md) |
| **Roadmap** | [docs/roadmap.md](docs/roadmap.md) |

## Why

| Problem | Vivarium direction |
|--------|---------------------|
| Each harness has its own logs and UI | Unified event schema + one dashboard |
| Switching tools loses context | [Handoff](docs/handoff.md) packages + `session.handoff` |
| Branding is ad hoc | [Plugin](docs/plugins.md) themes + semantic emoji keys |

## Adapters at a glance

| Harness | Dry-run | Doc |
|---------|---------|-----|
| Claude Code | `pnpm dry-run:claude` | [adapters/claude-code](adapters/claude-code/README.md) |
| Grok Bot | `pnpm dry-run:grok` | [adapters/grok-bot](adapters/grok-bot/README.md) |
| Paseo | `pnpm dry-run:paseo` | [adapters/paseo](adapters/paseo/README.md) |

## Plugins & handoff in the UI

- **Skins:** web top bar → **Skin** → Example Pastel / Mint Pop ([docs/plugins.md](docs/plugins.md))
- **Handoff:** open a session → **换马 / Handoff** → download JSON ([docs/handoff.md](docs/handoff.md))

## Verify / smoke

```bash
pnpm smoke:api
pnpm smoke:handoff
```

## Contributing & security

- [CONTRIBUTING.md](CONTRIBUTING.md) — local dev, new plugins, new adapters  
- [SECURITY.md](SECURITY.md) — tokens, secrets in events, reporting issues  

## Privacy

Do **not** send API keys or credentials in events. Redact paths where possible (`$HOME` → `~`). See [event schema — redaction](docs/event-schema.md).

## License

[Apache License 2.0](LICENSE) — Copyright Vivarium Contributors
