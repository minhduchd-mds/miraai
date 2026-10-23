import test from 'node:test';
import assert from 'node:assert/strict';
import {
  LIVE_INPUT_RATE,
  appendTranscript,
  base64ToBytes,
  buildAudioMessage,
  buildSetupMessage,
  bytesToBase64,
  floatToPcm16,
  parseServerMessage,
  pcm16ToFloat,
  rateFromMime,
  resampleLinear,
} from '../src/core/live/live-protocol.ts';
import { neutralPresenceScene, resolvePresenceScene } from '../src/presence/presence-scene.ts';

test('PCM16 little-endian round trip stays within one quantization step', () => {
  const input = new Float32Array([0, 0.5, -0.5, 1, -1, 0.123]);
  const bytes = floatToPcm16(input);
  assert.equal(bytes.length, 12);
  assert.deepEqual([bytes[2], bytes[3]], [0x00, 0x40]); // 0.5 × 32767 ≈ 16384 → little-endian 00 40
  const back = pcm16ToFloat(bytes);
  for (let i = 0; i < input.length; i += 1) assert.ok(Math.abs(back[i] - input[i]) < 1 / 16000, `sample ${i}`);
});

test('clipping never wraps around', () => {
  const back = pcm16ToFloat(floatToPcm16(new Float32Array([2, -3])));
  assert.ok(back[0] > 0.99 && back[1] <= -0.99);
});

test('resampling 48 kHz → 16 kHz keeps duration', () => {
  const second = new Float32Array(48_000).map((_, i) => Math.sin(i / 10));
  const out = resampleLinear(second, 48_000, LIVE_INPUT_RATE);
  assert.equal(out.length, 16_000);
  assert.equal(resampleLinear(new Float32Array(0), 48_000, 16_000).length, 0);
});

test('base64 round trip of binary audio bytes', () => {
  const bytes = new Uint8Array(70_000).map((_, i) => (i * 37) & 0xff);
  assert.deepEqual(base64ToBytes(bytesToBase64(bytes)), bytes);
});

test('output sample rate is read from the mime type with a safe default', () => {
  assert.equal(rateFromMime('audio/pcm;rate=24000'), 24000);
  assert.equal(rateFromMime('audio/pcm'), 24000);
  assert.equal(rateFromMime('audio/pcm;rate=1'), 24000);
});

test('a single server frame yields ordered events: interrupt, transcript, audio, turnComplete', () => {
  const events = parseServerMessage(JSON.stringify({
    serverContent: {
      interrupted: true,
      inputTranscription: { text: 'Chào em' },
      modelTurn: { parts: [{ inlineData: { mimeType: 'audio/pcm;rate=24000', data: 'AAAA' } }, { text: 'ignored' }] },
      outputTranscription: { text: 'Dạ em đây' },
      turnComplete: true,
    },
    sessionResumptionUpdate: { resumable: true, newHandle: 'h-1' },
  }));
  assert.deepEqual(events.map((e) => e.kind), ['interrupted', 'inputTranscript', 'audio', 'outputTranscript', 'turnComplete', 'resumption']);
  assert.equal(events[2].rate, 24000);
});

test('setupComplete, goAway and garbage are handled without throwing', () => {
  assert.deepEqual(parseServerMessage('{"setupComplete":{}}').map((e) => e.kind), ['setupComplete']);
  assert.deepEqual(parseServerMessage({ goAway: { timeLeft: '10s' } }), [{ kind: 'goAway', timeLeft: '10s' }]);
  assert.deepEqual(parseServerMessage('not json').map((e) => e.kind), ['error']);
  assert.deepEqual(parseServerMessage({ sessionResumptionUpdate: { resumable: false, newHandle: 'x' } }), []);
});

test('setup and audio messages match the Live API wire shape', () => {
  const { setup } = buildSetupMessage('gemini-3.8-live', 'resume-1');
  assert.equal(setup.model, 'models/gemini-3.8-live');
  assert.deepEqual(setup.generationConfig.responseModalities, ['AUDIO']);
  assert.deepEqual(setup.sessionResumption, { handle: 'resume-1' });
  assert.deepEqual(buildAudioMessage('QUJD'), { realtimeInput: { audio: { data: 'QUJD', mimeType: 'audio/pcm;rate=16000' } } });
});

test('transcript fragments are joined and bounded', () => {
  assert.equal(appendTranscript('Xin ', ' chào  em'), 'Xin chào em');
  assert.equal(appendTranscript('a'.repeat(10), 'b'.repeat(10), 12).length, 12);
});

test('intimate scenes are mapped to neutral ones unless the 18+ opt-in is on', () => {
  const night = new Date(2026, 9, 23, 23, 30);
  const afternoon = new Date(2026, 9, 23, 14, 0);
  assert.equal(resolvePresenceScene({ now: night, intimateScenes: true }), 'bedtime');
  assert.equal(resolvePresenceScene({ now: night, intimateScenes: false }), 'home-evening');
  assert.equal(resolvePresenceScene({ now: afternoon, presenceCue: 'return', intimateScenes: false }), 'daytime');
  assert.equal(neutralPresenceScene('daytime', night), 'daytime');
});
