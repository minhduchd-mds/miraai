# Mira Desktop · macOS DMG

Mira Desktop uses Tauri 2 and the system WebKit webview instead of bundling Chromium.

## Architecture

- Native shell: Tauri 2.
- Production UI/backend: https://miraai-five.vercel.app
- No provider API keys are bundled into the DMG.
- Brain, memory and ElevenLabs remain server-side on Vercel.
- macOS camera, microphone and speech-recognition usage descriptions are declared in Info.plist.
- Initial artifact targets Intel Macs through x86_64-apple-darwin.

This first desktop build intentionally uses the remote production URL so it always receives the latest Mira UI and keeps server API requests same-origin. A later offline/local build can embed the Vite dist if required.

## Build

GitHub Actions workflow:

`.github/workflows/macos-dmg.yml`

Runner:

`macos-15-intel`

Build:

`npx tauri build --bundles dmg --target x86_64-apple-darwin`

The current build is ad-hoc signed, not Apple notarized. macOS may show a first-launch Gatekeeper warning for downloaded artifacts until an Apple Developer signing identity and notarization credentials are configured.
