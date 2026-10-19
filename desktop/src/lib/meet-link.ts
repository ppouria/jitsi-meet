export type MeetLinkError = "empty" | "invalid" | "scheme" | "credentials";

export type NormalizeResult =
  | { ok: true; url: string }
  | { ok: false; reason: MeetLinkError };

const SUPPORTED_PROTOCOLS = new Set(["http:", "https:"]);
const SCHEME_PATTERN = /^[a-z][a-z0-9+.-]*:/i;

/**
 * Normalizes user input into an absolute http(s) meeting URL.
 *
 * Input without a scheme is treated as https, so "meet.jit.si/room" becomes
 * "https://meet.jit.si/room".
 */
export function normalizeMeetLink(rawValue: string): NormalizeResult {
  let value = rawValue.trim();

  if (!value) {
    return { ok: false, reason: "empty" };
  }

  if (!SCHEME_PATTERN.test(value)) {
    value = `https://${value}`;
  }

  let url: URL;

  try {
    url = new URL(value);
  } catch {
    return { ok: false, reason: "invalid" };
  }

  if (!SUPPORTED_PROTOCOLS.has(url.protocol)) {
    return { ok: false, reason: "scheme" };
  }

  if (!url.hostname) {
    return { ok: false, reason: "invalid" };
  }

  if (url.username || url.password) {
    return { ok: false, reason: "credentials" };
  }

  return { ok: true, url: url.href };
}

export function describeMeetLink(href: string): { host: string; path: string } {
  try {
    const url = new URL(href);
    const rawPath = url.pathname === "/" ? "" : url.pathname;
    let path = rawPath;

    try {
      path = decodeURIComponent(rawPath);
    } catch {
      // Keep the encoded path when it contains invalid escape sequences.
    }

    return { host: url.host, path };
  } catch {
    return { host: href, path: "" };
  }
}
