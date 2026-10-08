import { generateGeminiFreeChat, geminiKeyConfigured } from './gemini-chat-free.js';
import { generateGatewayChat, gatewayIsConfigured, readGatewayJson } from './vercel-ai-gateway.js';

const VALID_PROVIDERS = new Set(['gateway', 'gemini', 'openai', 'anthropic']);

function splitProviders(value) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter((item) => VALID_PROVIDERS.has(item));
}

function configured(provider, runtimeOidcToken = '') {
  if (provider === 'gateway') return gatewayIsConfigured(process.env, runtimeOidcToken);
  if (provider === 'gemini') return geminiKeyConfigured(process.env);
  if (provider === 'openai') return !!(process.env.OPENAI_API_KEY && /^[a-z0-9][a-z0-9._-]{1,90}$/.test(String(process.env.OPENAI_MODEL || '')));
  if (provider === 'anthropic') return !!(process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_MODEL);
  return false;
}

/** Pure enough to unit-test by supplying an env-like object through process.env in CI if needed. */
export function providerOrder({ runtimeOidcToken = '' } = {}) {
  // Free-only: Gemini API Free Tier project is preferred when configured;
  // Vercel's verified $0 Gateway model SKUs remain the fallback.
  // OpenAI and Anthropic API keys are NEVER considered in this mode.
  if (String(process.env.MIRA_BRAIN_FREE_ONLY || '') === '1') {
    const geminiFirst = String(process.env.MIRA_BRAIN_PROVIDER||'').trim().toLowerCase()==='gemini';
    const preferred = geminiFirst ? ['gemini','gateway'] : ['gateway'];
    return preferred.filter(provider => configured(provider,runtimeOidcToken));
  }
  const primary = String(process.env.MIRA_BRAIN_PROVIDER || 'auto').trim().toLowerCase();
  const fallback = splitProviders(process.env.MIRA_BRAIN_FALLBACKS);
  // OIDC is injected into all Vercel functions; never bill AI Gateway by accident.
  // Activate gateway only when explicitly selected or listed as a fallback.
  const automatic = ['gemini', 'openai', 'anthropic'].filter((provider) => configured(provider, runtimeOidcToken));
  const requested = primary === 'auto' || !VALID_PROVIDERS.has(primary) ? automatic : [primary, ...fallback, ...automatic];
  return [...new Set(requested)].filter((provider) => configured(provider, runtimeOidcToken));
}

function normalizeMessages(messages) {
  return (Array.isArray(messages) ? messages : [])
    .filter((message) => message && message.text)
    .map((message) => ({
      role: message.role === 'model' || message.role === 'assistant' || message.role === 'mira' ? 'assistant' : 'user',
      text: String(message.text).slice(0, 6000),
    }));
}

function openAIText(json) {
  const output = Array.isArray(json?.output) ? json.output : [];
  const parts = [];
  for (const item of output) {
    if (item?.type !== 'message' || !Array.isArray(item.content)) continue;
    for (const content of item.content) {
      if (content?.type === 'output_text' && typeof content.text === 'string') parts.push(content.text);
    }
  }
  return parts.join('').trim();
}

async function generateOpenAI(system, messages, { maxTokens }) {
  const key = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL;
  if (!key || !model || !/^[a-z0-9][a-z0-9._-]{1,90}$/.test(model)) return null;

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${key}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model,
      instructions: String(system || '').slice(0, 12000),
      input: normalizeMessages(messages).map((message) => ({ role: message.role, content: message.text })),
      max_output_tokens: Math.max(32, Math.min(2500, Math.trunc(Number(maxTokens)) || 500)),
      store: false,
    }),
    signal: AbortSignal.timeout(25_000),
  });
  if (!response.ok) {
    await response.body?.cancel?.().catch(() => {});
    throw new Error('openai_http_' + response.status);
  }
  // Bound untrusted upstream payloads and never include provider error bodies in logs.
  const json = await readGatewayJson(response);
  const text = openAIText(json);
  if (!text) throw new Error('openai_empty_response');
  return { text, provider: 'openai', model };
}

async function generateAnthropic(system, messages, { maxTokens }) {
  const key = process.env.ANTHROPIC_API_KEY;
  const model = process.env.ANTHROPIC_MODEL;
  if (!key || !model) return null;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      system: String(system || '').slice(0, 12000),
      messages: normalizeMessages(messages).map((message) => ({ role: message.role, content: message.text })),
    }),
    signal: AbortSignal.timeout(25_000),
  });
  if (!response.ok) throw new Error(`Anthropic ${response.status}: ${(await response.text()).slice(0, 180)}`);
  const json = await response.json();
  const text = (Array.isArray(json?.content) ? json.content : [])
    .filter((part) => part?.type === 'text' && typeof part.text === 'string')
    .map((part) => part.text)
    .join('')
    .trim();
  if (!text) throw new Error('Anthropic returned empty text');
  return { text, provider: 'anthropic', model };
}

async function generateGemini(system,messages,options) {
  return generateGeminiFreeChat(system,messages,options);
}

const RUNNERS = {
  gateway: generateGatewayChat,
  gemini: generateGemini,
  openai: generateOpenAI,
  anthropic: generateAnthropic,
};

/**
 * Server-side provider router. Every provider failure is isolated; configured fallbacks are tried in order.
 * Returns null only when no provider is configured. Throws when providers are configured but all fail.
 */
export async function generateBrainChat(system, messages, { maxTokens = 500, runtimeOidcToken = '' } = {}) {
  const order = providerOrder({ runtimeOidcToken });
  if (!order.length) return null;

  const failures = [];
  // One bounded server-side deadline spans every provider fallback.
  // Browser's shortest wait is 58s; memory may already take ~4s.
  const deadlineAt = Date.now() + (process.env.MIRA_BRAIN_FREE_ONLY === '1' ? 48_000 : 53_000);
  for (const provider of order) {
    if (Date.now()+700 >= deadlineAt) break;
    try {
      const result = await RUNNERS[provider](system, messages, { maxTokens, runtimeOidcToken,deadlineAt });
      if (result?.text) return { ...result, fallbacksTried: failures.map((failure) => failure.provider) };
    } catch (error) {
      // Never propagate provider bodies or exception messages: they may include
      // credentials, user prompts or provider-specific internal metadata.
      const status = Number(String(error?.message || '').match(/(?:^|_)http_(\d{3})(?:$|\b)/)?.[1] || 0);
      const reason = status >= 400 && status <= 599 ? `http_${status}` : 'request_failed';
      failures.push({ provider, error: reason });
    }
  }

  throw new Error(
    'Mira Brain providers failed: ' + failures.map((failure) => `${failure.provider}(${failure.error})`).join(' -> '),
  );
}


function parseJsonObject(text) {
  const raw = String(text || '').trim();
  if (!raw) return null;
  const unfenced = raw.replace(/^\`\`\`(?:json)?\s*/i, '').replace(/\s*\`\`\`$/i, '').trim();
  try {
    const direct = JSON.parse(unfenced);
    return direct && typeof direct === 'object' && !Array.isArray(direct) ? direct : null;
  } catch {
    const start = unfenced.indexOf('{');
    const end = unfenced.lastIndexOf('}');
    if (start < 0 || end <= start) return null;
    try {
      const parsed = JSON.parse(unfenced.slice(start, end + 1));
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }
}

/**
 * Provider-neutral structured generation. Uses the same server-side fallback chain as normal chat,
 * so memory/identity features work with GPT, Gemini or Anthropic instead of being tied to Gemini.
 */
export async function generateBrainJson(system, input, { maxTokens = 700, runtimeOidcToken = '' } = {}) {
  const result = await generateBrainChat(
    `${String(system || '').slice(0, 10000)}
Return exactly one valid JSON object. Do not wrap it in Markdown.`,
    [{ role: 'user', text: String(input || '').slice(0, 12000) }],
    { maxTokens, runtimeOidcToken },
  );
  if (!result) return null;
  const json = parseJsonObject(result.text);
  if (!json) throw new Error(`${result.provider} returned invalid JSON`);
  return { json, provider: result.provider, model: result.model, fallbacksTried: result.fallbacksTried || [] };
}
