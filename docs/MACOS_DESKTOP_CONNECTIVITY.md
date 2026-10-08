# Mira macOS Desktop connectivity — verification of v0.1.0 vs local v0.2.0

Publicly distributed **v0.1.0** DMG uses `frontendDist: https://miraai-five.vercel.app`; the bundled app does not include the local SQLite Rust commands shipped in v0.2.0 source. Updates to the website do not add native functions to an already-installed DMG.

The local-frontend Tauri build bundles `../dist` and native SQLite. The Desktop bridge accepts either `window.__TAURI__.core.invoke` or `window.__TAURI_INTERNALS__.invoke`. A failed count/clear must surface an error instead of showing 0 or reporting a successful wipe.

The Brain gateway needs a server-side `GEMINI_API_KEY` or `OPENAI_API_KEY` + `OPENAI_MODEL` or `ANTHROPIC_API_KEY` + `ANTHROPIC_MODEL`. ElevenLabs config only supplies voice, not the Brain model.

`GET /api/brain-health` is a read-only, no-store **configuration-only** check and never claims provider inference was tested. Cloud memory additionally requires `DATABASE_URL`. Local Desktop SQLite does not.

Do not delete application data or auto-claim legacy cloud memories; export a backup first, and install only signed/notarized releases that pass device gates.

## Local structured profile and import reliability
SQLite facts/preferences/life events/active threads are now visible and editable in Desktop profile settings. Camera-derived emotional observations remain separate. Desktop Capsule imports propagate native errors; a partial failure cannot be silently reported as success. Data are never deleted or auto-migrated by these changes.
