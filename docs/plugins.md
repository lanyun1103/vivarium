# Plugins (M3.6 host)

Vivarium plugins use a **DSH-style manifest + slots** model. The web console loads packs from `plugins/` (copied to `packages/web/public/plugins` on dev/build).

## Manifest

```json
{
  "id": "org.vivarium.example-skin",
  "version": "0.1.0",
  "name": "Example Pastel Skin",
  "provides": ["theme", "emoji", "avatar"],
  "slots": {
    "theme.default": "./theme.json",
    "emoji.map": "./emoji-map.json",
    "avatar.default": "./assets/avatar-default.svg"
  },
  "vivarium": ">=0.3.6"
}
```

| Field | Description |
|-------|-------------|
| `id` | Unique plugin id (reverse-DNS) |
| `version` | Semver |
| `provides` | `theme`, `emoji`, `avatar`, (future) `adapter` |
| `slots` | Slot name → path relative to manifest directory |

Validate locally: `pnpm validate`

## Semantic emoji keys

The UI **never** hardcodes PNG/SVG paths. It asks the active plugin for stable keys defined in `@vivarium/schema`:

`agent.happy`, `agent.thinking`, `agent.blocked`, `agent.idle`, `agent.running`, `agent.stalled`, `agent.success`, `status.*`, `step.*`

Your `emoji-map.json` maps each key to `./assets/...`. Missing keys fall back to Unicode glyphs (fail-soft).

## Web plugin host

1. Picker loads catalog entry (`packages/web/src/plugins/host.ts`).
2. Fetches `manifest.json`, theme slot, emoji map (optional avatar slot).
3. Applies CSS variables via `applyThemeVariables`.
4. `SemanticIcon` resolves `agent.running` → plugin asset URL.

**ZIP packs:** not loaded in M3.6 — unzip into `plugins/your-pack/` with the same layout as `example-skin`. Registry/signatures planned later.

## Add a new pack

1. Copy `plugins/example-skin/` → `plugins/my-skin/`.
2. Edit `manifest.json` (`id`, `name`, `slots`).
3. Tune `theme.json` colors + replace SVGs under `assets/`.
4. Map all recommended keys in `emoji-map.json`.
5. Register in `PLUGIN_CATALOG` inside `packages/web/src/plugins/host.ts`.
6. Run `pnpm validate` and `pnpm dev:web` (runs `sync-plugins`).

Shipped examples:

| Pack | Id | Look |
|------|-----|------|
| Default | `builtin:default` | Built-in pastel CSS (no assets) |
| Example Pastel | `org.vivarium.example-skin` | Purple tint + SVG expressions |
| Mint Pop | `org.vivarium.mint-skin` | Green tint + SVG expressions |

## Lifecycle (future)

Unload/revert on switch is handled by reloading the previous theme and clearing emoji URLs. Full plugin host runtime (adapters, signed ZIP) is out of scope for M3.6.

## Security

Load **local/trusted** packs only. Do not fetch remote plugins without verification.
