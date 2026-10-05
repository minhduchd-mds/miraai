import {
  applyCors,
  originAllowed,
  synthesizeElevenLabs,
  takeRateSlot,
} from '../server/elevenlabs-gateway.mjs';

export default async function handler(req, res) {
  applyCors(req, res);
  if (!originAllowed(req)) {
    return res.status(403).json({ error: 'origin_not_allowed' });
  }
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
  if (!takeRateSlot(req)) return res.status(429).json({ error: 'rate_limited' });

  const body = req.body && typeof req.body === 'object'
    ? req.body
    : {};
  const result = await synthesizeElevenLabs(body.text, body.voice);

  if (!result.ok) {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(result.status).json({ error: result.error });
  }

  res.setHeader('Content-Type', result.contentType);
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Mira-TTS-Provider', 'elevenlabs');
  res.setHeader('X-Mira-TTS-Voice', result.voice);
  return res.status(200).send(result.audio);
}
