/**
 * Vercel AI Gateway — production-only server adapter.
 *
 * Vercel Functions supply OIDC in their request's x-vercel-oidc-token header;
 * build/local runtimes may use VERCEL_OIDC_TOKEN. An optional server-side
 * AI_GATEWAY_API_KEY takes precedence. Tokens never reach the browser or logs.
 * Model routing and billing are managed by the user's Vercel team.
 */
const GATEWAY_ENDPOINT = 'https://ai-gateway.vercel.sh/v1/chat/completions';
const DEFAULT_GATEWAY_MODEL = 'google/gemini-2.5-flash-lite';
const MAX_GATEWAY_JSON_BYTES = 128 * 1024;
// Verified zero-price SKUs: never trust an arbitrary user-supplied model slug.
const FREE_GATEWAY_MODELS = new Set([
  'inclusionai/ling-3.1-flash-free',
  'poolside/laguna-s-2.1-free',
]);

/**
 * Read per-request Vercel-issued OIDC only while running inside Vercel.
 * Never cache it across users, put it in global state or write it to logs.
 */
export function requestGatewayOidcToken(req, env = process.env) {
  if (!env.VERCEL) return '';
  const raw = req?.headers?.['x-vercel-oidc-token'];
  return typeof raw === 'string' && raw.length < 12000 ? raw.trim() : '';
}

export function gatewayCredentials(env = process.env, runtimeOidcToken = '') {
  const token = env.AI_GATEWAY_API_KEY || runtimeOidcToken || env.VERCEL_OIDC_TOKEN || '';
  return typeof token === 'string' ? token.trim() : '';
}

export function gatewayModel(env = process.env) {
  const model = String(env.MIRA_BRAIN_GATEWAY_MODEL || DEFAULT_GATEWAY_MODEL).trim();
  // Do not allow user-controlled URLs or unbounded model names.
  return /^[a-z][a-z0-9-]{1,35}\/[a-zA-Z0-9][a-zA-Z0-9._-]{0,90}$/.test(model)
    ? model : '';
}

export function gatewayModels(env = process.env) {
  if (String(env.MIRA_BRAIN_FREE_ONLY || '') === '1') {
    return [...new Set(String(env.MIRA_BRAIN_GATEWAY_FREE_MODELS || '')
      .split(',')
      .map((model) => model.trim())
      .filter((model) => FREE_GATEWAY_MODELS.has(model)))].slice(0, 2);
  }
  const model = gatewayModel(env);
  return model ? [model] : [];
}

export function gatewayIsConfigured(env = process.env, runtimeOidcToken = '') {
  return Boolean(gatewayCredentials(env, runtimeOidcToken) && gatewayModels(env).length);
}

/** Bound streamed JSON so a broken gateway cannot exhaust serverless memory. */
export async function readGatewayJson(response, maxBytes = MAX_GATEWAY_JSON_BYTES) {
  const declared = response.headers.get('content-length');
  if (declared != null && (!/^\d+$/.test(declared) || Number(declared) > maxBytes)) {
    throw new Error('gateway_response_too_large');
  }
  if (!response.body?.getReader) throw new Error('gateway_response_no_stream');
  const reader = response.body.getReader();
  const chunks = [];
  let bytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!(value instanceof Uint8Array)) throw new Error('gateway_response_invalid_chunk');
      bytes += value.byteLength;
      if (bytes > maxBytes) {
        await reader.cancel().catch(() => {});
        throw new Error('gateway_response_too_large');
      }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const merged = new Uint8Array(bytes);
  let offset = 0;
  for (const chunk of chunks) { merged.set(chunk, offset); offset += chunk.byteLength; }
  return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(merged));
}

export async function generateGatewayChat(system, rawMessages, { maxTokens = 500, runtimeOidcToken = '' } = {},
  { fetcher = fetch, env = process.env } = {}) {
  const token = gatewayCredentials(env, runtimeOidcToken);
  const models = gatewayModels(env);
  if (!token || !models.length) return null;
  const messages = [
    { role: 'system', content: String(system || '').slice(0, 12000) },
    ...(Array.isArray(rawMessages) ? rawMessages : []).slice(-40).map(item => ({
      role: item?.role === 'model' || item?.role === 'assistant' || item?.role === 'mira'
        ? 'assistant' : 'user',
      content: String(item?.text || '').slice(0, 6000),
    })).filter(item => item.content.trim()),
  ];
  if (messages.length < 2) throw new Error('gateway_messages_required');
  // Try the next verified-free model on failure, never a paid model.
  for (const model of models) {
    try {
      const response = await fetcher(GATEWAY_ENDPOINT, {
        method: 'POST',
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        body: JSON.stringify({
          model, messages,
          max_tokens: Math.max(32, Math.min(2500, Math.trunc(maxTokens) || 500)),
          stream: false,
        }),
        signal: AbortSignal.timeout(24_000),
      });
      if (!response.ok) {
        await response.body?.cancel?.().catch(() => {});
        throw new Error('gateway_http_' + response.status);
      }
      const payload = await readGatewayJson(response);
      const text = payload?.choices?.[0]?.message?.content;
      if (typeof text !== 'string' || !text.trim()) throw new Error('gateway_empty_response');
      return { text: text.trim(), provider: 'gateway', model };
    } catch (error) {
      if (String(env.MIRA_BRAIN_FREE_ONLY || '') !== '1') throw error;
    }
  }
  // No raw provider exception text or paid escalation on free-only exhaustion.
  throw new Error('gateway_free_models_unavailable');
}
