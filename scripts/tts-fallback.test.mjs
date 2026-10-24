// Spoken replies must survive ElevenLabs running out of credits (production 24/10:
// 401 quota_exceeded on every request → Mira silent). Free fallback: Gemini TTS → device voice.
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import {
  GEMINI_TTS_MODELS,
  geminiTtsRequestBody,
  geminiTtsSynthesize,
  pcmRateFromMime,
  wavFromPcm16,
} from '../lib/gemini-tts-free.js';
import { pickVietnameseVoice } from '../src/core/tts/browser-speech.ts';

const pcm = Buffer.alloc(9600, 1);
const audioPayload = { candidates: [{ content: { parts: [{ inlineData: { mimeType: 'audio/L16;codec=pcm;rate=24000', data: pcm.toString('base64') } }] } }] };
const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

test('WAV wrapper writes a valid 16-bit mono RIFF header around Gemini PCM', () => {
  const wav = wavFromPcm16(pcm, 24000);
  assert.equal(wav.toString('ascii', 0, 4), 'RIFF');
  assert.equal(wav.toString('ascii', 8, 12), 'WAVE');
  assert.equal(wav.readUInt16LE(22), 1);
  assert.equal(wav.readUInt32LE(24), 24000);
  assert.equal(wav.readUInt16LE(34), 16);
  assert.equal(wav.readUInt32LE(40), pcm.length);
  assert.equal(wav.length, 44 + pcm.length);
  assert.equal(pcmRateFromMime('audio/L16;codec=pcm;rate=16000'), 16000);
  assert.equal(pcmRateFromMime(''), 24000);
});

test('Gemini TTS uses only free-tier TTS models and asks for audio with a female voice', () => {
  assert.deepEqual([...GEMINI_TTS_MODELS], ['gemini-3.8-flash-tts', 'gemini-3.8-flash-lite-tts']);
  const body = geminiTtsRequestBody('Chào anh', 'Aoede');
  assert.deepEqual(body.generationConfig.responseModalities, ['AUDIO']);
  assert.equal(body.generationConfig.speechConfig.voiceConfig.prebuiltVoiceConfig.voiceName, 'Aoede');
  assert.match(body.contents[0].parts[0].text, /Chào anh$/);
});

test('Gemini TTS falls through to the lighter model on 429 and never sends the key elsewhere', async () => {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, key: init.headers['x-goog-api-key'] });
    return calls.length === 1 ? json(429, { error: { message: 'quota' } }) : json(200, audioPayload);
  };
  const out = await geminiTtsSynthesize('Chào anh', { env: { GEMINI_API_KEY: 'k1' }, fetchImpl });
  assert.equal(out.model, 'gemini-3.8-flash-lite-tts');
  assert.equal(out.contentType, 'audio/wav');
  assert.equal(out.audio.toString('ascii', 0, 4), 'RIFF');
  assert.ok(calls.every((c) => c.url.startsWith('https://generativelanguage.googleapis.com/') && c.key === 'k1'));
  await assert.rejects(geminiTtsSynthesize('x', { env: {}, fetchImpl }), /gemini_tts_not_configured/);
});

function fakeRes() {
  const res = { statusCode: 0, headers: {}, body: null, headersSent: false, on() {},
    setHeader(k, v) { this.headers[k.toLowerCase()] = v; }, status(c) { this.statusCode = c; return this; },
    send(b) { this.body = b; this.headersSent = true; return this; }, json(b) { this.body = b; this.headersSent = true; return this; }, end() { return this; } };
  return res;
}

test('/api/tts answers with the free Gemini voice when ElevenLabs is out of credits, then skips ElevenLabs', async () => {
  const saved = { fetch: globalThis.fetch, env: { ...process.env } };
  process.env.ELEVENLABS_API_KEY = 'el-test';
  process.env.GEMINI_API_KEY = 'gm-test';
  delete process.env.DATABASE_URL; delete process.env.POSTGRES_URL; delete process.env.MIRA_AI_QUOTA_MODE;
  const hosts = [];
  globalThis.fetch = async (url) => {
    const host = new URL(String(url)).host;
    hosts.push(host);
    if (host === 'api.elevenlabs.io') return json(401, { detail: { code: 'quota_exceeded' } });
    return json(200, audioPayload);
  };
  try {
    const { default: handler } = await import('../api/tts.js');
    const req = () => ({ method: 'POST', url: '/api/tts?stream=1', body: { text: 'Chào anh' },
      headers: { origin: 'https://miraai-five.vercel.app', host: 'miraai-five.vercel.app', 'x-vercel-forwarded-for': '203.0.113.9' }, socket: {} });
    const first = fakeRes();
    await handler(req(), first);
    assert.equal(first.statusCode, 200);
    assert.equal(first.headers['x-mira-tts-provider'], 'gemini');
    assert.equal(first.headers['content-type'], 'audio/wav');
    assert.deepEqual(hosts, ['api.elevenlabs.io', 'generativelanguage.googleapis.com']);
    hosts.length = 0;
    const second = fakeRes();
    await handler(req(), second);
    assert.equal(second.statusCode, 200);
    assert.deepEqual(hosts, ['generativelanguage.googleapis.com'], 'quota failure is remembered: no wasted ElevenLabs call');
  } finally {
    globalThis.fetch = saved.fetch;
    process.env = saved.env;
  }
});

test('health reports spoken replies as configured when only the free fallback is set up', () => {
  const health = readFileSync('api/health.js', 'utf8');
  assert.match(health, /ttsContractMetadata\(configured, gemini\)/);
  assert.match(readFileSync('server/tts-contract.mjs', 'utf8'), /configured: Boolean\(configured \|\| geminiFallback\)/);
});

test('device voice fallback only uses a real Vietnamese voice, preferring female system voices', () => {
  const v = (name, lang) => ({ name, lang });
  assert.equal(pickVietnameseVoice([v('Samantha', 'en-US')]), null, 'never read Vietnamese with an English voice');
  assert.equal(pickVietnameseVoice([v('Microsoft An', 'vi-VN'), v('Linh', 'vi-VN')]).name, 'Linh');
  assert.equal(pickVietnameseVoice([v('Google Tiếng Việt', 'vi-VN')]).name, 'Google Tiếng Việt');
  const src = readFileSync('src/core/tts/server-tts.ts', 'utf8');
  assert.match(src, /this\.browser\.speak\(opts\.text/);
  assert.match(src, /if \(!started\) opts\.onError\?\.\(message\)/);
  assert.match(src, /mpeg\/i\.test\(response\.headers\?\.get\?\.\('content-type'\)/, 'WAV fallback on ?stream=1 plays buffered');
});
