# Contributing to Vivarium / 活体台

Thank you for your interest in contributing!

## Development setup

Requirements: **Node.js 20+**, **pnpm 9+**.

```bash
pnpm install
pnpm typecheck
pnpm build
```

Run stubs locally:

```bash
pnpm dev:api   # ingest API on http://127.0.0.1:8787
pnpm dev:web   # placeholder UI on http://127.0.0.1:5173
```

## Project layout

- `packages/schema` — shared Zod types for events, transcripts, handoff
- `packages/sdk` — thin HTTP client for adapters and harness hooks
- `packages/api` — self-hosted ingest server (M0: in-memory stub; see docs for SQLite/D1)
- `packages/web` — React UI shell (M0: placeholder Agent card)
- `adapters/` — harness hook examples (e.g. Claude Code)
- `plugins/` — theme, emoji, avatar manifests

## Pull requests

1. Fork and create a branch from `main`.
2. Keep changes focused; update docs when behavior or contracts change.
3. Run `pnpm typecheck` before opening a PR.
4. Do **not** commit secrets, tokens, or real absolute paths from your machine.

## Privacy and telemetry

Adapters must redact secrets and avoid sending raw home-directory paths when possible. See [docs/architecture.md](./docs/architecture.md).

## Code of conduct

Be kind, constructive, and respectful. We follow standard open-source community norms.
