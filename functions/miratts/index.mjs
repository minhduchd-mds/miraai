import {
  MIRA_TTS_MAX_REQUESTS_PER_WINDOW,
  MIRA_TTS_MAX_TEXT_LENGTH,
  MIRA_TTS_MAX_TRACKED_CLIENTS,
  MIRA_TTS_RATE_WINDOW_MS,
  defaultElevenVoice,
  elevenDialoguePayload,
  elevenDialogueUrl,
  isTtsOriginAllowed,
  ttsContractMetadata,
} from '../../server/tts-contract.mjs';

const buckets = new Map();
const MAX_TTS_BODY_BYTES = 16_384;
const MAX_TTS_AUDIO_BYTES = 8 * 1024 * 1024;
let nextBucketSweepAt = 0;

function apiKey() {
  return process.env.ELEVENLABS_API_KEY || process.env.elevenlabs_api_key || '';
}

function requestOrigin(request) {
  return request.headers.get('origin') || '';
}

function originAllowed(request) {
  const origin = requestOrigin(request);
  if (!origin && request.headers.get('sec-fetch-site') === 'cross-site') return false;
  const ownOrigin = new URL(request.url).origin;
  return isTtsOriginAllowed(origin, ownOrigin);
}

function corsHeaders(request) {
  const origin = requestOrigin(request);
  return {
    ...(origin && originAllowed(request) ? { 'access-control-allow-origin': origin } : {}),
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
  // The Neon Function adapter has no documented trusted remote peer identity
  // available to this code. Do not trust caller supplied x-forwarded-for here.
  // A shared anonymous limit fails closed until provider-authenticated identity
  // or a verified trusted-proxy header can be introduced.
  return 'anonymous';
}

function pruneRateBuckets(now) {
  if (now < nextBucketSweepAt && buckets.size < MIRA_TTS_MAX_TRACKED_CLIENTS) return;
  nextBucketSweepAt = now + MIRA_TTS_RATE_WINDOW_MS;
  for (const [key, bucket] of buckets) {
    if (now - bucket.startedAt >= MIRA_TTS_RATE_WINDOW_MS) buckets.delete(key);
  }
}

function ensureRateBucketCapacity() {
  return buckets.size < MIRA_TTS_MAX_TRACKED_CLIENTS;
}

function takeRateSlot(request) {
  const now = Date.now();
  const key = clientKey(request);
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



async function parseBoundedJson(request) {
  const advertised = Number(request.headers.get('content-length') || 0);
  if (advertised > MAX_TTS_BODY_BYTES) return { error: 'payload_too_large' };
  const reader = request.body?.getReader();
  if (!reader) return { body: {} };
  const chunks = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_TTS_BODY_BYTES) {
        await reader.cancel().catch(() => {});
        return { error: 'payload_too_large' };
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(total);
  let pos = 0;
  for (const chunk of chunks) { bytes.set(chunk, pos); pos += chunk.length; }
  try {
    const body = total ? JSON.parse(new TextDecoder().decode(bytes)) : {};
    return { body };
  } catch {
    return { error: 'invalid_json' };
  }
}

function boundedAudioResponseStream(stream) {
  const reader = stream.getReader();
  let bytes = 0;
  return new ReadableStream({
    async pull(controller) {
      try {
        const { done, value } = await reader.read();
        if (done) { controller.close(); return; }
        bytes += value.byteLength;
        if (bytes > MAX_TTS_AUDIO_BYTES) {
          await reader.cancel().catch(() => {});
          controller.error(new Error('tts_audio_limit_exceeded'));
          return;
        }
        controller.enqueue(value);
      } catch (error) {
        controller.error(error);
      }
    },
    cancel(reason) { return reader.cancel(reason); },
  });
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
      ...ttsContractMetadata(Boolean(apiKey())),
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

    const parsed = await parseBoundedJson(request);
    if (parsed.error) {
      return json(request, { error: parsed.error }, parsed.error === 'payload_too_large' ? 413 : 400);
    }
    const body = parsed.body;

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
    const type = String(upstream.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
    if (type && !(type.startsWith('audio/') || type === 'application/octet-stream')) {
      return json(request, { error: 'tts_provider_invalid_audio' }, 502);
    }
    const length = Number(upstream.headers.get('content-length') || 0);
    if (!Number.isFinite(length) || length < 0 || length > MAX_TTS_AUDIO_BYTES) {
      return json(request, { error: 'tts_provider_audio_too_large' }, 502);
    }
    if (!upstream.body) return json(request, { error: 'tts_provider_empty_audio' }, 502);
    return new Response(boundedAudioResponseStream(upstream.body), {
      status: 200,
      headers: {
        ...corsHeaders(request),
        'content-type': type || 'audio/mpeg',
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
