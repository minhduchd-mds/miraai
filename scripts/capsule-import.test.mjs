import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('Identity Capsule import is a single Neon HTTP transaction', () => {
  const text = readFileSync('api/identity-capsule.js','utf8');
  const from = text.indexOf("if (action === 'import')");
  const to = text.indexOf("return res.status(400).json({ error: 'action không hợp lệ' })",from);
  const code = text.slice(from,to);
  assert.match(code,/await sql\.transaction\(writes\)/);
  assert.match(code,/distinct on \(lower\(x.fact\)\)/);
  assert.match(code,/distinct on \(x.role,x.text\)/);
  assert.match(code,/on conflict \(device_id\) do update/);
  assert.match(code,/returning id/);
  assert.doesNotMatch(code,/await persistCapsule\(sql/);
  assert.match(text,/capsule_request_too_large/);
});
test('capsule import reports actual insert counts, not unverified input counts',()=>{
  const code = readFileSync('api/identity-capsule.js','utf8');
  assert.match(code,/const mergedFacts = facts.length \? results\[0\]\.length : 0/);
  assert.match(code,/const mergedMessages = history.length \? results\[facts.length \? 1 : 0\]\.length : 0/);
});
