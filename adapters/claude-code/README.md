# Claude Code adapter (M0)

Send Vivarium events from [Claude Code](https://docs.anthropic.com/en/docs/claude-code) lifecycle hooks.

## Environment

| Variable | Required | Description |
|----------|----------|-------------|
| `VIVARIUM_URL` | yes | Base URL of your Vivarium API (no trailing slash), e.g. `http://127.0.0.1:8787` |
| `VIVARIUM_TOKEN` | no | Bearer token if the API sets `VIVARIUM_TOKEN` |

Never commit real tokens. Use your shell profile or Claude Code hook env config locally.

## Hook wiring

Claude Code supports hooks such as `SessionStart` and `SessionStop`. Point them at the scripts in this folder (adjust paths to your clone).

Example `.claude/settings.json` fragment:

```json
{
  "hooks": {
    "SessionStart": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "/absolute/path/to/vivarium/adapters/claude-code/session-start.sh"
          }
        ]
      }
    ],
    "SessionStop": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "/absolute/path/to/vivarium/adapters/claude-code/session-stop.sh"
          }
        ]
      }
    ]
  }
}
```

Replace `/absolute/path/to/vivarium` with your checkout. Prefer workspace-relative task text; scripts redact `$HOME` in `cwd`.

## Scripts

- `session-start.sh` — posts `session.start` + initial `session.log`
- `session-stop.sh` — posts `session.end`
- `post-event.sh` — shared curl helper

## Manual test

```bash
export VIVARIUM_URL=http://127.0.0.1:8787
./post-event.sh '[{"type":"session.start","session_id":"test-1","agent_id":"local","harness":"claude-code","model":"unknown","cwd":"~/project","task":"hook test","host":"dev"}]'
```

Then open `GET $VIVARIUM_URL/v1/sessions` (with `Authorization: Bearer $VIVARIUM_TOKEN` if configured).

## Privacy

- Do not embed API keys in hook commands.
- Avoid posting full filesystem paths; scripts map `$HOME` to `~`.
