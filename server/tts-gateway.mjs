import http from 'node:http';
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
} from './tts-contract.mjs';

const PORT = Number(process.env.PORT || 10000);
const API_KEY = process.env.ELEVENLABS_API_KEY || process.env.elevenlabs_api_key || '';

const buckets = new Map();
let nextBucketSweepAt = 0;

function clientIp(req) {
  const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return forwarded || req.socket.remoteAddress || 'unknown';
}

function requestOrigin(req) {
  return String(req.headers.origin || '').trim();
}

function requestHost(req) {
  const forwarded = String(req.headers['x-forwarded-host'] || '').split(',')[0].trim();
  return forwarded || String(req.headers.host || '').trim();
}

function allowed(req) {
  const origin = requestOrigin(req);
  const host = requestHost(req);
  const ownOrigin = host ? `https://${host}` : '';
  return isTtsOriginAllowed(origin, ownOrigin);
}

function corsHeaders(req) {
  const origin = requestOrigin(req);
  return {
    ...(origin && allowed(req) ? { 'access-control-allow-origin': origin } : {}),
    'access-control-allow-methods': 'GET,POST,OPTIONS',
    'access-control-allow-headers': 'content-type',
    'access-control-max-age': '86400',
    'vary': 'Origin',
  };
}

function sendJson(req, res, status, body) {
  res.writeHead(status, {
    ...corsHeaders(req),
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
  });
  res.end(JSON.stringify(body));
}

function pruneRateBuckets(now) {
  if (now < nextBucketSweepAt && buckets.size < MIRA_TTS_MAX_TRACKED_CLIENTS) return;
  nextBucketSweepAt = now + MIRA_TTS_RATE_WINDOW_MS;
  for (const [key, bucket] of buckets) {
    if (now - bucket.startedAt >= MIRA_TTS_RATE_WINDOW_MS) buckets.delete(key);
  }
}

function ensureRateBucketCapacity() {
  if (buckets.size < MIRA_TTS_MAX_TRACKED_CLIENTS) return;
  const toRemove = buckets.size - MIRA_TTS_MAX_TRACKED_CLIENTS + 1;
  let removed = 0;
  for (const key of buckets.keys()) {
    buckets.delete(key);
    removed += 1;
    if (removed >= toRemove) break;
  }
}

function takeRateSlot(req) {
  const now = Date.now();
  const ip = clientIp(req);
  pruneRateBuckets(now);

  const previous = buckets.get(ip);
  if (!previous || now - previous.startedAt >= MIRA_TTS_RATE_WINDOW_MS) {
    if (previous) buckets.delete(ip);
    ensureRateBucketCapacity();
    buckets.set(ip, { startedAt: now, count: 1 });
    return true;
  }
  previous.count += 1;
  return previous.count <= MIRA_TTS_MAX_REQUESTS_PER_WINDOW;
}

async function readJson(req) {
  let total = 0;
  const chunks = [];
  for await (const chunk of req) {
    total += chunk.length;
    if (total > 16_384) throw new Error('payload_too_large');
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
}


async function synthesize(text, instructions) {
  const payload = elevenDialoguePayload(text, instructions);
  const response = await fetch(
    elevenDialogueUrl(),
    {
      method: 'POST',
      signal: AbortSignal.timeout(18_000),
      headers: {
        'content-type': 'application/json',
        'xi-api-key': API_KEY,
      },
      body: JSON.stringify(payload),
    },
  );

  if (!response.ok) {
    const detail = (await response.text()).slice(0, 240);
    throw new Error(`elevenlabs_${response.status}:${detail}`);
  }

  return { response, payload };
}

const server = http.createServer(async (req, res) => {
  try {
    if (!allowed(req)) {
      return sendJson(req, res, 403, { error: 'origin_not_allowed' });
    }

    if (req.method === 'OPTIONS') {
      res.writeHead(204, corsHeaders(req));
      return res.end();
    }

    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);

    if (req.method === 'GET' && url.pathname === '/health') {
      return sendJson(req, res, 200, {
        ok: true,
        ...ttsContractMetadata(Boolean(API_KEY)),
        runtime: 'render-node-gateway',
      });
    }

    if (req.method === 'GET' && url.pathname === '/voices') {
      return sendJson(req, res, 200, {
        voices: [
          { id: `elevenlabs:${defaultElevenVoice()}`, label: 'ElevenLabs · Sarah · Gentle · Active' },
        ],
        serverControlled: true,
      });
    }

    if (req.method === 'POST' && url.pathname === '/tts') {
      if (!API_KEY) return sendJson(req, res, 503, { error: 'elevenlabs_not_configured' });
      if (!takeRateSlot(req)) return sendJson(req, res, 429, { error: 'rate_limited' });

      const body = await readJson(req);
      const text = String(body.text || '').trim();
      if (!text) return sendJson(req, res, 400, { error: 'text_required' });
      if (text.length > MIRA_TTS_MAX_TEXT_LENGTH) return sendJson(req, res, 413, { error: 'text_too_long' });

      const { response, payload } = await synthesize(text, body.instructions);
      const audio = Buffer.from(await response.arrayBuffer());

      res.writeHead(200, {
        ...corsHeaders(req),
        'content-type': response.headers.get('content-type') || 'audio/mpeg',
        'content-length': String(audio.length),
        'cache-control': 'no-store',
        'x-content-type-options': 'nosniff',
        'x-mira-tts-provider': 'elevenlabs',
        'x-mira-tts-voice': payload.inputs[0].voice_id,
        'x-mira-tts-model': payload.model_id,
      });
      return res.end(audio);
    }

    return sendJson(req, res, 404, { error: 'not_found' });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const safeCode = message === 'payload_too_large'
      ? 'payload_too_large'
      : message.includes('JSON')
        ? 'invalid_json'
        : message.startsWith('elevenlabs_')
          ? 'tts_provider_error'
          : 'gateway_error';
    return sendJson(req, res, message === 'payload_too_large' ? 413 : 502, { error: safeCode });
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Mira TTS gateway listening on :${PORT}; provider=elevenlabs; configured=${Boolean(API_KEY)}`);
});
