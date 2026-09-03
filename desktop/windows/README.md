# Mazholl Voice for Windows

A small Tauri shell for `https://voice.mazholl.com`. It uses the shared Windows
WebView2 runtime instead of shipping Electron or another Chromium copy, so the
server remains the single source of truth for all meeting features and updates.

## Build

Install the [Tauri Windows prerequisites](https://v2.tauri.app/start/prerequisites/), then run:

```powershell
npm ci
npm run tauri build
```

The NSIS installer is written to `src-tauri/target/release/bundle/nsis/`.

