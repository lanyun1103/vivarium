import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { SemanticEmojiKey } from "@vivarium/schema";
import {
  applyLoadedPlugin,
  loadPluginPack,
  PLUGIN_CATALOG,
  PLUGIN_STORAGE_KEY,
  type LoadedPlugin,
} from "./host";
import { defaultTheme } from "../theme/skin";
import { FALLBACK_GLYPH } from "./semantic";

type PluginContextValue = {
  activeId: string;
  setActiveId: (id: string) => void;
  loading: boolean;
  error: string | null;
  plugin: LoadedPlugin;
  resolveEmojiUrl: (key: SemanticEmojiKey) => string | null;
  resolveEmojiGlyph: (key: SemanticEmojiKey) => string;
  avatarUrl: string | null;
};

const PluginContext = createContext<PluginContextValue | null>(null);

const emptyPlugin: LoadedPlugin = {
  catalogId: "builtin:default",
  manifest: null,
  baseUrl: null,
  theme: defaultTheme,
  emojiUrls: {},
  avatarUrl: null,
};

export function PluginProvider({ children }: { children: ReactNode }) {
  const [activeId, setActiveIdState] = useState(
    () => localStorage.getItem(PLUGIN_STORAGE_KEY) ?? "builtin:default",
  );
  const [plugin, setPlugin] = useState<LoadedPlugin>(emptyPlugin);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const activate = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    const entry = PLUGIN_CATALOG.find((p) => p.id === id) ?? PLUGIN_CATALOG[0]!;
    try {
      const loaded = await loadPluginPack(entry);
      applyLoadedPlugin(loaded);
      setPlugin(loaded);
      setActiveIdState(id);
      localStorage.setItem(PLUGIN_STORAGE_KEY, id);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      applyLoadedPlugin(emptyPlugin);
      setPlugin(emptyPlugin);
      setActiveIdState("builtin:default");
      localStorage.setItem(PLUGIN_STORAGE_KEY, "builtin:default");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const id = localStorage.getItem(PLUGIN_STORAGE_KEY) ?? "builtin:default";
    void activate(id);
  }, [activate]);

  const setActiveId = useCallback(
    (id: string) => {
      void activate(id);
    },
    [activate],
  );

  const value = useMemo<PluginContextValue>(
    () => ({
      activeId,
      setActiveId,
      loading,
      error,
      plugin,
      resolveEmojiUrl: (key) => plugin.emojiUrls[key] ?? null,
      resolveEmojiGlyph: (key) => FALLBACK_GLYPH[key] ?? "•",
      avatarUrl: plugin.avatarUrl,
    }),
    [activeId, setActiveId, loading, error, plugin],
  );

  return <PluginContext.Provider value={value}>{children}</PluginContext.Provider>;
}

export function usePlugins(): PluginContextValue {
  const ctx = useContext(PluginContext);
  if (!ctx) throw new Error("usePlugins outside PluginProvider");
  return ctx;
}
