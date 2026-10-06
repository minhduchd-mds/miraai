const ALLOWED_ORIGIN = process.env.MIRA_TTS_ALLOWED_ORIGIN || 'https://minhduchd-mds.github.io';
const DEFAULT_VOICE = process.env.ELEVENLABS_TTS_VOICE
  || process.env.ELEVENLABS_VOICE_ID
  || 'EXAVITQu4vr4xnSDxMaL';
const DEFAULT_MODEL = process.env.ELEVENLABS_TTS_MODEL || 'eleven_multilingual_v2';
const MAX_TEXT_LENGTH = 1600;
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

function normalizeVoice(raw) {
  const value = String(raw || '').trim();
  if (!value || value === 'auto') return DEFAULT_VOICE;
  return value.startsWith('elevenlabs:') ? value.slice('elevenlabs:'.length) : value;
}

async function synthesize(text, voice) {
  const key = apiKey();
  if (!key) return { ok: false, status: 503, error: 'elevenlabs_not_configured' };

  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voice)}?output_format=mp3_44100_64`,
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'xi-api-key': key,
      },
      body: JSON.stringify({
        text,
        model_id: DEFAULT_MODEL,
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.78,
          style: 0.16,
          use_speaker_boost: false,
        },
      }),
      signal: AbortSignal.timeout(18_000),
    },
  );

  if (!response.ok) {
    return { ok: false, status: 502, error: 'tts_provider_error' };
  }

  return { ok: true, response };
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
      model: DEFAULT_MODEL,
      runtime: 'neon-function',
    });
  }

  if (request.method === 'GET' && url.pathname.endsWith('/voices')) {
    return json(request, {
      voices: [
        { id: 'elevenlabs:EXAVITQu4vr4xnSDxMaL', label: 'ElevenLabs · Sarah · Gentle' },
        { id: 'elevenlabs:21m00Tcm4TlvDq8ikWAM', label: 'ElevenLabs · Rachel' },
        { id: 'elevenlabs:XB0fDUnXU5powFXDhCwa', label: 'ElevenLabs · Charlotte' },
      ],
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
    if (text.length > MAX_TEXT_LENGTH) {
      return json(request, { error: 'text_too_long' }, 413);
    }

    const voice = normalizeVoice(body?.voice);
    const result = await synthesize(text, voice);
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
        'x-mira-tts-voice': voice,
      },
    });
  }

  return json(request, { error: 'not_found' }, 404);
}

export default { fetch: handler };
