import {
  MIRA_TTS_MAX_TEXT_LENGTH,
  defaultElevenModel,
  defaultElevenVoice,
  elevenDialoguePayload,
  elevenDialogueUrl,
} from '../../server/tts-contract.mjs';

const ALLOWED_ORIGIN = process.env.MIRA_TTS_ALLOWED_ORIGIN || 'https://minhduchd-mds.github.io';
const WINDOW_MS = 5 * 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 32;
const MAX_TRACKED_CLIENTS = 2048;
const buckets = new Map();
let nextBucketSweepAt = 0;

function apiKey() {
  return process.env.ELEVENLABS_API_KEY || process.env.elevenlabs_api_key || '';
}

function requestOrigin(request) {
  return request.headers.get('origin') || '';
}

function originAllowed(request) {
  const origin = requestOrigin(request);
  return !origin || origin === ALLOWED_ORIGIN;
}

function corsHeaders(request) {
  const origin = requestOrigin(request);
  return {
    'access-control-allow-origin': origin === ALLOWED_ORIGIN ? origin : ALLOWED_ORIGIN,
    'access-control-allow-methods': 'GET,POST,OPTIONS',
    'access-control-allow-headers': 'content-type',
    'access-control-max-age': '86400',
    'vary': 'Origin',
  };
}

function json(request, body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders(request),
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
    },
  });
}

function clientKey(request) {
  const forwarded = request.headers.get('x-forwarded-for') || '';
  return forwarded.split(',')[0].trim()
    || request.headers.get('x-real-ip')
    || 'anonymous';
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

function takeRateSlot(request) {
  const now = Date.now();
  const key = clientKey(request);
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


async function synthesize(text, instructions) {
  const key = apiKey();
  if (!key) return { ok: false, status: 503, error: 'elevenlabs_not_configured' };

  const payload = elevenDialoguePayload(text, instructions);
  const response = await fetch(
    elevenDialogueUrl(),
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'xi-api-key': key,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(18_000),
    },
  );

  if (!response.ok) {
    return { ok: false, status: 502, error: 'tts_provider_error' };
  }

  return { ok: true, response, payload };
}

async function handler(request) {
  if (!originAllowed(request)) {
    return json(request, { error: 'origin_not_allowed' }, 403);
  }

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(request) });
  }

  const url = new URL(request.url);

  if (request.method === 'GET' && url.pathname.endsWith('/health')) {
    return json(request, {
      ok: true,
      provider: 'elevenlabs',
      configured: Boolean(apiKey()),
      model: defaultElevenModel(),
      runtime: 'neon-function',
    });
  }

  if (request.method === 'GET' && url.pathname.endsWith('/voices')) {
    return json(request, {
      voices: [
        { id: `elevenlabs:${defaultElevenVoice()}`, label: 'ElevenLabs · Sarah · Gentle · Active' },
      ],
      serverControlled: true,
    });
  }

  if (request.method === 'POST' && url.pathname.endsWith('/tts')) {
    if (!takeRateSlot(request)) {
      return json(request, { error: 'rate_limited' }, 429);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return json(request, { error: 'invalid_json' }, 400);
    }

    const text = String(body?.text || '').trim();
    if (!text) return json(request, { error: 'text_required' }, 400);
    if (text.length > MIRA_TTS_MAX_TEXT_LENGTH) {
      return json(request, { error: 'text_too_long' }, 413);
    }

    const result = await synthesize(text, body?.instructions);
    if (!result.ok) {
      return json(request, { error: result.error }, result.status);
    }

    const upstream = result.response;
    return new Response(upstream.body, {
      status: 200,
      headers: {
        ...corsHeaders(request),
        'content-type': upstream.headers.get('content-type') || 'audio/mpeg',
        'cache-control': 'no-store',
        'x-content-type-options': 'nosniff',
        'x-mira-tts-provider': 'elevenlabs',
        'x-mira-tts-voice': result.payload.inputs[0].voice_id,
        'x-mira-tts-model': result.payload.model_id,
      },
    });
  }

  return json(request, { error: 'not_found' }, 404);
}

export default { fetch: handler };
