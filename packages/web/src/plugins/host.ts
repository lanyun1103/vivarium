import {
  emojiMapSlot,
  parsePluginManifest,
  themeSlot,
  type PluginManifest,
  type SemanticEmojiKey,
} from "@vivarium/schema";
import { applyThemeVariables, defaultTheme, type VivariumTheme } from "../theme/skin";

export type PluginCatalogEntry = {
  id: string;
  label: string;
  /** Empty = built-in default theme (no pack). */
  baseUrl?: string;
};

export const PLUGIN_CATALOG: PluginCatalogEntry[] = [
  { id: "builtin:default", label: "Vivarium Default" },
  { id: "org.vivarium.example-skin", label: "Example Pastel", baseUrl: "/plugins/example-skin" },
  { id: "org.vivarium.mint-skin", label: "Mint Pop", baseUrl: "/plugins/mint-skin" },
];

export const PLUGIN_STORAGE_KEY = "vivarium.activePluginId";

export type LoadedPlugin = {
  catalogId: string;
  manifest: PluginManifest | null;
  baseUrl: string | null;
  theme: VivariumTheme;
  emojiUrls: Partial<Record<SemanticEmojiKey, string>>;
  avatarUrl: string | null;
};

function themeFromSlot(slot: ReturnType<typeof themeSlot.parse>): VivariumTheme {
  return {
    id: slot.id,
    colors: {
      bg: slot.colors.bg,
      card: slot.colors.card,
      accent: slot.colors.accent,
      accentSoft: slot.colors.accentSoft,
      text: slot.colors.text,
      muted: slot.colors.muted,
      ok: slot.colors.ok ?? defaultTheme.colors.ok,
      warn: slot.colors.warn ?? defaultTheme.colors.warn,
    },
    radius: {
      card: slot.radius?.card ?? defaultTheme.radius.card,
      chip: slot.radius?.chip ?? defaultTheme.radius.chip,
    },
  };
}

function resolveAsset(baseUrl: string, rel: string): string {
  const path = rel.replace(/^\.\//, "");
  return `${baseUrl.replace(/\/$/, "")}/${path}`;
}

export async function loadPluginPack(entry: PluginCatalogEntry): Promise<LoadedPlugin> {
  if (!entry.baseUrl) {
    return {
      catalogId: entry.id,
      manifest: null,
      baseUrl: null,
      theme: defaultTheme,
      emojiUrls: {},
      avatarUrl: null,
    };
  }

  const baseUrl = entry.baseUrl;
  const manifestRaw = await fetch(`${baseUrl}/manifest.json`).then((r) => {
    if (!r.ok) throw new Error(`manifest ${r.status}`);
    return r.json();
  });
  const manifest = parsePluginManifest(manifestRaw);

  const themeRel = manifest.slots["theme.default"];
  if (!themeRel) throw new Error("missing theme.default slot");
  const themeJson = await fetch(resolveAsset(baseUrl, themeRel)).then((r) => r.json());
  const theme = themeFromSlot(themeSlot.parse(themeJson));

  const emojiUrls: Partial<Record<SemanticEmojiKey, string>> = {};
  const emojiRel = manifest.slots["emoji.map"];
  if (emojiRel) {
    const mapRaw = await fetch(resolveAsset(baseUrl, emojiRel)).then((r) => r.json());
    const map = emojiMapSlot.parse(mapRaw);
    for (const [key, rel] of Object.entries(map)) {
      emojiUrls[key as SemanticEmojiKey] = resolveAsset(baseUrl, rel);
    }
  }

  let avatarUrl: string | null = null;
  const avatarRel = manifest.slots["avatar.default"];
  if (avatarRel) avatarUrl = resolveAsset(baseUrl, avatarRel);

  applyThemeVariables(theme);

  return {
    catalogId: entry.id,
    manifest,
    baseUrl,
    theme,
    emojiUrls,
    avatarUrl,
  };
}

export function applyLoadedPlugin(plugin: LoadedPlugin): void {
  applyThemeVariables(plugin.theme);
}
