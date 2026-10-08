import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { requireTrustedWrite, trustedWriteOrigin } from '../lib/request-security.js';

function response() {
  const res = { code: 200, payload: null };
  res.status = (code) => { res.code = code; return res; };
  res.json = (data) => { res.payload = data; return res; };
  return res;
}

test('foreign Origin and cross-site Fetch Metadata cannot mutate private memory', () => {
  for (const method of ['POST', 'PATCH', 'DELETE']) {
    const res = response();
    assert.equal(requireTrustedWrite({
      method,
      headers: { host: 'miraai-five.vercel.app', origin: 'https://attacker.example' },
    }, res), false);
    assert.equal(res.code, 403);
    assert.equal(res.payload.error, 'origin_not_allowed');
  }
  assert.equal(trustedWriteOrigin({
    method: 'POST',
    headers: { host: 'miraai-five.vercel.app', 'sec-fetch-site': 'cross-site' },
  }), false);
});

test('legitimate same-origin writes and legacy server-side clients remain compatible', () => {
  assert.equal(trustedWriteOrigin({
    method: 'PATCH',
    headers: { host: 'miraai-five.vercel.app', origin: 'https://miraai-five.vercel.app', 'sec-fetch-site': 'same-origin' },
  }), true);
  assert.equal(trustedWriteOrigin({ method: 'POST', headers: { host: 'miraai-five.vercel.app' } }), true);
  assert.equal(requireTrustedWrite({
    method: 'GET', headers: { origin: 'https://attacker.example' },
  }, response()), true);
});

test('memory endpoints enforce write guard and retain private-cache response protection', () => {
  for (const name of ['history', 'facts', 'profile', 'identity-capsule']) {
    const src = readFileSync(`api/${name}.js`, 'utf8');
    assert.match(src, /if \(!requireTrustedWrite\(req, res\)\) return;/);
    assert.match(src, /markPrivateResponse\(res\)/);
  }
});

test('delete-all memory is atomic and includes continuity capsules', () => {
  const source = readFileSync('api/profile.js', 'utf8');
  assert.match(source, /await sql\.transaction\(\[/);
  for (const table of ['chat_messages', 'user_facts', 'identity_capsules']) {
    assert.match(source, new RegExp('delete from ' + table + ' where device_id'));
  }
});
