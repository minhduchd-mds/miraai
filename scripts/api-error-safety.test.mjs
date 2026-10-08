import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('private memory and billable brain API responses never return provider internals', () => {
  for (const p of ['api/history.js','api/memory.js','api/facts.js','api/profile.js','api/identity-capsule.js']) {
    const text = readFileSync(p,'utf8');
    assert.doesNotMatch(text, /res.status\(500\)\.json\(\{ error: String\(error/);
    assert.match(text, /error: 'internal_error'/);
  }
  const brain = readFileSync('api/chat.js','utf8');
  assert.match(brain, /brain_gateway_failed/);
  assert.match(brain, /free_models_unavailable/);
  assert.match(brain, /res.status\(502\).json/);
  assert.match(readFileSync('api/tts.js','utf8'), /detail: 'provider_unavailable'/);
  assert.doesNotMatch(readFileSync('api/history.js','utf8'), /embErr = String\(/);
});
