# Mira TTS on Neon Functions

Mira can host its ElevenLabs proxy as a Neon Function instead of Render/Vercel.

## Runtime

Source:

`functions/miratts/index.mjs`

The function is a Node.js 24 HTTP handler with:

- `GET /health`
- `GET /voices`
- `POST /tts`
- CORS restricted to `https://minhduchd-mds.github.io`
- bounded text size
- soft per-instance rate limiting
- ElevenLabs request timeout
- server-only API key access

## Required server environment

The function expects:

```env
ELEVENLABS_API_KEY=...
MIRA_TTS_ALLOWED_ORIGIN=https://minhduchd-mds.github.io
ELEVENLABS_TTS_MODEL=eleven_multilingual_v2
ELEVENLABS_TTS_VOICE=EXAVITQu4vr4xnSDxMaL
```

Only the function runtime receives `ELEVENLABS_API_KEY`.

## Pages wiring

GitHub Pages receives only the public gateway URL:

```env
MIRA_TTS_URL=https://<neon-function-public-url>
```

The Pages workflow maps that variable to:

```env
VITE_MIRA_TTS_URL=$MIRA_TTS_URL
```

The browser never receives the ElevenLabs API key.

## Fallback behavior

On Pages:

1. Mira prefers the configured HTTPS neural gateway.
2. Two consecutive gateway failures open a 30 second circuit-breaker cooldown.
3. During cooldown, speech automatically falls back to Piper Local Neural.
4. After cooldown, Mira retries the neural gateway.
5. Piper itself falls back to Web Speech if local WASM/OPFS cannot run.

## Current deployment prerequisite

Automated Neon deployment requires a target project and credentials outside the browser:

```env
NEON_API_KEY=...
NEON_PROJECT_ID=...
ELEVENLABS_API_KEY=...
```

Once a Neon project target is available, deploy the `miratts` function to the main branch and set the resulting HTTPS function URL as GitHub Environment variable `MIRA_TTS_URL`.

## Security boundary

Do not:

- expose `ELEVENLABS_API_KEY` through any `VITE_*` variable;
- store ElevenLabs credentials in localStorage;
- call ElevenLabs directly from GitHub Pages;
- log speech text or API keys in the gateway;
- disable CORS restrictions for production.
