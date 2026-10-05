import {
  MIRA_ELEVENLABS_VOICES,
  applyCors,
  originAllowed,
} from '../server/elevenlabs-gateway.mjs';

export default function handler(req, res) {
  applyCors(req, res);
  if (!originAllowed(req)) {
    return res.status(403).json({ error: 'origin_not_allowed' });
  }
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'method_not_allowed' });

  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json({
    voices: MIRA_ELEVENLABS_VOICES,
  });
}
