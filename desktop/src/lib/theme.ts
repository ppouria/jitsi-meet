export type Theme = "light" | "dark";

const THEME_KEY = "jitsi-meet-desktop.theme";

export function detectTheme(): Theme {
  try {
    const stored = window.localStorage.getItem(THEME_KEY);

    if (stored === "light" || stored === "dark") {
      return stored;
    }
  } catch {
    // Fall through to the system preference.
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function applyTheme(theme: Theme): void {
  document.documentElement.classList.toggle("dark", theme === "dark");
}

export function saveTheme(theme: Theme): void {
  try {
    window.localStorage.setItem(THEME_KEY, theme);
  } catch {
    // Ignore storage failures.
  }
}
