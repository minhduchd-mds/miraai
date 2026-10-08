import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('private memory and billable brain API responses never return provider internals', () => {
  for (const p of ['api/history.js','api/memory.js','api/facts.js','api/profile.js','api/identity-capsule.js']) {
    const text = readFileSync(p,'utf8');
    assert.doesNotMatch(text, /res.status\(500\)\.json\(\{ error: String\(error/);
    assert.match(text, /error: 'internal_error'/);
  }
  assert.match(readFileSync('api/chat.js','utf8'), /error: 'brain_gateway_failed'/);
  assert.match(readFileSync('api/tts.js','utf8'), /detail: 'provider_unavailable'/);
  assert.doesNotMatch(readFileSync('api/history.js','utf8'), /embErr = String\(/);
});
