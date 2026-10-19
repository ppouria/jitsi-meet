const RECENT_KEY = "jitsi-meet-desktop.recent";
const MAX_RECENT = 5;

export function loadRecent(): string[] {
  try {
    const raw = window.localStorage.getItem(RECENT_KEY);

    if (!raw) {
      return [];
    }

    const parsed: unknown = JSON.parse(raw);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter((item): item is string => typeof item === "string").slice(0, MAX_RECENT);
  } catch {
    return [];
  }
}

function store(items: string[]): void {
  try {
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(items));
  } catch {
    // Ignore storage failures; the launcher still works.
  }
}

export function addRecent(href: string): string[] {
  const items = [href, ...loadRecent().filter(item => item !== href)].slice(0, MAX_RECENT);

  store(items);

  return items;
}

export function removeRecent(href: string): string[] {
  const items = loadRecent().filter(item => item !== href);

  store(items);

  return items;
}

export function clearRecent(): void {
  try {
    window.localStorage.removeItem(RECENT_KEY);
  } catch {
    // Ignore storage failures.
  }
}
