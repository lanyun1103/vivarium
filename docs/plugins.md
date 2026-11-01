# Plugins

Vivarium plugins follow a **manifest + slots** model inspired by DeepSeek Harness (DSH): themes, emoji packs, Agent avatars, and (later) harness adapters are all plugins with the same loader contract.

## Manifest

```json
{
  "id": "com.example.skin",
  "version": "1.0.0",
  "name": "Example Skin",
  "provides": ["theme", "emoji"],
  "slots": {
    "theme.default": "./theme.json",
    "emoji.map": "./emoji-map.json"
  },
  "vivarium": ">=0.1.0"
}
```

| Field | Description |
|-------|-------------|
| `id` | Unique plugin id (reverse-DNS recommended) |
| `version` | Semver |
| `provides` | One or more of: `theme`, `emoji`, `avatar`, `adapter` |
| `slots` | Map of slot name → asset path relative to manifest |
| `vivarium` | Optional compatible host version range |

## Slot types

### `theme`

JSON object: colors, radii, fonts, card chrome. Web UI merges into CSS variables on load.

### `emoji`

**Stable semantic keys** → image URLs or bundled paths (like `dsh-emoji`):

```json
{
  "agent.thinking": "./assets/thinking.png",
  "agent.success": "./assets/success.png",
  "step.running": "./assets/step-run.png"
}
```

UI resolves `agent.thinking` regardless of which skin is active.

### `avatar`

Maps `agent_id` patterns or default avatar assets for Agent cards.

### `adapter` (future)

Registers harness-specific ingest shims; unload must detach hooks.

## Lifecycle

1. **load(manifest)** — validate semver and `provides`.
2. **activate** — register slot contributions.
3. **unload** — run cleanup, revert theme/emoji overrides, remove listeners.

M0 ships `plugins/example-skin` as a reference manifest only; the web host loader lands in M2.

## Security

Plugins are **local or trusted registry** only in early milestones. Do not auto-fetch remote plugins without signature verification (planned M4+).
