const WINDOW_MS = 5 * 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 48;
const MAX_TRACKED_CLIENTS = 2048;
const buckets = new Map();
let nextBucketSweepAt = 0;

export const MIRA_DEFAULT_VOICE_ID = 'EXAVITQu4vr4xnSDxMaL';

export function defaultElevenVoice() {
  return process.env.ELEVENLABS_TTS_VOICE || MIRA_DEFAULT_VOICE_ID;
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
  if (origin === 'tauri://localhost' || origin === 'http://tauri.localhost' || origin === 'https://tauri.localhost') return true;

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

function pruneRateBuckets(now) {
  if (now < nextBucketSweepAt && buckets.size < MAX_TRACKED_CLIENTS) return;
  nextBucketSweepAt = now + WINDOW_MS;

  for (const [key, bucket] of buckets) {
    if (now - bucket.startedAt >= WINDOW_MS) buckets.delete(key);
  }
}

function ensureRateBucketCapacity() {
  if (buckets.size < MAX_TRACKED_CLIENTS) return;

  const toRemove = buckets.size - MAX_TRACKED_CLIENTS + 1;
  let removed = 0;
  for (const key of buckets.keys()) {
    buckets.delete(key);
    removed += 1;
    if (removed >= toRemove) break;
  }
}

export function takeRateSlot(req) {
  const now = Date.now();
  const key = clientKey(req);
  pruneRateBuckets(now);

  const previous = buckets.get(key);
  if (!previous || now - previous.startedAt >= WINDOW_MS) {
    if (previous) buckets.delete(key);
    ensureRateBucketCapacity();
    buckets.set(key, { startedAt: now, count: 1 });
    return true;
  }

  previous.count += 1;
  return previous.count <= MAX_REQUESTS_PER_WINDOW;
}
