import { generateChat as generateGeminiChat } from './gemini.js';

const VALID_PROVIDERS = new Set(['gemini', 'openai', 'anthropic']);

function splitProviders(value) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter((item) => VALID_PROVIDERS.has(item));
}

function configured(provider) {
  if (provider === 'gemini') {
    return !!(
      process.env.GEMINI_API_KEY ||
      process.env.GOOGLE_API_KEY ||
      process.env.GOOGLE_GENERATIVE_AI_API_KEY ||
      process.env.GEMINI_KEY
    );
  }
  if (provider === 'openai') return !!(process.env.OPENAI_API_KEY && process.env.OPENAI_MODEL);
  if (provider === 'anthropic') return !!(process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_MODEL);
  return false;
}

/** Pure enough to unit-test by supplying an env-like object through process.env in CI if needed. */
export function providerOrder() {
  const primary = String(process.env.MIRA_BRAIN_PROVIDER || 'auto').trim().toLowerCase();
  const fallback = splitProviders(process.env.MIRA_BRAIN_FALLBACKS);
  const automatic = ['gemini', 'openai', 'anthropic'].filter(configured);
  const requested = primary === 'auto' || !VALID_PROVIDERS.has(primary) ? automatic : [primary, ...fallback, ...automatic];
  return [...new Set(requested)].filter((provider) => configured(provider));
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
  if (!key || !model) return null;

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
      max_output_tokens: maxTokens,
      store: false,
    }),
    signal: AbortSignal.timeout(25_000),
  });
  if (!response.ok) throw new Error(`OpenAI ${response.status}: ${(await response.text()).slice(0, 180)}`);
  const json = await response.json();
  const text = openAIText(json);
  if (!text) throw new Error('OpenAI returned empty text');
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

async function generateGemini(system, messages, options) {
  const text = await generateGeminiChat(system, messages, options);
  if (!text) return null;
  return { text, provider: 'gemini', model: process.env.GEMINI_MODEL || 'auto-flash-fallback' };
}

const RUNNERS = {
  gemini: generateGemini,
  openai: generateOpenAI,
  anthropic: generateAnthropic,
};

/**
 * Server-side provider router. Every provider failure is isolated; configured fallbacks are tried in order.
 * Returns null only when no provider is configured. Throws when providers are configured but all fail.
 */
export async function generateBrainChat(system, messages, { maxTokens = 500 } = {}) {
  const order = providerOrder();
  if (!order.length) return null;

  const failures = [];
  for (const provider of order) {
    try {
      const result = await RUNNERS[provider](system, messages, { maxTokens });
      if (result?.text) return { ...result, fallbacksTried: failures.map((failure) => failure.provider) };
    } catch (error) {
      failures.push({ provider, error: String(error?.message || error).slice(0, 180) });
    }
  }

  throw new Error(
    'Mira Brain providers failed: ' + failures.map((failure) => `${failure.provider}(${failure.error})`).join(' -> '),
  );
}
