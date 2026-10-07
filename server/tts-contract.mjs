export const MIRA_DEFAULT_VOICE_ID = 'EXAVITQu4vr4xnSDxMaL';
export const MIRA_DEFAULT_MODEL_ID = 'eleven_v4';
export const MIRA_TTS_OUTPUT_FORMAT = 'mp3_44100_128';
export const MIRA_TTS_MAX_TEXT_LENGTH = 2000;
export const MIRA_TTS_RATE_WINDOW_MS = 5 * 60 * 1000;
export const MIRA_TTS_MAX_REQUESTS_PER_WINDOW = 48;
export const MIRA_TTS_MAX_TRACKED_CLIENTS = 2048;
export const MIRA_DEFAULT_ALLOWED_ORIGIN = 'https://minhduchd-mds.github.io';

export function configuredTtsOrigins() {
  return [
    MIRA_DEFAULT_ALLOWED_ORIGIN,
    String(process.env.MIRA_TTS_ALLOWED_ORIGIN || '').trim(),
    ...String(process.env.MIRA_TTS_ALLOWED_ORIGINS || '')
      .split(',')
      .map((value) => value.trim()),
  ].filter(Boolean);
}

export function isTtsOriginAllowed(origin, ownOrigin = '') {
  const normalized = String(origin || '').trim();
  if (!normalized) return true;
  if (
    normalized === 'tauri://localhost' ||
    normalized === 'http://tauri.localhost' ||
    normalized === 'https://tauri.localhost'
  ) return true;
  if (ownOrigin && normalized === ownOrigin) return true;
  return configuredTtsOrigins().includes(normalized);
}

export function ttsContractMetadata(configured) {
  return {
    provider: 'elevenlabs',
    configured: Boolean(configured),
    elevenLabsOnly: true,
    serverControlled: true,
    voice: defaultElevenVoice(),
    model: defaultElevenModel(),
    outputFormat: MIRA_TTS_OUTPUT_FORMAT,
  };
}

export function defaultElevenVoice() {
  return process.env.ELEVENLABS_TTS_VOICE
    || process.env.ELEVENLABS_VOICE_ID
    || MIRA_DEFAULT_VOICE_ID;
}

export function defaultElevenModel() {
  return process.env.ELEVENLABS_TTS_MODEL || MIRA_DEFAULT_MODEL_ID;
}

export function performanceText(text, instructions = '') {
  const clean = String(text || '').trim();
  const cue = String(instructions || '').toLowerCase();
  if (/thì thầm|whisper|bedtime|sleep|quiet/.test(cue)) return `[whispers] ${clean}`;
  if (/vui|happy|warm|gentle|dịu|affection|welcome/.test(cue)) return `[warmly] ${clean}`;
  if (/serious|cảnh báo|warning/.test(cue)) return `[serious] ${clean}`;
  return clean;
}

export function elevenDialoguePayload(text, instructions = '') {
  return {
    inputs: [{
      text: performanceText(text, instructions),
      voice_id: defaultElevenVoice(),
    }],
    model_id: defaultElevenModel(),
    language_code: 'vi',
    apply_text_normalization: 'auto',
  };
}

export function elevenDialogueUrl() {
  return `https://api.elevenlabs.io/v1/text-to-dialogue?output_format=${MIRA_TTS_OUTPUT_FORMAT}`;
}
