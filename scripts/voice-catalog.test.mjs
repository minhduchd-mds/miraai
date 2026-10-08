import test from 'node:test';
import assert from 'node:assert/strict';
import { createVoiceCatalogLoader, readBoundedVoiceCatalogJson } from '../server/voice-catalog.mjs';

const sample = {
  voices: [
    { voice_id: 'abc12345678', name: 'Z Sarah', category: 'premade', labels: { gender: 'female' } },
    { voice_id: 'abc12345679', name: 'B Male', category: 'generated', labels: { gender: 'male' } },
    { voice_id: 'abc12345670', name: 'Hidden', category: 'professional', labels: { gender: 'female' } },
  ],
};

test('bounded catalogue accepts valid data and rejects oversized upstream response', async () => {
  const response = new Response(JSON.stringify(sample));
  assert.equal((await readBoundedVoiceCatalogJson(response)).voices.length, 3);
  await assert.rejects(
    readBoundedVoiceCatalogJson(new Response('x'.repeat(4096)), 128),
    /voice_catalog_too_large/,
  );
  await assert.rejects(
    readBoundedVoiceCatalogJson(new Response('x', { headers: { 'content-length': '500' } }), 8),
    /voice_catalog_too_large/,
  );
});

test('simultaneous callers share one upstream request; entries are sanitized and capped', async () => {
  let calls = 0;
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  const loader = createVoiceCatalogLoader({ fetcher: async () => {
    calls++;
    await gate;
    return new Response(JSON.stringify(sample));
  } });
  const first = loader('secret-1');
  const second = loader('secret-1');
  release();
  const [a,b] = await Promise.all([first, second]);
  assert.equal(calls, 1);
  assert.deepEqual(a,b);
  assert.deepEqual(a.voices.map(v => v.name), ['Z Sarah','B Male']);
  assert.equal((await loader('secret-1')).voices.length, 2);
  assert.equal(calls, 1);
});

test('expired catalog temporarily falls back to stale data when provider fails', async () => {
  let time = 10000;
  let available = true;
  const loader = createVoiceCatalogLoader({
    now: () => time,
    ttlMs: 100,
    staleMs: 1000,
    fetcher: async () => {
      if (!available) throw new Error('provider offline');
      return new Response(JSON.stringify(sample));
    },
  });
  assert.equal((await loader('k')).discovery,'default_or_owned');
  available = false;
  time = 10200;
  assert.equal((await loader('k')).discovery,'stale');
  time = 12000;
  assert.equal((await loader('k')).discovery,'unavailable');
});

test('key rotation never returns cached catalogue belonging to the old key', async () => {
  let called = 0;
  const loader = createVoiceCatalogLoader({
    fetcher: async () => {
      called++;
      if (called > 1) throw new Error('unavailable');
      return new Response(JSON.stringify(sample));
    },
  });
  assert.equal((await loader('old-key')).voices.length, 2);
  assert.equal((await loader('new-key')).voices.length, 0);
});
