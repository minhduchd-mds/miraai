#!/usr/bin/env node
/**
 * An intentionally explicit, one-request production Brain smoke check.
 * Default invocation does not spend credits. --allow-paid-call is required.
 * Fixed synthetic prompt: no user data, no stored transcripts, no secrets.
 */
const url = 'https://miraai-five.vercel.app';
const paid = process.argv.includes('--allow-paid-call');

async function fetchBounded(path, options) {
  const res = await fetch(url + path, {
    ...options,
    signal: AbortSignal.timeout(30000),
    headers: { 'cache-control': 'no-store', ...(options?.headers || {}) },
  });
  if (!res.ok) throw new Error(path + '_http_' + res.status);
  const declared = Number(res.headers.get('content-length') || 0);
  if (declared > 32000) throw new Error('response_too_large');
  const body = await res.text();
  if (body.length > 32000) throw new Error('response_too_large');
  try { return JSON.parse(body); } catch { throw new Error('invalid_json'); }
}

async function main() {
  const health = await fetchBounded('/api/brain-health');
  if (!health.configured || !Array.isArray(health.providers) ||
    !health.providers.includes('gateway')) {
    throw new Error('brain_not_configured');
  }
  console.log('Brain configuration check: PASS (gateway)');
  if (!paid) {
    console.log('Paid inference was NOT attempted. Use --allow-paid-call for exactly one synthetic request.');
    return;
  }
  const start = performance.now();
  const response = await fetchBounded('/api/chat', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      system: 'Trả lời bằng tiếng Việt, một câu ngắn. Không yêu cầu thông tin cá nhân.',
      messages: [{ role: 'user', text: 'Xin chào Mira. Hãy chào lại trong một câu.' }],
      responseLength: 'short',
    }),
  });
  const latencyMs = Math.round(performance.now() - start);
  if (response.provider !== 'gateway' || typeof response.text !== 'string' ||
      !response.text.trim() || response.text.length > 10000) {
    throw new Error('brain_inference_invalid');
  }
  // Intentionally avoid logging provider text, tokens or credentials.
  console.log('Brain real inference: PASS; provider=gateway; latencyMs=' + latencyMs);
}

main().catch(error => {
  console.error('Brain smoke: FAILED (' + String(error?.message || error).replace(/[^a-zA-Z0-9_-]/g,'_').slice(0,70) + ')');
  process.exitCode = 1;
});
