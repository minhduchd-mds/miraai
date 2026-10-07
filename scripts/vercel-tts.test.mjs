import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import {
  MIRA_DEFAULT_MODEL_ID,
  MIRA_DEFAULT_VOICE_ID,
  MIRA_TTS_MAX_REQUESTS_PER_WINDOW,
  MIRA_TTS_MAX_TEXT_LENGTH,
  MIRA_TTS_MAX_TRACKED_CLIENTS,
  MIRA_TTS_OUTPUT_FORMAT,
  MIRA_TTS_RATE_WINDOW_MS,
  defaultElevenModel,
  defaultElevenVoice,
  elevenDialoguePayload,
  elevenDialogueUrl,
  isTtsOriginAllowed,
  originAllowed,
  ttsContractMetadata,
} from '../server/tts-policy.mjs';

test('Vercel TTS defaults to the active ElevenLabs premade female voice contract', () => {
  assert.equal(MIRA_DEFAULT_VOICE_ID, 'EXAVITQu4vr4xnSDxMaL');
  assert.equal(
    defaultElevenVoice(),
    process.env.ELEVENLABS_TTS_VOICE || process.env.ELEVENLABS_VOICE_ID || MIRA_DEFAULT_VOICE_ID,
  );
  assert.equal(MIRA_DEFAULT_MODEL_ID, 'eleven_v4');
  assert.equal(defaultElevenModel(), process.env.ELEVENLABS_TTS_MODEL || MIRA_DEFAULT_MODEL_ID);
  assert.equal(MIRA_TTS_OUTPUT_FORMAT, 'mp3_44100_128');
  assert.equal(MIRA_TTS_MAX_TEXT_LENGTH, 2000);
  assert.equal(MIRA_TTS_RATE_WINDOW_MS, 5 * 60 * 1000);
  assert.equal(MIRA_TTS_MAX_REQUESTS_PER_WINDOW, 48);
  assert.equal(MIRA_TTS_MAX_TRACKED_CLIENTS, 2048);
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

test('shared TTS contract allows desktop origins and exposes stable health metadata', () => {
  assert.equal(isTtsOriginAllowed('tauri://localhost'), true);
  assert.equal(
    isTtsOriginAllowed('https://mira.example', 'https://mira.example'),
    true,
  );
  assert.equal(
    isTtsOriginAllowed('https://evil.example', 'https://mira.example'),
    false,
  );

  const metadata = ttsContractMetadata(true);
  assert.equal(metadata.provider, 'elevenlabs');
  assert.equal(metadata.configured, true);
  assert.equal(metadata.elevenLabsOnly, true);
  assert.equal(metadata.serverControlled, true);
  assert.equal(metadata.voice, defaultElevenVoice());
  assert.equal(metadata.model, defaultElevenModel());
  assert.equal(metadata.outputFormat, MIRA_TTS_OUTPUT_FORMAT);
});


test('Vercel TTS contract is ElevenLabs-only, Vietnamese and v4 dialogue', () => {
  const tts = readFileSync('api/tts.js', 'utf8');
  const payload = elevenDialoguePayload('Xin chào', 'gentle');
  assert.equal(elevenDialogueUrl(), 'https://api.elevenlabs.io/v1/text-to-dialogue?output_format=mp3_44100_128');
  assert.equal(payload.model_id, defaultElevenModel());
  assert.equal(payload.language_code, 'vi');
  assert.equal(payload.apply_text_normalization, 'auto');
  assert.equal(payload.inputs.length, 1);
  assert.equal(payload.inputs[0].voice_id, defaultElevenVoice());
  assert.match(payload.inputs[0].text, /^\[warmly\]/);
  assert.ok(tts.includes('elevenDialoguePayload'));
  assert.ok(tts.includes('elevenDialogueUrl'));
  assert.ok(tts.includes("x-mira-tts-provider', 'elevenlabs'"));
  assert.ok(!tts.includes('/v1/text-to-speech/'));
  assert.ok(!tts.includes('api.openai.com'));
});


test('production TTS ignores client voice ids so stale paid-library ids cannot leak through', () => {
  const source = readFileSync('api/tts.js', 'utf8');
  assert.ok(source.includes('elevenDialoguePayload(text, body.instructions)'));
  assert.ok(!source.includes('body.voice'));
  assert.ok(!source.includes('normalizeVoice('));
});
