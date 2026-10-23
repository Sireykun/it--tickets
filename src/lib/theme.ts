export const THEMES = ["light", "dark", "system"] as const;
export type Theme = (typeof THEMES)[number];
export const THEME_COOKIE = "theme";
// No cookie keeps the CIA FIRST dark palette everyone already knows.
export const DEFAULT_THEME: Theme = "dark";

export function toTheme(value: string | undefined): Theme {
  return THEMES.includes(value as Theme) ? (value as Theme) : DEFAULT_THEME;
}

// Browser-only: switch now and remember it for the server-rendered <html data-theme> on later requests.
export function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  document.cookie = `${THEME_COOKIE}=${theme}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
}
