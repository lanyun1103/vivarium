/** Theme tokens aligned with plugins/example-skin/theme.json for future plugin host. */
export type VivariumTheme = {
  id: string;
  colors: {
    bg: string;
    card: string;
    accent: string;
    accentSoft: string;
    text: string;
    muted: string;
    ok: string;
    warn: string;
  };
  radius: { card: string; chip: string };
};

export const defaultTheme: VivariumTheme = {
  id: "pastel",
  colors: {
    bg: "#f6f3ff",
    card: "#ffffff",
    accent: "#7c6cf6",
    accentSoft: "#ebe8ff",
    text: "#1f1633",
    muted: "#6b6280",
    ok: "#3cb371",
    warn: "#e8a838",
  },
  radius: { card: "16px", chip: "6px" },
};

export function applyThemeVariables(theme: VivariumTheme): void {
  const r = document.documentElement;
  r.style.setProperty("--v-bg", theme.colors.bg);
  r.style.setProperty("--v-card", theme.colors.card);
  r.style.setProperty("--v-accent", theme.colors.accent);
  r.style.setProperty("--v-accent-soft", theme.colors.accentSoft);
  r.style.setProperty("--v-text", theme.colors.text);
  r.style.setProperty("--v-muted", theme.colors.muted);
  r.style.setProperty("--v-ok", theme.colors.ok);
  r.style.setProperty("--v-warn", theme.colors.warn);
  r.style.setProperty("--v-radius-card", theme.radius.card);
  r.style.setProperty("--v-radius-chip", theme.radius.chip);
}
