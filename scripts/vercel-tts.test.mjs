import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import {
  MIRA_DEFAULT_VOICE_ID,
  defaultElevenModel,
  defaultElevenVoice,
  originAllowed,
} from '../server/tts-policy.mjs';

test('Vercel TTS defaults to the active ElevenLabs premade female voice contract', () => {
  assert.equal(MIRA_DEFAULT_VOICE_ID, 'EXAVITQu4vr4xnSDxMaL');
  assert.equal(defaultElevenVoice(), process.env.ELEVENLABS_TTS_VOICE || MIRA_DEFAULT_VOICE_ID);
  assert.equal(defaultElevenModel(), process.env.ELEVENLABS_TTS_MODEL || 'eleven_v4');
});

test('Vercel TTS allows its own deployment origin', () => {
  assert.equal(originAllowed({
    headers: {
      origin: 'https://miraai-five.vercel.app',
      host: 'miraai-five.vercel.app',
    },
  }), true);
});

test('Vercel TTS rejects unrelated origins by default', () => {
  assert.equal(originAllowed({
    headers: {
      origin: 'https://example.invalid',
      host: 'miraai-five.vercel.app',
    },
  }), false);
});


test('Vercel TTS contract is ElevenLabs-only, Vietnamese and v4 dialogue', () => {
  const tts = readFileSync('api/tts.js', 'utf8');
  assert.ok(tts.includes('/v1/text-to-dialogue?output_format=mp3_44100_128'));
  assert.ok(tts.includes("language_code: 'vi'"));
  assert.ok(tts.includes('inputs: [{'));
  assert.ok(tts.includes('voice_id: voice'));
  assert.ok(tts.includes("x-mira-tts-provider', 'elevenlabs'"));
  assert.ok(!tts.includes('/v1/text-to-speech/'));
  assert.ok(!tts.includes('api.openai.com'));
});


test('production TTS ignores client voice ids so stale paid-library ids cannot leak through', () => {
  const source = readFileSync('api/tts.js', 'utf8');
  assert.ok(source.includes('const voice = defaultElevenVoice()'));
  assert.ok(!source.includes('normalizeVoice(body.voice)'));
});
