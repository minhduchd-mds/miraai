import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveMemoryScope, MEMORY_SESSION_POLICY } from '../lib/memory-scope.js';
import { readFileSync } from 'node:fs';

function res() {
  return { cookies: [], setHeader(k,v) { if (k.toLowerCase() === 'set-cookie') this.cookies.push(v); } };
}
function req(cookies = '', query = {}) {
  return { headers: { cookie: cookies }, query };
}
test('signed scope is independent of attacker-controlled legacy device and unsigned cookie', () => {
  const before = process.env.MIRA_MEMORY_SESSION_KEY;
  const oldVercel = process.env.VERCEL;
  try {
    process.env.MIRA_MEMORY_SESSION_KEY = 'testing_'.repeat(10);
    process.env.VERCEL = '1';
    const response = res();
    const scope = resolveMemoryScope(req('mira_scope=knownvictim'), response, 'knownvictim');
    assert.match(scope, /^m2_[A-Za-z0-9_-]{32}$/);
    assert.notEqual(scope, 'knownvictim');
    assert.match(response.cookies[0], /^__Host-mira_session=/);
    assert.match(response.cookies[0], /HttpOnly; SameSite=Strict; Max-Age=/);
    assert.match(response.cookies[0], /; Secure$/);
    const pair = response.cookies[0].split(';')[0];
    const valid = res();
    assert.equal(resolveMemoryScope(req(pair + '; mira_scope=knownvictim'), valid, 'anothervictim'), scope);
    assert.equal(valid.cookies.length, 0);
    const forged = res();
    const signed = pair.replace(/.$/, x => x === 'a' ? 'b' : 'a');
    assert.notEqual(resolveMemoryScope(req(signed), forged, scope), scope);
    assert.equal(forged.cookies.length, 1);
    const oldUnsigned = res();
    assert.notEqual(resolveMemoryScope(req('mira_scope=' + scope), oldUnsigned, scope), scope);
    assert.equal(MEMORY_SESSION_POLICY.legacyCookie, 'mira_scope');
  } finally {
    if (before === undefined) delete process.env.MIRA_MEMORY_SESSION_KEY;
    else process.env.MIRA_MEMORY_SESSION_KEY = before;
    if (oldVercel === undefined) delete process.env.VERCEL;
    else process.env.VERCEL = oldVercel;
  }
});
test('scope does not work when signing configuration is absent', () => {
  const old = process.env.MIRA_MEMORY_SESSION_KEY;
  try {
    delete process.env.MIRA_MEMORY_SESSION_KEY;
    const response = res();
    assert.equal(resolveMemoryScope(req('mira_scope=knownvictim'),response,'knownvictim'),null);
    assert.equal(response.cookies.length,0);
  } finally {
    if (old === undefined) delete process.env.MIRA_MEMORY_SESSION_KEY;
    else process.env.MIRA_MEMORY_SESSION_KEY = old;
  }
});
test('cloud memory routes fail closed without a signing key', () => {
  for (const name of ['history','memory','facts','profile','identity-capsule']) {
    assert.match(readFileSync('api/'+name+'.js','utf8'), /if \(!device\) return res.status\(503\)/);
  }
  const sources = [
    'src/core/history-store.ts',
    'src/intelligence/memory/profile-client.ts',
    'src/intelligence/identity/capsule-client.ts',
  ];
  for (const path of sources) {
    assert.doesNotMatch(readFileSync(path,'utf8'), /device:\s*legacyDeviceId\(\)/);
  }
});
