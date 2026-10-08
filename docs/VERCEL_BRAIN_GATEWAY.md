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
