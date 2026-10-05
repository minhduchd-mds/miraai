import assert from 'node:assert/strict';
import test from 'node:test';
import {
  MIRA_ELEVENLABS_VOICES,
  normalizeVoice,
  originAllowed,
} from '../server/elevenlabs-gateway.mjs';

test('Vercel TTS uses a female ElevenLabs voice contract', () => {
  assert.equal(MIRA_ELEVENLABS_VOICES[0].gender, 'female');
  assert.equal(MIRA_ELEVENLABS_VOICES[0].id, 'elevenlabs:21m00Tcm4TlvDq8ikWAM');
});

test('Vercel TTS normalizes auto and rejects malformed voice ids', () => {
  assert.match(normalizeVoice('auto'), /^[A-Za-z0-9_-]{8,64}$/);
  assert.equal(normalizeVoice('elevenlabs:21m00Tcm4TlvDq8ikWAM'), '21m00Tcm4TlvDq8ikWAM');
  assert.equal(normalizeVoice('../../bad'), normalizeVoice('auto'));
});

test('Vercel TTS allows same-origin requests without broad CORS', () => {
  const req = {
    headers: {
      origin: 'https://miraai-five.vercel.app',
      host: 'miraai-five.vercel.app',
    },
  };
  assert.equal(originAllowed(req), true);
});
