import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { readLimitedTtsAudio, streamLimitedTtsAudio, MAX_TTS_AUDIO_BYTES } from '../server/tts-response.mjs';
import { canonicalRequestHost } from '../lib/request-host.js';
import { originAllowed, takeRateSlot } from '../server/tts-policy.mjs';

function res(chunks, headers = {}) {
  return new Response(new ReadableStream({
    start(controller) {
      for (const x of chunks) controller.enqueue(Uint8Array.from(x));
      controller.close();
    },
  }), { headers: { 'content-type': 'audio/mpeg', ...headers } });
}

test('audio decoder accepts valid chunked MP3 within size budget', async () => {
  const { audio, contentType } = await readLimitedTtsAudio(res([[1,2],[3,4,5]]), 6);
  assert.deepEqual([...audio], [1,2,3,4,5]);
  assert.equal(contentType, 'audio/mpeg');
  assert.equal(MAX_TTS_AUDIO_BYTES, 8 * 1024 * 1024);
});

test('audio decoder rejects oversized advertised and streamed responses', async () => {
  await assert.rejects(readLimitedTtsAudio(res([[1]], { 'content-length': '9999' }), 10), /too_large/);
  await assert.rejects(readLimitedTtsAudio(res([[1,2,3],[4,5,6]]), 5), /too_large/);
  await assert.rejects(readLimitedTtsAudio(res([], {})), /empty_audio/);
});

test('audio decoder rejects provider JSON error disguised as a success', async () => {
  await assert.rejects(readLimitedTtsAudio(res([[123,125]], { 'content-type': 'application/json' })), /content_type/);
});

test('cross-site Origin cannot be authorized by a caller-supplied forwarded host', () => {
  const req = { headers: {
    host: 'miraai-five.vercel.app',
    'x-forwarded-host': 'evil.example',
    origin: 'https://evil.example',
  }};
  assert.equal(canonicalRequestHost(req), 'miraai-five.vercel.app');
  assert.equal(originAllowed(req), false);
  assert.equal(originAllowed({ headers: { host: 'miraai-five.vercel.app', 'sec-fetch-site': 'cross-site' }}), false);
  assert.equal(originAllowed({ headers: { host: 'miraai-five.vercel.app', origin: 'https://miraai-five.vercel.app' }}), true);
  assert.equal(canonicalRequestHost({ headers: { host: 'evil.example/path' }}), '');
});

test('untrusted forwarded IP cannot reset server-side voice burst limit', () => {
  const old = process.env.VERCEL;
  try {
    process.env.VERCEL = '1';
    const host = { headers: { host: 'miraai-five.vercel.app', 'x-vercel-forwarded-for': '192.0.2.231' }};
    for (let i = 0; i < 48; i++) {
      assert.equal(takeRateSlot({ ...host, headers: { ...host.headers, 'x-forwarded-for': '198.51.100.' + i }}), true);
    }
    assert.equal(takeRateSlot({ ...host, headers: { ...host.headers, 'x-forwarded-for': '203.0.113.42' }}), false);
  } finally {
    if (old === undefined) delete process.env.VERCEL;
    else process.env.VERCEL = old;
  }
});

test('Mira Vercel and Node gateways use bounded audio reader, never full-array buffer', () => {
  for (const file of ['api/tts.js', 'server/tts-gateway.mjs']) {
    const source = readFileSync(file, 'utf8');
    assert.match(source, /readLimitedTtsAudio\(response\)/);
    assert.doesNotMatch(source, /response\.arrayBuffer\(\)/);
  }
});

test('streamed audio relays valid MP3 incrementally and terminates cleanly', async()=>{
  const writes=[];let ended=false;
  const writable={write(chunk){writes.push([...chunk]);},end(){ended=true;}};
  const size=await streamLimitedTtsAudio(res([[1,2],[3,4,5]]),writable,6);
  assert.equal(size,5);
  assert.deepEqual(writes,[[1,2],[3,4,5]]);
  assert.equal(ended,true);
});
test('streamed audio rejects hostile MIME and bounded size before/after writes',async()=>{
  const writes=[];const writable={write(chunk){writes.push([...chunk]);},end(){}};
  await assert.rejects(streamLimitedTtsAudio(res([[1]],{'content-type':'application/json'}),writable,5),/content_type/);
  await assert.rejects(streamLimitedTtsAudio(res([[1]],{'content-length':'900'}),writable,5),/too_large/);
  assert.equal(writes.length,0);
  await assert.rejects(streamLimitedTtsAudio(res([[1,2,3],[4,5,6]]),writable,5),/too_large/);
  assert.deepEqual(writes,[[1,2,3]],'never relay over the limit');
});
test('progressive voice preserves ElevenLabs v4 and streaming API contract',()=>{
  const contract=readFileSync('server/tts-contract.mjs','utf8');
  const server=readFileSync('api/tts.js','utf8');
  const client=readFileSync('src/core/tts/server-tts.ts','utf8');
  assert.match(contract,/\/v1\/text-to-dialogue\/stream\?output_format=/);
  assert.match(contract,/MIRA_DEFAULT_MODEL_ID = 'eleven_v4'/);
  assert.match(server,/streamLimitedTtsAudio\(response, res\)/);
  assert.match(server,/res\.headersSent/);
  assert.match(client,/MediaSource\.isTypeSupported\('audio\/mpeg'\)/);
  assert.match(client,/speakProgressively\(opts, controller, utteranceId\)/);
  assert.match(client,/if \(!isCurrent\(\)\)/);
  assert.match(client,/controller\.signal/);
});

test('progressive decoder is deferred outside the initial UI bundle',()=>{
 const client=readFileSync('src/core/tts/server-tts.ts','utf8');
 const helper=readFileSync('src/core/tts/progressive-mp3.ts','utf8');
 assert.match(client,/await import\('\.\/progressive-mp3'\)/);
 assert.match(helper,/mediaSource\.addSourceBuffer\('audio\/mpeg'\)/);
 assert.match(helper,/sourceBuffer|buffer\.appendBuffer/);
 assert.match(helper,/signal\.aborted/);
});
