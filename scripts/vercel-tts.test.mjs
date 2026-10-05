import assert from 'node:assert/strict';
import test from 'node:test';
import {
  RACHEL_VOICE_ID,
  defaultElevenModel,
  defaultElevenVoice,
  originAllowed,
} from '../server/tts-policy.mjs';

test('Vercel TTS defaults to Rachel female voice contract', () => {
  assert.equal(RACHEL_VOICE_ID, '21m00Tcm4TlvDq8ikWAM');
  assert.equal(defaultElevenVoice(), process.env.ELEVENLABS_TTS_VOICE || RACHEL_VOICE_ID);
  assert.equal(defaultElevenModel(), process.env.ELEVENLABS_TTS_MODEL || 'eleven_multilingual_v2');
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
