import { readGatewayJson } from './vercel-ai-gateway.js';

// Meta Llama through GroqCloud's Free plan (no card required, Oct 2026).
// OpenAI-compatible endpoint; the key is server-only (GROQ_API_KEY) and never reaches the browser.
// A free-eligible model is NOT proof that the Groq organisation has no paid plan attached:
// keep the key in an org on the Free plan (see docs/BRAIN-GATEWAY.md).
export const GROQ_CHAT_URL = 'https://api.groq.com/openai/v1/chat/completions';
export const LLAMA_FREE_CHAT_MODELS = Object.freeze([
  'llama-3.3-70b-versatile',                    // production, best Vietnamese of the three
  'meta-llama/llama-4-scout-17b-16e-instruct',  // preview, larger token budget
  'llama-3.1-8b-instant',                       // production, highest daily request cap
]);
const KEY_NAMES = ['GROQ_API_KEY'];
const cooldowns = new Map();
const hardCooldowns = new Set();
const COOLDOWN_MS = 30_000;
const QUOTA_COOLDOWN_MS = 60_000;
const INVALID_MODEL_COOLDOWN_MS = 5 * 60_000;
const SLOW_MODEL_COOLDOWN_MS = 2 * 60_000;

export function llamaKeyConfigured(env = process.env) {
  return KEY_NAMES.some((name) => typeof env[name] === 'string' && env[name].trim().length > 0);
}

/** Allowlisted models only; MIRA_LLAMA_MODEL may reorder, never add an arbitrary (possibly paid) model. */
export function llamaChatModels(env = process.env, now = Date.now()) {
  const raw = String(env.MIRA_LLAMA_MODEL || '').trim();
  const preferred = raw && LLAMA_FREE_CHAT_MODELS.includes(raw) ? [raw] : [];
  const ordered = [...new Set([...preferred, ...LLAMA_FREE_CHAT_MODELS])];
  const ready = ordered.filter((id) => (cooldowns.get(id) || 0) <= now);
  if (ready.length) return ready;
  // Half-open: probe the model whose transient cooldown ends first instead of failing instantly.
  const probe = ordered.filter((id) => !hardCooldowns.has(id))
    .sort((a, b) => (cooldowns.get(a) || 0) - (cooldowns.get(b) || 0))[0];
  return probe ? [probe] : [];
}

/** Groq is fast; a slow attempt means congestion, so move on quickly. */
export function llamaAttemptBudgetMs(maxTokens, remaining = 12_000) {
  const limit = (Number(maxTokens) || 500) <= 500 ? 9_000 : 12_000;
  return Math.max(600, Math.min(limit, Number.isFinite(remaining) ? remaining : limit));
}

function coolDown(model, until, hard = false) {
  cooldowns.set(model, until);
  if (hard) hardCooldowns.add(model); else hardCooldowns.delete(model);
}

function retryAfterMs(response) {
  const seconds = Number(response.headers?.get?.('retry-after'));
  return Number.isFinite(seconds) && seconds > 0 ? Math.min(seconds * 1000, 10 * 60_000) : 0;
}

export async function generateLlamaFreeChat(system, messages,
  { maxTokens = 500, deadlineAt = 0 } = {},
  { env = process.env, fetcher = fetch, now = Date.now } = {}) {
  const key = KEY_NAMES.map((name) => env[name]).find((v) => typeof v === 'string' && v.trim());
  if (!key) return null;
  const chat = (Array.isArray(messages) ? messages : []).slice(-40).filter((m) => m?.text)
    .map((m) => ({
      role: ['model', 'assistant', 'mira'].includes(m.role) ? 'assistant' : 'user',
      content: String(m.text).slice(0, 6000),
    }));
  if (!chat.length) throw new Error('llama_messages_required');
  const models = llamaChatModels(env, now());
  let failureCode = models.length ? 'request_failed' : 'no_candidates';
  for (const model of models) {
    const remaining = deadlineAt ? deadlineAt - now() - 250 : 12_000;
    if (remaining < 700) break;
    try {
      const response = await fetcher(GROQ_CHAT_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model,
          messages: [
            ...(system ? [{ role: 'system', content: String(system).slice(0, 12000) }] : []),
            ...chat,
          ],
          temperature: 0.65,
          max_tokens: Math.max(256, Math.min(1500, Math.trunc(maxTokens) || 500)),
          stream: false,
        }),
        signal: AbortSignal.timeout(llamaAttemptBudgetMs(maxTokens, remaining)),
      });
      if (!response.ok) {
        await response.body?.cancel?.().catch(() => {});
        if (response.status === 401 || response.status === 403) {
          // Invalid key or blocked org is shared across every model.
          throw new Error('llama_auth_unavailable_http_' + response.status);
        }
        failureCode = response.status >= 400 && response.status <= 599 ? 'http_' + response.status : 'request_failed';
        const invalid = [400, 404, 410, 422].includes(response.status);
        const wait = response.status === 429
          ? Math.max(QUOTA_COOLDOWN_MS, retryAfterMs(response))
          : invalid ? INVALID_MODEL_COOLDOWN_MS : COOLDOWN_MS;
        coolDown(model, now() + wait, invalid);
        continue;
      }
      const json = await readGatewayJson(response);
      const text = String(json?.choices?.[0]?.message?.content || '').trim();
      if (!text) { failureCode = 'empty_response'; coolDown(model, now() + COOLDOWN_MS); continue; }
      cooldowns.delete(model); hardCooldowns.delete(model);
      return { text, provider: 'llama', model };
    } catch (error) {
      if (/^llama_auth_unavailable_http_(401|403)$/.test(String(error?.message || ''))) throw error;
      failureCode = error?.name === 'TimeoutError' || error?.name === 'AbortError' ? 'timeout'
        : error instanceof TypeError ? 'network_failure'
          : error instanceof SyntaxError || /^gateway_response_/.test(String(error?.message || ''))
            ? 'invalid_response' : failureCode;
      coolDown(model, now() + (failureCode === 'timeout' ? SLOW_MODEL_COOLDOWN_MS : COOLDOWN_MS));
    }
  }
  throw new Error('llama_free_models_unavailable_' + failureCode);
}
