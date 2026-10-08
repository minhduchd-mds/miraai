# Mira Brain Gateway

Mira production calls `/api/chat`; provider credentials stay on the server.

## Providers

- Gemini: `GEMINI_API_KEY` and optional `GEMINI_MODEL`.
- OpenAI: `OPENAI_API_KEY` + explicit `OPENAI_MODEL`.
- Anthropic: `ANTHROPIC_API_KEY` + explicit `ANTHROPIC_MODEL`.

Set `MIRA_BRAIN_PROVIDER=auto|gateway|gemini|openai|anthropic`.

Production Vercel defaults to `gateway` and an explicit `MIRA_BRAIN_FALLBACKS=openai` with
`OPENAI_MODEL=gpt-4.1-mini`. The model is configurable per deployment; API access and billing
are determined by the connected OpenAI project. Do not set `OPENAI_API_KEY` in a browser-visible
`VITE_*` variable or GitHub Secrets. It is only read in Vercel server-side functions.

Provider requests fail over only on errors; a successful Gateway response remains primary.
Failures returned to the browser or written to logs are bounded, redacted status codes.
Untrusted OpenAI responses are capped at 128 KiB; OpenAI Responses requests use `store: false`.
When a primary provider is selected, `MIRA_BRAIN_FALLBACKS` may contain a comma-separated fallback order.

Examples:

```env
MIRA_BRAIN_PROVIDER=anthropic
MIRA_BRAIN_FALLBACKS=openai,gemini
ANTHROPIC_API_KEY=...
ANTHROPIC_MODEL=<model available to your account>
OPENAI_API_KEY=...
OPENAI_MODEL=<model available to your account>
GEMINI_API_KEY=...
```

## Privacy

The OpenAI adapter sends `store: false` in Responses API calls. Mira does not use provider-side conversation state; the application owns its recent/semantic memory layer.

## Failure semantics

- Missing provider credentials/model: provider is omitted from the runnable chain.
- Provider timeout/error/empty output: continue to next configured provider; 401/429 may still
  require OpenAI billing/quota setup and will never be solved by retrying the same key.
- No provider configured: `/api/chat` returns 503 and the web client falls back to `CannedBrain`.
- All configured providers fail: `/api/chat` returns 502 with a bounded diagnostic string.

## Browser keys

Production browser builds ignore direct BYOK configuration. Direct browser Anthropic/OpenAI keys remain a Developer Labs convenience only in Vite development builds.

## Free-first mode: confirmed zero-price AI Gateway model SKUs

Set in Vercel Production (not GitHub Secrets or browser environment variables):

    MIRA_BRAIN_PROVIDER=gateway
    MIRA_BRAIN_FREE_ONLY=1
    MIRA_BRAIN_GATEWAY_FREE_MODELS=inclusionai/ling-3.1-flash-free,poolside/laguna-s-2.1-free

- Ling 3.1 Flash Free: 262K-token context; hybrid reasoning; promotion ends 2026-10-13. Its -free SKU stops rather than billing after expiry.
- Laguna S 2.1 Free: 256K-token context; thinking/coding/agent tasks; fallback when Ling is unavailable.
- Strict allowlist. Even if OPENAI_API_KEY, OPENAI_MODEL and MIRA_BRAIN_FALLBACKS=openai exist, free-only mode excludes all paid direct providers. It fails closed if both free models fail.
- Free capacity, account quota and availability are not guaranteed. These are maximum model context windows, NOT Mira's currently capped /api/chat history (40 turns and 36K characters).
- Privacy: neither free endpoint advertises Zero Data Retention; do not pass confidential company data or sensitive personal history. For that use a vetted private model/endpoint.
- Disable MIRA_BRAIN_FREE_ONLY only with explicit authorization to use paid models.
