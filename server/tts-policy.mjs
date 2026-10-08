import { canonicalRequestHost } from '../lib/request-host.js';
import {
  MIRA_TTS_MAX_REQUESTS_PER_WINDOW,
  MIRA_TTS_MAX_TRACKED_CLIENTS,
  MIRA_TTS_RATE_WINDOW_MS,
  isTtsOriginAllowed,
} from './tts-contract.mjs';

const buckets = new Map();
let nextBucketSweepAt = 0;

export {
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
  performanceText,
  ttsContractMetadata,
} from './tts-contract.mjs';

function requestOrigin(req) {
  return String(req.headers?.origin || '').trim();
}

function requestHost(req) {
  return canonicalRequestHost(req);
}


export function originAllowed(req) {
  const origin = requestOrigin(req);
  if (!origin && String(req.headers?.['sec-fetch-site'] || '') === 'cross-site') return false;
  const host = requestHost(req);
  const ownOrigin = host ? `https://${host}` : '';
  return isTtsOriginAllowed(origin, ownOrigin);
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
  const trusted = process.env.VERCEL
    ? req.headers?.['x-vercel-forwarded-for']
    : req.socket?.remoteAddress;
  return String(trusted || 'anonymous').split(',')[0].trim().slice(0, 128) || 'anonymous';
}

function pruneRateBuckets(now) {
  if (now < nextBucketSweepAt && buckets.size < MIRA_TTS_MAX_TRACKED_CLIENTS) return;
  nextBucketSweepAt = now + MIRA_TTS_RATE_WINDOW_MS;

  for (const [key, bucket] of buckets) {
    if (now - bucket.startedAt >= MIRA_TTS_RATE_WINDOW_MS) buckets.delete(key);
  }
}

function ensureRateBucketCapacity() {
  // Active clients cannot be evicted to bypass request limits.
  return buckets.size < MIRA_TTS_MAX_TRACKED_CLIENTS;
}

export function takeRateSlot(req) {
  const now = Date.now();
  const key = clientKey(req);
  pruneRateBuckets(now);

  const previous = buckets.get(key);
  if (!previous || now - previous.startedAt >= MIRA_TTS_RATE_WINDOW_MS) {
    if (previous) buckets.delete(key);
    if (!ensureRateBucketCapacity()) return false;
    buckets.set(key, { startedAt: now, count: 1 });
    return true;
  }

  previous.count += 1;
  return previous.count <= MIRA_TTS_MAX_REQUESTS_PER_WINDOW;
}
