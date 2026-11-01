# Claude Code adapter (M2 PoC)

Report Vivarium [`session.*`](../../docs/event-schema.md) events from [Claude Code](https://code.claude.com/docs/en/hooks) hooks into your self-hosted API (SQLite from M1).

## What you get

| Hook | Vivarium events | Notes |
|------|-----------------|-------|
| **SessionStart** | `session.start`, `session.log` | Uses hook JSON (`session_id`, `model`, `session_title`, `cwd`) |
| **SessionEnd** | `session.end` | Maps Claude `reason` → outcome |
| **UserPromptSubmit** *(optional, async)* | `session.turn` (`role: user`) | Redacted + truncated prompts |
| **Stop** *(optional, async)* | `session.turn` (`role: assistant`) | Uses `last_assistant_message` only |

Hooks **always exit 0** and **fail soft** if Vivarium is down — your Claude session must never break.

## Limitations (read before prod use)

- **Not a full transcript**: we do not parse `transcript_path` JSONL yet. You get user prompts (UserPromptSubmit) and the latest assistant snippet per turn (Stop), not tool calls or intermediate messages.
- **Stop hook skips** when `stop_hook_active` is true (continuations).
- Requires **Node + tsx** from the Vivarium repo (`pnpm install` once at repo root).
- Company laptops: use `.claude/settings.local.json` + gitignored `vivarium.env` for tokens — never commit secrets.

## One-time: Vivarium server

```bash
cd /path/to/vivarium
pnpm install
pnpm dev:api   # http://127.0.0.1:8787 — SQLite under ./data/vivarium.db
```

Optional auth: set `VIVARIUM_TOKEN` on the API and in `.claude/vivarium.env`.

## Install hooks (copy-paste)

From your **project** directory (where you run Claude Code):

```bash
/path/to/vivarium/adapters/claude-code/install.sh --project "$(pwd)"
```

This writes:

| Path | Purpose |
|------|---------|
| `.claude/vivarium.env` | `VIVARIUM_URL`, optional `VIVARIUM_TOKEN` (gitignore this file) |
| `.claude/vivarium.env.example` | Safe template to commit |
| `.claude/hooks/vivarium/*.sh` | Wrappers → Vivarium adapter scripts |
| `.claude/settings.local.json` | Merged `SessionStart`, `SessionEnd`, `UserPromptSubmit`, `Stop` hooks |

Edit `.claude/vivarium.env`:

```bash
VIVARIUM_URL=http://127.0.0.1:8787
# VIVARIUM_TOKEN=your-token-if-api-requires-it
```

Restart Claude Code in that project. Run `/hooks` inside Claude Code to confirm Vivarium hooks are listed.

### Manual settings (if you skip `install.sh`)

Use [`templates/settings.local.fragment.json`](./templates/settings.local.fragment.json). Hook commands must be executable and point at `.claude/hooks/vivarium/…` wrappers (or absolute paths to this adapter).

Official hook names: **`SessionStart`**, **`SessionEnd`**, **`UserPromptSubmit`**, **`Stop`** — there is no `SessionStop` event.

### User-wide hooks

```bash
./install.sh --project "$(pwd)" --user
```

Copy the generated hooks block into `~/.claude/settings.json`, adjusting paths to your Vivarium checkout.

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `VIVARIUM_URL` | yes | API base URL, no trailing slash |
| `VIVARIUM_TOKEN` | no | Bearer token when API enforces auth |
| `VIVARIUM_AGENT_ID` | no | Override Agent card id (default: `claude-code:<project-folder>`) |
| `VIVARIUM_MAX_TURN_CHARS` | no | Max turn body size (default `8000`) |
| `VIVARIUM_TASK` | no | Fallback task string if Claude sends no `session_title` |
| `VIVARIUM_SOFT_FAIL` | no | Default soft-fail; set `0` to surface errors in CLI tools only |

Claude Code also sets `CLAUDE_PROJECT_DIR`, `CLAUDE_ENV_FILE`, etc. See [hooks reference](https://code.claude.com/docs/en/hooks).

## Dry-run (no Claude Code)

Posts a fixture `start → turns → end` session:

```bash
export VIVARIUM_URL=http://127.0.0.1:8787
pnpm dry-run:claude
# or from repo root:
pnpm --filter @vivarium/adapter-claude-code dry-run
```

Query:

```bash
curl -s "$VIVARIUM_URL/v1/sessions" | jq
curl -s "$VIVARIUM_URL/v1/sessions/<session_id>" | jq
```

Full persistence smoke (API + SQLite + dry-run + restart):

```bash
pnpm smoke:claude
```

## Implementation notes

- Shell hooks delegate to TypeScript [`tools/hook-run.ts`](./tools/hook-run.ts) via `tsx`.
- Payloads are validated with `@vivarium/schema` before POST.
- Path redaction: `$HOME` → `~`, `/Users/*` and `/home/*` masked; common secret patterns stripped from text fields.

## Privacy

Do not log API keys in hook commands. Keep tokens in `.claude/vivarium.env` (local, gitignored). See [event schema — redaction](../../docs/event-schema.md).
