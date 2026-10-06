import http from 'node:http';

const PORT = Number(process.env.PORT || 10000);
const ALLOWED_ORIGIN = process.env.MIRA_TTS_ALLOWED_ORIGIN || 'https://minhduchd-mds.github.io';
const DEFAULT_VOICE = process.env.ELEVENLABS_TTS_VOICE
  || process.env.ELEVENLABS_VOICE_ID
  || 'EXAVITQu4vr4xnSDxMaL';
const DEFAULT_MODEL = process.env.ELEVENLABS_TTS_MODEL || 'eleven_multilingual_v2';
const API_KEY = process.env.ELEVENLABS_API_KEY || process.env.elevenlabs_api_key || '';
const MAX_TEXT_LENGTH = 1600;

const WINDOW_MS = 5 * 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 32;
const MAX_TRACKED_CLIENTS = 2048;
const buckets = new Map();
let nextBucketSweepAt = 0;

function clientIp(req) {
  const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return forwarded || req.socket.remoteAddress || 'unknown';
}

function allowed(req) {
  const origin = String(req.headers.origin || '');
  return !origin || origin === ALLOWED_ORIGIN;
}

function corsHeaders(req) {
  const origin = String(req.headers.origin || '');
  return {
    'access-control-allow-origin': origin === ALLOWED_ORIGIN ? origin : ALLOWED_ORIGIN,
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

function takeRateSlot(req) {
  const now = Date.now();
  const ip = clientIp(req);
  pruneRateBuckets(now);

  const previous = buckets.get(ip);
  if (!previous || now - previous.startedAt >= WINDOW_MS) {
    if (previous) buckets.delete(ip);
    ensureRateBucketCapacity();
    buckets.set(ip, { startedAt: now, count: 1 });
    return true;
  }
  previous.count += 1;
  return previous.count <= MAX_REQUESTS_PER_WINDOW;
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

function normalizeVoice(raw) {
  const value = String(raw || '').trim();
  if (!value || value === 'auto') return DEFAULT_VOICE;
  return value.startsWith('elevenlabs:') ? value.slice('elevenlabs:'.length) : value;
}

async function synthesize(text, voice) {
  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voice)}?output_format=mp3_44100_64`,
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'xi-api-key': API_KEY,
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
    },
  );

  if (!response.ok) {
    const detail = (await response.text()).slice(0, 240);
    throw new Error(`elevenlabs_${response.status}:${detail}`);
  }

  return response;
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
        provider: 'elevenlabs',
        configured: Boolean(API_KEY),
        model: DEFAULT_MODEL,
      });
    }

    if (req.method === 'GET' && url.pathname === '/voices') {
      return sendJson(req, res, 200, {
        voices: [
          { id: 'elevenlabs:EXAVITQu4vr4xnSDxMaL', label: 'ElevenLabs · Sarah · Gentle' },
          { id: 'elevenlabs:21m00Tcm4TlvDq8ikWAM', label: 'ElevenLabs · Rachel' },
          { id: 'elevenlabs:XB0fDUnXU5powFXDhCwa', label: 'ElevenLabs · Charlotte' },
        ],
      });
    }

    if (req.method === 'POST' && url.pathname === '/tts') {
      if (!API_KEY) return sendJson(req, res, 503, { error: 'elevenlabs_not_configured' });
      if (!takeRateSlot(req)) return sendJson(req, res, 429, { error: 'rate_limited' });

      const body = await readJson(req);
      const text = String(body.text || '').trim();
      if (!text) return sendJson(req, res, 400, { error: 'text_required' });
      if (text.length > MAX_TEXT_LENGTH) return sendJson(req, res, 413, { error: 'text_too_long' });

      const voice = normalizeVoice(body.voice);
      const response = await synthesize(text, voice);
      const audio = Buffer.from(await response.arrayBuffer());

      res.writeHead(200, {
        ...corsHeaders(req),
        'content-type': response.headers.get('content-type') || 'audio/mpeg',
        'content-length': String(audio.length),
        'cache-control': 'no-store',
        'x-content-type-options': 'nosniff',
        'x-mira-tts-provider': 'elevenlabs',
        'x-mira-tts-voice': voice,
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
