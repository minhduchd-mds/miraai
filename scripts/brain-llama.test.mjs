import test from 'node:test';
import assert from 'node:assert/strict';
import { generateLlamaFreeChat, llamaChatModels, llamaKeyConfigured, LLAMA_FREE_CHAT_MODELS, GROQ_CHAT_URL } from '../lib/llama-chat-free.js';
import { providerOrder, generateBrainChat } from '../lib/brain-gateway.js';

const keys = ['MIRA_BRAIN_FREE_ONLY', 'MIRA_BRAIN_PROVIDER', 'MIRA_BRAIN_FALLBACKS', 'MIRA_BRAIN_AUTO_ROUTER',
  'MIRA_BRAIN_GATEWAY_FREE_MODELS', 'OPENAI_API_KEY', 'OPENAI_MODEL', 'GEMINI_API_KEY', 'GOOGLE_API_KEY',
  'GOOGLE_GENERATIVE_AI_API_KEY', 'GEMINI_KEY', 'AI_GATEWAY_API_KEY', 'VERCEL_OIDC_TOKEN', 'GEMINI_MODEL',
  'ANTHROPIC_API_KEY', 'ANTHROPIC_MODEL', 'GROQ_API_KEY', 'MIRA_LLAMA_MODEL'];
async function scopedEnv(next, fn) {
  const before = Object.fromEntries(keys.map((k) => [k, process.env[k]]));
  for (const k of keys) delete process.env[k];
  Object.assign(process.env, next);
  try { return await fn(); } finally {
    for (const k of keys) if (before[k] === undefined) delete process.env[k]; else process.env[k] = before[k];
  }
}
const ok = (text) => new Response(JSON.stringify({ choices: [{ message: { role: 'assistant', content: text } }] }));
const modelOf = (init) => JSON.parse(init.body).model;

test('Llama is only an allowlisted set of free Groq models; overrides cannot add a paid model', () => {
  assert.deepEqual(LLAMA_FREE_CHAT_MODELS, ['llama-3.3-70b-versatile', 'meta-llama/llama-4-scout-17b-16e-instruct', 'llama-3.1-8b-instant']);
  assert.deepEqual(llamaChatModels({ MIRA_LLAMA_MODEL: 'some-paid-405b' }), LLAMA_FREE_CHAT_MODELS);
  assert.equal(llamaChatModels({ MIRA_LLAMA_MODEL: 'llama-3.1-8b-instant' })[0], 'llama-3.1-8b-instant');
  assert.equal(llamaKeyConfigured({}), false);
  assert.equal(llamaKeyConfigured({ GROQ_API_KEY: ' ' }), false);
});

test('free-only order: Gemini first, then Llama, then the free Gateway; never OpenAI', async () => {
  await scopedEnv({ MIRA_BRAIN_FREE_ONLY: '1', MIRA_BRAIN_PROVIDER: 'gemini', GEMINI_API_KEY: 'g', GROQ_API_KEY: 'q',
    MIRA_BRAIN_GATEWAY_FREE_MODELS: 'inclusionai/ling-3.1-flash-free',
    OPENAI_API_KEY: 'o', OPENAI_MODEL: 'gpt-4.1-mini' }, () => {
    assert.deepEqual(providerOrder({ runtimeOidcToken: 'oidc' }), ['gemini', 'llama', 'gateway']);
    assert.deepEqual(providerOrder(), ['gemini', 'llama']);
  });
  await scopedEnv({ MIRA_BRAIN_FREE_ONLY: '1', GROQ_API_KEY: 'q' }, () => {
    assert.deepEqual(providerOrder(), ['llama']);
  });
  await scopedEnv({ MIRA_BRAIN_FREE_ONLY: '1', MIRA_BRAIN_PROVIDER: 'gemini', GEMINI_API_KEY: 'g' }, () => {
    assert.deepEqual(providerOrder(), ['gemini'], 'no Groq key: Llama is skipped, nothing else changes');
  });
});

test('Groq call: OpenAI-compatible body, key only in Authorization header, system prompt first', async () => {
  const result = await generateLlamaFreeChat('Bạn là Mira.', [{ role: 'user', text: 'Chào em' }, { role: 'mira', text: 'Chào anh' }, { role: 'user', text: 'Hôm nay sao?' }],
    { maxTokens: 450, deadlineAt: Date.now() + 30_000 },
    { env: { GROQ_API_KEY: 'synthetic-groq-key' }, fetcher: async (url, init) => {
      assert.equal(url, GROQ_CHAT_URL);
      assert.ok(!String(url).includes('synthetic-groq-key'));
      assert.equal(init.headers.authorization, 'Bearer synthetic-groq-key');
      const body = JSON.parse(init.body);
      assert.equal(body.model, 'llama-3.3-70b-versatile');
      assert.deepEqual(body.messages.map((m) => m.role), ['system', 'user', 'assistant', 'user']);
      assert.equal(body.stream, false);
      assert.ok(body.max_tokens >= 256 && body.max_tokens <= 1500);
      return ok('Hôm nay em vui lắm.');
    } });
  assert.deepEqual(result, { text: 'Hôm nay em vui lắm.', provider: 'llama', model: 'llama-3.3-70b-versatile' });
});

test('rate-limited 70B falls through to the next free Llama, sequentially', async () => {
  const calls = []; let pending = 0, maxPending = 0;
  const result = await generateLlamaFreeChat('s', [{ role: 'user', text: 'hi' }], { deadlineAt: Date.now() + 1_030_000 },
    { env: { GROQ_API_KEY: 'k' }, now: () => Date.now() + 1_000_000, fetcher: async (_url, init) => {
      pending++; maxPending = Math.max(maxPending, pending);
      try {
        calls.push(modelOf(init));
        if (modelOf(init) === 'llama-3.3-70b-versatile') return new Response('quota body must not leak', { status: 429, headers: { 'retry-after': '20' } });
        return ok('Dự phòng Llama 4.');
      } finally { pending--; }
    } });
  assert.equal(maxPending, 1);
  assert.deepEqual(calls, ['llama-3.3-70b-versatile', 'meta-llama/llama-4-scout-17b-16e-instruct']);
  assert.equal(result.model, 'meta-llama/llama-4-scout-17b-16e-instruct');
  assert.ok(!JSON.stringify(result).includes('quota body'));
});

test('an invalid Groq key fails fast without exposing the provider body', async () => {
  await assert.rejects(generateLlamaFreeChat('', [{ role: 'user', text: 'hi' }], {},
    { env: { GROQ_API_KEY: 'k' }, now: () => Date.now() + 2_000_000, fetcher: async () => new Response('secret detail', { status: 401 }) }),
  (err) => err.message === 'llama_auth_unavailable_http_401');
});

test('router: when free Gemini times out, Llama answers before the Gateway is touched', async () => {
  await scopedEnv({ MIRA_BRAIN_FREE_ONLY: '1', MIRA_BRAIN_PROVIDER: 'gemini', GEMINI_API_KEY: 'g', GROQ_API_KEY: 'q' }, async () => {
    const prior = globalThis.fetch; const hosts = [];
    try {
      globalThis.fetch = async (url) => {
        const host = new URL(String(url)).host; hosts.push(host);
        if (host === 'generativelanguage.googleapis.com') return new Response('busy', { status: 503 });
        if (host === 'api.groq.com') return ok('Llama trả lời thay.');
        throw new Error('unexpected host ' + host);
      };
      const reply = await generateBrainChat('sys', [{ role: 'user', text: 'Alo' }], { maxTokens: 450, runtimeOidcToken: 'oidc' });
      assert.equal(reply.provider, 'llama');
      assert.equal(reply.text, 'Llama trả lời thay.');
      assert.deepEqual(reply.fallbacksTried, ['gemini']);
      assert.ok(!hosts.includes('ai-gateway.vercel.sh'));
      assert.ok(!hosts.includes('api.openai.com'));
    } finally { globalThis.fetch = prior; }
  });
});

// Runs last: it advances the shared module clock and leaves models cooling down.
test('when every Llama model is cooling down, the next turn still makes one half-open probe', async () => {
  let t = Date.now() + 5_000_000; const calls = [];
  const deps = { env: { GROQ_API_KEY: 'k' }, now: () => t,
    fetcher: async (_u, init) => { calls.push(modelOf(init)); return new Response('busy', { status: 503 }); } };
  await assert.rejects(generateLlamaFreeChat('s', [{ role: 'user', text: '1' }], { deadlineAt: t + 60_000 }, deps));
  assert.equal(calls.length, 3);
  t += 5_000;
  deps.fetcher = async (_u, init) => { calls.push(modelOf(init)); return ok('Đã hồi phục.'); };
  const reply = await generateLlamaFreeChat('s', [{ role: 'user', text: '2' }], { deadlineAt: t + 60_000 }, deps);
  assert.equal(reply.text, 'Đã hồi phục.');
  assert.equal(calls.length, 4);
});
