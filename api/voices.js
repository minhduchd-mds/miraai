import {
  applyCors,
  defaultElevenVoice,
  originAllowed,
} from '../server/tts-policy.mjs';

export default function handler(req, res) {
  applyCors(req, res, 'GET,OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (!originAllowed(req)) return res.status(403).json({ error: 'origin_not_allowed' });
  if (req.method !== 'GET') return res.status(405).json({ error: 'method_not_allowed' });

  const configured = Boolean(process.env.elevenlabs_api_key || process.env.ELEVENLABS_API_KEY);
  const activeVoice = defaultElevenVoice();

  res.setHeader('cache-control', 'private, max-age=60');
  return res.status(200).json({
    provider: 'elevenlabs',
    elevenLabsOnly: true,
    configured,
    currentVoice: `elevenlabs:${activeVoice}`,
    voices: configured ? [{
      id: `elevenlabs:${activeVoice}`,
      label: 'Mira · ElevenLabs Female',
      active: true,
    }] : [],
  });
}
