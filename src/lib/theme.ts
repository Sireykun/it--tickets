export const THEMES = ["light", "dark", "system"] as const;
export type Theme = (typeof THEMES)[number];
export const THEME_COOKIE = "theme";
// Until someone picks Light or Dark, follow the device's setting.
export const DEFAULT_THEME: Theme = "system";

export function toTheme(value: string | null | undefined): Theme {
  return THEMES.includes(value as Theme) ? (value as Theme) : DEFAULT_THEME;
}

// Browser-only: switch now and remember it for the server-rendered <html data-theme> on later requests.
// Signed-in screens also save it to the account (saveColorModeAction) so it follows the person.
export function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  document.cookie = `${THEME_COOKIE}=${theme}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
}
