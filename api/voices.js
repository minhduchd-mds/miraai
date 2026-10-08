import { markPrivateResponse } from '../lib/private-response.js';
import { loadVoiceCatalog } from '../server/voice-catalog.mjs';
import {
  applyCors,
  defaultElevenVoice,
  originAllowed,
} from '../server/tts-policy.mjs';

export default async function handler(req, res) {
  applyCors(req, res, 'GET,OPTIONS');
  markPrivateResponse(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (!originAllowed(req)) return res.status(403).json({ error: 'origin_not_allowed' });
  if (req.method !== 'GET') return res.status(405).json({ error: 'method_not_allowed' });

  const key = process.env.elevenlabs_api_key || process.env.ELEVENLABS_API_KEY || '';
  const result = await loadVoiceCatalog(key);
  return res.status(200).json({
    provider: 'elevenlabs',
    elevenLabsOnly: true,
    configured: Boolean(key),
    currentVoice: `elevenlabs:${defaultElevenVoice()}`,
    ...result,
  });
}
