const DEFAULT_VOICE = process.env.ELEVENLABS_TTS_VOICE || '21m00Tcm4TlvDq8ikWAM';
const DEFAULT_MODEL = process.env.ELEVENLABS_TTS_MODEL || 'eleven_multilingual_v2';
const MAX_TEXT_LENGTH = 1800;
const WINDOW_MS = 5 * 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 48;
const buckets = new Map();

export const MIRA_ELEVENLABS_VOICES = [
  {
    id: 'elevenlabs:21m00Tcm4TlvDq8ikWAM',
    label: 'ElevenLabs · Rachel · Nữ ấm áp',
    gender: 'female',
    tone: 'warm-expressive',
  },
];

export function hasElevenLabsKey() {
  return Boolean(process.env.ELEVENLABS_API_KEY || process.env.elevenlabs_api_key);
}

export function defaultVoiceId() {
  return DEFAULT_VOICE;
}

export function defaultModelId() {
  return DEFAULT_MODEL;
}

export function normalizeVoice(raw) {
  const value = String(raw || '').trim();
  if (!value || value === 'auto') return DEFAULT_VOICE;
  const normalized = value.startsWith('elevenlabs:')
    ? value.slice('elevenlabs:'.length)
    : value;
  if (!/^[A-Za-z0-9_-]{8,64}$/.test(normalized)) return DEFAULT_VOICE;
  return normalized;
}

function apiKey() {
  return process.env.ELEVENLABS_API_KEY || process.env.elevenlabs_api_key || '';
}

function requestOrigin(req) {
  return String(req.headers?.origin || '').trim();
}

function requestHost(req) {
  const forwarded = String(req.headers?.['x-forwarded-host'] || '').split(',')[0].trim();
  return forwarded || String(req.headers?.host || '').trim();
}

function allowedExtraOrigins() {
  return String(process.env.MIRA_TTS_ALLOWED_ORIGINS || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
}

export function originAllowed(req) {
  const origin = requestOrigin(req);
  if (!origin) return true;
  const host = requestHost(req);
  const ownOrigin = host ? `https://${host}` : '';
  return origin === ownOrigin || allowedExtraOrigins().includes(origin);
}

export function applyCors(req, res) {
  const origin = requestOrigin(req);
  if (origin && originAllowed(req)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'content-type');
  res.setHeader('Access-Control-Max-Age', '86400');
  res.setHeader('Vary', 'Origin');
  res.setHeader('X-Content-Type-Options', 'nosniff');
}

function clientKey(req) {
  const forwarded = String(req.headers?.['x-forwarded-for'] || '').split(',')[0].trim();
  return forwarded || String(req.socket?.remoteAddress || 'anonymous');
}

export function takeRateSlot(req) {
  const now = Date.now();
  const key = clientKey(req);
  const previous = buckets.get(key);
  if (!previous || now - previous.startedAt >= WINDOW_MS) {
    buckets.set(key, { startedAt: now, count: 1 });
    return true;
  }
  previous.count += 1;
  return previous.count <= MAX_REQUESTS_PER_WINDOW;
}

export async function synthesizeElevenLabs(text, voiceRaw) {
  const key = apiKey();
  if (!key) {
    return { ok: false, status: 503, error: 'elevenlabs_not_configured' };
  }

  const cleanText = String(text || '').trim();
  if (!cleanText) return { ok: false, status: 400, error: 'text_required' };
  if (cleanText.length > MAX_TEXT_LENGTH) {
    return { ok: false, status: 413, error: 'text_too_long' };
  }

  const voice = normalizeVoice(voiceRaw);
  let response;
  try {
    response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voice)}?output_format=mp3_44100_128`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'xi-api-key': key,
        },
        body: JSON.stringify({
          text: cleanText,
          model_id: DEFAULT_MODEL,
          voice_settings: {
            stability: 0.58,
            similarity_boost: 0.82,
            style: 0.12,
            use_speaker_boost: false,
          },
        }),
        signal: AbortSignal.timeout(18_000),
      },
    );
  } catch (error) {
    const timeout = error?.name === 'TimeoutError' || error?.name === 'AbortError';
    return {
      ok: false,
      status: timeout ? 504 : 502,
      error: timeout ? 'tts_provider_timeout' : 'tts_provider_unreachable',
    };
  }

  if (!response.ok) {
    return {
      ok: false,
      status: response.status === 401 || response.status === 403 ? 503 : 502,
      error: response.status === 401 || response.status === 403
        ? 'elevenlabs_auth_failed'
        : 'tts_provider_error',
    };
  }

  const audio = Buffer.from(await response.arrayBuffer());
  if (!audio.length) {
    return { ok: false, status: 502, error: 'empty_audio' };
  }

  return {
    ok: true,
    audio,
    voice,
    contentType: response.headers.get('content-type') || 'audio/mpeg',
  };
}
