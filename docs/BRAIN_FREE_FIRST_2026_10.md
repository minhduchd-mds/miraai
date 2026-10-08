# MiraAI Free-First Routing — October 8, 2026

Production plan: Vercel Gateway OIDC, Ling 3.1 Flash Free first, Laguna S 2.1 Free second.
Set MIRA_BRAIN_FREE_ONLY=1 and MIRA_BRAIN_GATEWAY_FREE_MODELS to an audited explicit SKU list.
A free model outage, quota expiry or promotion ending must **fail closed**, never spend on a paid provider.
Paid OpenAI keys remain configured on Vercel but are not invoked in this mode.

Context limits: Ling Free 262K tokens; Laguna Free 256K tokens; these are theoretical provider windows, not the app's 36K-character prompt cap.
Reasoning: Ling Free hybrid reasoning; Laguna Free supports thinking by default and specializes in coding/agent work.
Privacy: neither of these free provider options advertises Zero Data Retention. Do not send confidential company data or sensitive personal memory.
Source: https://vercel.com/changelog/ling-3-1-flash-is-now-available-on-ai-gateway
Source: https://vercel.com/ai-gateway/models/laguna-s-2.1-free

Runtime readiness: GET /api/brain-health lists freeOnly and the configured model IDs, without API calls or disclosing credentials.
Automated tests exercise free-only allowlists, two-model fallback, paid-credentials present but unused, and failure when free models are exhausted.
## Automatic free model discovery and rotation

When `MIRA_BRAIN_AUTO_ROUTER=1` with `MIRA_BRAIN_FREE_ONLY=1`, Mira queries the official public AI Gateway model catalog (`GET /v1/models`). Only `-free` language models with **explicit zero input/output prices**, text input/output and context ≥ 8K qualify. Other modalities and unspecified/variable pricing are excluded. Catalog cached 90 seconds; stale or missing catalog means fail closed. Preferred models remain ranking hints, not a fixed allowlist.

Each user turn tries up to three qualifying candidates, skipping short-lived cooldowns after 429/5xx/timeouts. HTTP 401/402/403 stop the current chain because they indicate credential/billing failures shared across models. The adapter never falls through to direct OpenAI/Gemini paid keys when free-only is on. Once the provider updates rates or withdraws a free SKU, a new catalog fetch removes it.

This is **model independence within Vercel Gateway**, not full cloud/provider independence. A Vercel outage still blocks cloud inference. The public catalog does not offer a contractual price lock; zero-charge eligibility is evaluated before requests and must not be described as an absolute billing guarantee. See current pricing: https://vercel.com/docs/ai-gateway/pricing.
