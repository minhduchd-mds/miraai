import {
  applyCors,
  MIRA_TTS_MAX_TEXT_LENGTH,
  elevenDialoguePayload,
  elevenDialogueUrl,
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


export default async function handler(req, res) {
  applyCors(req, res, 'POST,OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (!originAllowed(req)) return res.status(403).json({ error: 'origin_not_allowed' });
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
  if (!takeRateSlot(req)) return res.status(429).json({ error: 'rate_limited' });

  const body = parseBody(req);
  const text = String(body.text || '').trim();
  if (!text) return res.status(400).json({ error: 'text_required' });
  if (text.length > MIRA_TTS_MAX_TEXT_LENGTH) return res.status(413).json({ error: 'text_too_long' });

  const key = process.env.elevenlabs_api_key || process.env.ELEVENLABS_API_KEY || '';
  if (!key) return res.status(503).json({ error: 'elevenlabs_not_configured' });

  // Production voice identity/model are server-controlled through the shared contract.
  const payload = elevenDialoguePayload(text, body.instructions);

  try {
    const response = await fetch(
      elevenDialogueUrl(),
      {
        method: 'POST',
        signal: AbortSignal.timeout(18_000),
        headers: {
          'content-type': 'application/json',
          'xi-api-key': key,
        },
        body: JSON.stringify(payload),
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
    res.setHeader('x-mira-tts-model', payload.model_id);
    res.setHeader('x-mira-tts-voice', payload.inputs[0].voice_id);
    return res.status(200).send(audio);
  } catch (error) {
    return res.status(502).json({
      error: 'elevenlabs_tts_failed',
      detail: String(error && error.message ? error.message : error).slice(0, 240),
    });
  }
}
