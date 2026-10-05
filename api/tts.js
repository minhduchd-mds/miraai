import {
  applyCors,
  defaultElevenModel,
  defaultElevenVoice,
  originAllowed,
  takeRateSlot,
} from '../server/tts-policy.mjs';

function parseBody(req) {
  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  return body && typeof body === 'object' ? body : {};
}

function performanceText(text, instructions) {
  const clean = String(text || '').trim();
  const cue = String(instructions || '').toLowerCase();
  if (/thì thầm|whisper|bedtime|sleep|quiet/.test(cue)) return `[whispers] ${clean}`;
  if (/vui|happy|warm|gentle|dịu|affection|welcome/.test(cue)) return `[warmly] ${clean}`;
  if (/serious|cảnh báo|warning/.test(cue)) return `[serious] ${clean}`;
  return clean;
}

export default async function handler(req, res) {
  applyCors(req, res, 'POST,OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (!originAllowed(req)) return res.status(403).json({ error: 'origin_not_allowed' });
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
  if (!takeRateSlot(req)) return res.status(429).json({ error: 'rate_limited' });

  const body = parseBody(req);
  const text = String(body.text || '').trim();
  if (!text) return res.status(400).json({ error: 'text_required' });
  if (text.length > 3500) return res.status(413).json({ error: 'text_too_long' });

  const key = process.env.elevenlabs_api_key || process.env.ELEVENLABS_API_KEY || '';
  if (!key) return res.status(503).json({ error: 'elevenlabs_not_configured' });

  // Production voice identity is server-controlled. Ignore stale/client voice ids.
  const voice = defaultElevenVoice();
  const model = defaultElevenModel();

  try {
    const response = await fetch(
      'https://api.elevenlabs.io/v1/text-to-dialogue?output_format=mp3_44100_128',
      {
        method: 'POST',
        signal: AbortSignal.timeout(18_000),
        headers: {
          'content-type': 'application/json',
          'xi-api-key': key,
        },
        body: JSON.stringify({
          inputs: [{
            text: performanceText(text, body.instructions),
            voice_id: voice,
          }],
          model_id: model,
          language_code: 'vi',
          apply_text_normalization: 'auto',
        }),
      },
    );

    if (!response.ok) {
      const detail = (await response.text()).slice(0, 360);
      throw new Error(`ElevenLabs TTS ${response.status}: ${detail}`);
    }

    const audio = Buffer.from(await response.arrayBuffer());
    if (!audio.length) throw new Error('empty_audio');

    res.setHeader('content-type', response.headers.get('content-type') || 'audio/mpeg');
    res.setHeader('cache-control', 'no-store');
    res.setHeader('x-mira-tts-provider', 'elevenlabs');
    res.setHeader('x-mira-tts-model', model);
    res.setHeader('x-mira-tts-voice', voice);
    return res.status(200).send(audio);
  } catch (error) {
    return res.status(502).json({
      error: 'elevenlabs_tts_failed',
      detail: String(error && error.message ? error.message : error).slice(0, 240),
    });
  }
}
