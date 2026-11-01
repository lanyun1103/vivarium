# Contributing to Vivarium / 活体台

Thanks for helping improve Vivarium. This is a **pnpm monorepo** (Node 20+, pnpm 9+).

## Run locally

```bash
pnpm install
pnpm typecheck
pnpm build
```

Daily loop:

```bash
pnpm dev:api    # :8787 — SQLite ingest
pnpm dev:web    # :5173 — console (syncs plugins to public/)
```

Useful checks:

```bash
pnpm validate          # plugin manifests
pnpm dry-run:claude
pnpm dry-run:grok
pnpm dry-run:paseo
pnpm test
pnpm smoke:api
pnpm smoke:handoff
```

Environment variables: `VIVARIUM_URL`, `VIVARIUM_TOKEN` — see [.env.example](.env.example) and [docs/adapters.md](docs/adapters.md).

## Pull requests

1. Branch from `main` (or the current milestone stack if coordinating with maintainers).
2. Keep PRs focused; update docs when behavior or contracts change.
3. Run `pnpm typecheck` before opening a PR.
4. Never commit secrets, real tokens, or private absolute paths.

## Add a plugin pack

1. Copy `plugins/example-skin/` → `plugins/your-skin/`.
2. Edit `manifest.json`, `theme.json`, `emoji-map.json` (semantic keys — see [docs/plugins.md](docs/plugins.md)).
3. Register the pack in `PLUGIN_CATALOG` (`packages/web/src/plugins/host.ts`).
4. Run `pnpm validate` and `pnpm dev:web` to preview in the **Skin** picker.

## Add an adapter

1. Add a workspace package under `adapters/your-harness/` (see `adapters/grok-bot` or `adapters/paseo`).
2. Use `@vivarium/sdk` + `@vivarium/schema`; POST to `/v1/events`.
3. Provide a `dry-run` script and README; wire `pnpm dry-run:your-harness` in root `package.json` if appropriate.
4. Document env vars in [docs/adapters.md](docs/adapters.md).

## Layout

| Path | Purpose |
|------|---------|
| `packages/schema` | Zod event + handoff + plugin types |
| `packages/sdk` | HTTP client for adapters |
| `packages/api` | SQLite ingest + query + handoff |
| `packages/web` | Console UI + plugin host |
| `adapters/` | Harness ingest |
| `plugins/` | Theme/emoji packs |

## Privacy

Adapters must redact secrets and avoid raw home-directory paths. See [SECURITY.md](SECURITY.md) and [docs/architecture.md](docs/architecture.md).

## Code of conduct

Be kind and constructive. Standard open-source community norms apply.
