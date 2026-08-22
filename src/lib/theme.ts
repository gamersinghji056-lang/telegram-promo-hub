export type ThemeMode = "light" | "dark" | "system";

function telegramColorScheme(): "light" | "dark" | null {
  if (typeof window === "undefined") return null;
  const scheme = (window as unknown as { Telegram?: { WebApp?: { colorScheme?: string } } }).Telegram?.WebApp?.colorScheme;
  return scheme === "dark" || scheme === "light" ? scheme : null;
}

export function resolvedTheme(mode: string | null | undefined): "light" | "dark" {
  if (mode === "dark") return "dark";
  if (mode === "light") return "light";
  const telegram = telegramColorScheme();
  if (telegram) return telegram;
  if (typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches) return "dark";
  return "light";
}

export function applyThemePreference(mode: string | null | undefined) {
  if (typeof document === "undefined") return "light";
  const normalized: ThemeMode = mode === "light" || mode === "dark" || mode === "system" ? mode : "system";
  const theme = resolvedTheme(normalized);
  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
  root.classList.toggle("light", theme === "light");
  root.dataset.themePreference = normalized;
  root.dataset.theme = theme;
  try {
    localStorage.setItem("wpay-theme", normalized);
  } catch {
    // localStorage can be unavailable in restricted webviews.
  }
  return theme;
}
