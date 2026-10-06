# Mira TTS on Neon Functions

Neon Functions is an optional deployment target for the same ElevenLabs-only voice boundary used by Mira.

## Function

Configured in `neon.ts`:

```text
functions/miratts/index.mjs
```

Endpoints:

- `GET /health`
- `GET /voices`
- `POST /tts`

The function keeps `ELEVENLABS_API_KEY` server-side, enforces origin checks, bounded input, an upstream timeout and bounded in-memory rate-limit state.

## Environment

```env
ELEVENLABS_API_KEY=
MIRA_TTS_ALLOWED_ORIGIN=https://minhduchd-mds.github.io
ELEVENLABS_TTS_MODEL=eleven_multilingual_v2
ELEVENLABS_TTS_VOICE=EXAVITQu4vr4xnSDxMaL
```

GitHub Pages receives only the public gateway URL through `VITE_MIRA_TTS_URL`.

## Failure behavior

Mira does **not** silently switch to a different TTS provider.

1. Gateway health is probed.
2. Repeated failures open a bounded circuit-breaker cooldown.
3. Voice status reports the gateway as unhealthy/recovering.
4. Mira retries the neural gateway after the recovery window.

This keeps voice identity deterministic and avoids hidden browser/provider fallbacks.

## Deploy

`.github/workflows/neon-deploy.yml` deploys `neon.ts` using Node 24 and the configured `NEON_PROJECT_ID`.

Required GitHub configuration:

```env
NEON_API_KEY=
NEON_PROJECT_ID=
ELEVENLABS_API_KEY=
```

## Security boundary

Do not expose provider secrets through `VITE_*`, localStorage or client-side source. Do not log speech content/API keys and do not widen production CORS without an explicit deployment requirement.
