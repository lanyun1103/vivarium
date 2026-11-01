# Security Policy

## Supported versions

Vivarium is early-stage software. Security fixes land on the default branch (`main`). Prefer upgrading to the latest release/tag when available.

## Reporting a vulnerability

**Do not** open public GitHub issues for sensitive security reports.

1. Use [GitHub private vulnerability reporting](https://github.com/lanyun1103/vivarium/security/advisories/new) for this repository, **or**
2. Contact the repository owner through GitHub with a clear description, impact, and reproduction steps.

We will acknowledge receipt and work on a fix; disclosure timing can be coordinated with the reporter.

## Operational guidance (self-hosters)

### Tokens

- Set `VIVARIUM_TOKEN` on the API when exposed beyond localhost.
- Mirror the same value in adapter env (`VIVARIUM_TOKEN`) and web (`VITE_VIVARIUM_TOKEN`) when needed.
- Never commit tokens; use `.env` files listed in `.gitignore`.

### Events and logs

Vivarium is **not** a secret store.

- Do **not** send API keys, OAuth tokens, passwords, or private keys in `session.turn` content, tasks, or log messages.
- Adapters should redact paths (`$HOME` → `~`) and known secret patterns before POST.
- SQLite files and backups may contain conversation text — protect filesystem permissions and backups accordingly.

### Plugins

Load **trusted local** plugin packs only. Remote plugin registries and signature verification are not implemented yet.

### Network

Default dev setup binds API to localhost. If you reverse-proxy or expose the API, use TLS and authentication.

## Out of scope for this repo

Third-party harness security (Claude Code, Grok, Paseo daemons) is governed by those products’ own policies.
