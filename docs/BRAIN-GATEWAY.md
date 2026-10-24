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

## Direct Gemini Free Tier primary (October 2026)

When `MIRA_BRAIN_FREE_ONLY=1` and `MIRA_BRAIN_PROVIDER=gemini`, the server tries the Google Gemini Developer API first **only if a GEMINI_API_KEY exists**. Gemini has its own Free Tier; calls through Vercel AI Gateway do not consume Google API Free Tier quota. Default Gemini Free Tier-eligible models: `gemini-3.8-flash` → `gemini-3.5-flash-lite` → `gemini-2.5-flash` (`gemini-3.7-flash` is redirected to 3.8 by Google and is not tried twice; 2.5 uses `thinkingBudget: 0` instead of `thinkingLevel`). Per-attempt timeouts: short turns 12 s primary / 10 s fallbacks, medium 14 s / 12 s, long 18 s (raised 24/10/2026 after production showed `gemini(timeout)` at the old 6 s). Errors cool a model down for 30 s (timeout 2 min, 429 90 s, invalid model 5 min). If every model is cooling down after transient failures, the next turn half-open probes the model whose cooldown ends first instead of failing instantly with `no_candidates`. The whole provider chain is capped at 48 seconds. If no Gemini key exists, the router retains the existing free-only Vercel Gateway as fallback. `OPENAI_API_KEY` remains excluded in free-only mode.

**Credentials:** Add `GEMINI_API_KEY` as a Vercel Production *Sensitive* env var, never `VITE_GEMINI_API_KEY` and never a GitHub Secret. Creating a Google AI Studio Free Tier key/project is required before Gemini can run in Production. The application cannot determine whether a Google project has billing enabled from the key, so verify Free Tier status in Google AI Studio; Google may use Free Tier prompts for product improvement. No real Gemini call is possible without the user's key. After saving the key, redeploy Production.

API details: [Gemini API pricing](https://ai.google.dev/gemini-api/docs/pricing); [3.8 Flash](https://ai.google.dev/gemini-api/docs/models/gemini-3.8-flash); [thinking config](https://ai.google.dev/gemini-api/docs/thinking).

## Meta Llama free fallback via GroqCloud (24/10/2026)

Order in free-only mode: **Gemini Free Tier → Meta Llama (Groq Free plan) → free AI Gateway SKUs**. Llama is
activated only when the server env has `GROQ_API_KEY`; without it nothing changes. OpenAI/Anthropic remain excluded.

| | |
| --- | --- |
| Endpoint | `https://api.groq.com/openai/v1/chat/completions` (OpenAI-compatible), key in `Authorization` header only |
| Models (allowlist, `lib/llama-chat-free.js`) | `llama-3.3-70b-versatile` → `meta-llama/llama-4-scout-17b-16e-instruct` (preview) → `llama-3.1-8b-instant` |
| Free limits (third-party summary, June 2026 — confirm at console.groq.com/docs/rate-limits) | 30 RPM each; 1,000 RPD for 70B and Scout, 14,400 RPD for 8B; org-level, not per key |
| Budgets | 9 s per attempt for short turns, 12 s otherwise; 429 honours `retry-after` (min 60 s); invalid model 5 min; half-open probe like Gemini |
| `MIRA_LLAMA_MODEL` | Optional; may only reorder the allowlist, never add a model |
| Health | `/api/brain-health` lists `llama` in `providers` and `llamaModels` (configuration only, no inference) |

Cost safety: a free model ID does not prove the Groq organisation is unbilled. Create the key in an org on the
**Free plan with no card**; if a paid plan is ever attached there, rotate to a key from a free org.

Licence: the Llama 3.3 / Llama 4 Community Licences ask services built on them to display "Built with Llama";
Settings → Giọng & hội thoại shows it next to the provider disclosure.
