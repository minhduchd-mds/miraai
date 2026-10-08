# Mira Brain via Vercel AI Gateway (OIDC)

The server router supports `gateway` using `https://ai-gateway.vercel.sh/v1/chat/completions`. Vercel injects `VERCEL_OIDC_TOKEN` in deployed functions; optional `AI_GATEWAY_API_KEY` takes precedence for non-Vercel installations. No token is sent to the UI.

## Production settings

- `MIRA_BRAIN_PROVIDER=gateway`
- `MIRA_BRAIN_GATEWAY_MODEL=google/gemini-2.5-flash-lite`
- `MIRA_BRAIN_FALLBACKS=` (optional: existing Gemini, OpenAI or Anthropic if individually configured)
- Keep `MIRA_QUOTA_HMAC_KEY`, `DATABASE_URL` in the server runtime.
- **Do not manually create or copy VERCEL_OIDC_TOKEN**; it rotates automatically.
- Requests use the Vercel team's AI Gateway credit, not ChatGPT Plus usage. Confirm credit/billing settings in Vercel. Model output consumes credits.

`GET /api/brain-health` reports only readiness by configured credentials; it does not test inference. `POST /api/chat` with one minimal private prompt is the real smoke check. This gateway only handles text Brain generation. Native macOS SQLite is independent, and semantic embeddings still need a separate embedding-provider integration.

## Vercel Functions OIDC runtime

Per Vercel OIDC runtime documentation, `VERCEL_OIDC_TOKEN` is available in builds and local development, but **Functions receive the short-lived token in `x-vercel-oidc-token`**. Mira forwards that credential per request exclusively server-side through `requestGatewayOidcToken(req)`; no shared cache, browser-visible credentials, or stored tokens. Chat, distillation, Identity Capsule snapshot and read-only Brain readiness all follow the same contract. The `VERCEL` environment marker gates reading the injected header. An explicit provider selection still controls billable calls. Models and quotas remain unchanged.
