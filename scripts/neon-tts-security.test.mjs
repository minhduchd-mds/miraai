import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import handler from '../functions/miratts/index.mjs';

test('Neon gateway rejects cross-site no-Origin calls and spoofed client claims', async () => {
  const response = await handler.fetch(new Request('https://voice.example/tts', {
    method: 'POST',
    headers: { 'sec-fetch-site': 'cross-site', 'x-forwarded-for': '198.51.100.88' },
    body: '{}',
  }));
  assert.equal(response.status, 403);
  const source = readFileSync('functions/miratts/index.mjs','utf8');
  assert.doesNotMatch(source, /request\.headers\.get\('x-forwarded-for'\)/);
});

test('Neon gateway rejects oversized JSON without contacting paid TTS provider', async () => {
  const resp = await handler.fetch(new Request('https://voice.example/tts', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ text: 'X'.repeat(17000) }),
  }));
  assert.equal(resp.status, 413);
  assert.equal((await resp.json()).error, 'payload_too_large');
});

test('Neon gateway handles malformed JSON deterministically', async () => {
  const resp = await handler.fetch(new Request('https://voice.example/tts', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: '{oops',
  }));
  assert.equal(resp.status, 400);
  assert.equal((await resp.json()).error, 'invalid_json');
});

test('Neon gateway enforces bounded upstream streaming and local client saturation', () => {
  const source = readFileSync('functions/miratts/index.mjs','utf8');
  assert.match(source, /boundedAudioResponseStream\(upstream.body\)/);
  assert.match(source, /MAX_TTS_AUDIO_BYTES = 8 \* 1024 \* 1024/);
  assert.match(source, /return buckets.size < MIRA_TTS_MAX_TRACKED_CLIENTS/);
});
