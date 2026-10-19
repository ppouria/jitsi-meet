# Jitsi Meet Desktop

A small cross-platform desktop client for Jitsi Meet, built with Tauri 2, React,
Vite, Tailwind CSS, and shadcn/ui.

The app is not tied to any deployment. It always opens on a local launcher and
asks for a meeting link; nothing is preconfigured and there is no default server.

## Features

- Enter a meeting link for any Jitsi Meet server, public or self-hosted.
- Links are validated before opening (`http`/`https` only).
- Up to five recent links are kept on the local device and can be removed.
- Persian and English UI with RTL support, plus light and dark themes.
- **Meeting → Change Meeting Link** (`Ctrl+Shift+L`, `⌘+Shift+L` on macOS) returns
  to the launcher while a meeting is open.
- **Meeting → Reload Meeting** (`Ctrl+R`, `⌘+R` on macOS) reloads the current page.
- On Windows, WebView2 switches to a lower memory target while the window is
  unfocused and restores normal performance on focus.

## Development

Install Node.js 22+, Rust, and the
[Tauri prerequisites](https://v2.tauri.app/start/prerequisites/) for your
platform, then:

```bash
npm ci
npm run tauri dev
```

The frontend can also be run in a browser with `npm run dev`.

## Build

```bash
npm ci
npm run tauri build
```

Artifacts are written to `src-tauri/target/release/bundle/`:

- Windows: NSIS installer and MSI
- macOS: `.app` and `.dmg`
- Linux: `.deb`, `.rpm`, and `.AppImage`

Pass `--bundles` to limit the formats, for example:

```bash
npm run tauri build -- --bundles nsis
npm run tauri build -- --bundles dmg,app
npm run tauri build -- --bundles deb,appimage
```

## Project layout

| Path | Purpose |
| --- | --- |
| `src/App.tsx` | Launcher layout and state |
| `src/components/` | Join form, recent meetings, theme/language toggles |
| `src/components/ui/` | shadcn/ui primitives |
| `src/lib/` | Link validation, i18n, recent-link storage, theme helpers |
| `src-tauri/src/main.rs` | Window, native menu, WebView2 memory tuning |
| `src-tauri/tauri.conf.json` | Tauri window and bundle configuration |
| `.github/workflows/desktop.yml` | Build matrix for Windows, macOS, and Linux |

## CI

The desktop workflow builds the app on Windows, Linux, Ubuntu, and macOS (Intel
and Apple Silicon) and uploads the installers as workflow artifacts. It can be
started manually or by pushing a `desktop-v*` tag.
