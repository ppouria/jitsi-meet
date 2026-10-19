/** True on macOS, where the native menu uses the Command key. */
export const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.userAgent);
