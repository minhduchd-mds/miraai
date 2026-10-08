import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { AI_QUOTAS, quotaClientKey, enforceAiQuota } from '../lib/ai-quota.js';
const req = { socket: { remoteAddress: '192.0.2.130' }, headers: {} };
function response() {
  const r = { statusCode: 200, body: null, headers: new Map() };
  r.setHeader = (name, value) => r.headers.set(name.toLowerCase(), value);
  r.status = (code) => { r.statusCode = code; return r; };
  r.json = (body) => { r.body = body; return r; };
  return r;
}
test('quota limits per IP and resets by window', async () => {
  const q = AI_QUOTAS.brain;
  for (let i = 0; i < q.maxPerClient; i++) {
    assert.equal(await enforceAiQuota(req, response(), 'brain', null, 900_000), true);
  }
  const denied = response();
  assert.equal(await enforceAiQuota(req, denied, 'brain', null, 900_000), false);
  assert.equal(denied.statusCode, 429);
  assert.equal(denied.body.error, 'rate_limited');
  assert.ok(Number(denied.headers.get('retry-after')) > 0);
  assert.equal(await enforceAiQuota(req, response(), 'brain', null, 1_800_000), true);
  assert.ok(!quotaClientKey(req).includes('192.0.2.130'));
});
test('durable quota failure stops billable requests instead of failing open', async () => {
  const brokenSql = () => Promise.reject(new Error('database disconnected'));
  const denied = response();
  assert.equal(await enforceAiQuota(req, denied, 'tts', brokenSql, 1000), false);
  assert.equal(denied.statusCode, 503);
  assert.equal(denied.body.error, 'quota_store_unavailable');
});
test('all provider billing paths are guarded and SQL counters are atomic', () => {
  for (const [path, lane] of [['api/chat.js','brain'], ['api/tts.js','tts'],
    ['api/facts.js','distill'], ['api/identity-capsule.js','capsule']]) {
    assert.match(readFileSync(path, 'utf8'), new RegExp("enforceAiQuota\\(req, res, '" + lane + "'"));
  }
  assert.match(readFileSync('lib/db.js','utf8'), /create table if not exists ai_quota_windows/);
  assert.match(readFileSync('lib/ai-quota.js','utf8'), /on conflict \(quota_key, lane, window_start\)/);
});

test('global quota survives a flood of distinct clients in process-local fallback', async () => {
  const now = 42_000_000;
  const lanes = [['brain', 500], ['tts', 1200], ['distill', 300], ['capsule', 10]];
  let identity = 0;
  for (const [lane, count] of lanes) {
    for (let i = 0; i < count; i++) {
      const req = { socket: { remoteAddress: '2001:db8::' + (++identity).toString(16) }, headers: {} };
      assert.equal(await enforceAiQuota(req, response(), lane, null, now), true);
    }
  }
  const denied = response();
  const req = { socket: { remoteAddress: '2001:db8::ffff' }, headers: {} };
  assert.equal(await enforceAiQuota(req, denied, 'brain', null, now), false);
  assert.equal(denied.body.error, 'global_rate_limited');
});

test('semantic memory queries are bounded before paid embeddings', () => {
  assert.match(readFileSync('api/memory.js', 'utf8'), /q.length > 1024/);
});

test('untrusted X-Forwarded-For cannot redefine a Vercel quota client', async () => {
  const old = process.env.VERCEL;
  try {
    process.env.VERCEL = '1';
    const a = { headers: { 'x-forwarded-for': '198.51.100.1' } };
    const b = { headers: { 'x-forwarded-for': '198.51.100.2' } };
    assert.equal(quotaClientKey(a), quotaClientKey(b));
    const c = { headers: { 'x-vercel-forwarded-for': '198.51.100.3' } };
    assert.notEqual(quotaClientKey(c), quotaClientKey(b));
  } finally {
    if (old === undefined) delete process.env.VERCEL;
    else process.env.VERCEL = old;
  }
});

test('quota clients beyond active local capacity fail closed rather than evicting active identities', async () => {
  const now = 99_000_000;
  let rejected = 0;
  for (let i = 0; i < 2250; i++) {
    const user = { socket: { remoteAddress: '2001:db8:5::' + i.toString(16) }, headers: {} };
    const res = response();
    const ok = await enforceAiQuota(user, res, 'capsule', null, now);
    if (!ok) {
      rejected++;
      assert.equal(res.statusCode, 429);
    }
  }
  assert.ok(rejected > 0, 'bounded limiter must reject at capacity or global cap');
});
