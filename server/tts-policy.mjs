const WINDOW_MS = 5 * 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 48;
const buckets = new Map();

export const RACHEL_VOICE_ID = '21m00Tcm4TlvDq8ikWAM';

export function defaultElevenVoice() {
  return process.env.ELEVENLABS_TTS_VOICE || RACHEL_VOICE_ID;
}

export function defaultElevenModel() {
  return process.env.ELEVENLABS_TTS_MODEL || 'eleven_v4';
}

function requestOrigin(req) {
  return String(req.headers?.origin || '').trim();
}

function requestHost(req) {
  const forwarded = String(req.headers?.['x-forwarded-host'] || '').split(',')[0].trim();
  return forwarded || String(req.headers?.host || '').trim();
}

function extraAllowedOrigins() {
  return [
    String(process.env.MIRA_TTS_ALLOWED_ORIGIN || '').trim(),
    ...String(process.env.MIRA_TTS_ALLOWED_ORIGINS || '').split(',').map((value) => value.trim()),
  ].filter(Boolean);
}

export function originAllowed(req) {
  const origin = requestOrigin(req);
  if (!origin) return true;

  const host = requestHost(req);
  const ownOrigin = host ? `https://${host}` : '';
  if (origin === ownOrigin) return true;
  return extraAllowedOrigins().includes(origin);
}

export function applyCors(req, res, methods = 'GET,POST,OPTIONS') {
  const origin = requestOrigin(req);
  if (origin && originAllowed(req)) {
    res.setHeader('access-control-allow-origin', origin);
  }
  res.setHeader('access-control-allow-methods', methods);
  res.setHeader('access-control-allow-headers', 'content-type');
  res.setHeader('access-control-max-age', '86400');
  res.setHeader('vary', 'Origin');
  res.setHeader('x-content-type-options', 'nosniff');
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
