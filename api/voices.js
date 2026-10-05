import {
  RACHEL_VOICE_ID,
  applyCors,
  originAllowed,
} from '../server/tts-policy.mjs';

export default function handler(req, res) {
  applyCors(req, res, 'GET,OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (!originAllowed(req)) return res.status(403).json({ error: 'origin_not_allowed' });
  if (req.method !== 'GET') return res.status(405).json({ error: 'method_not_allowed' });

  const hasOpenAI = !!process.env.OPENAI_API_KEY;
  const hasEleven = !!(process.env.elevenlabs_api_key || process.env.ELEVENLABS_API_KEY);
  const voices = [];

  if (hasEleven) {
    voices.push(
      { id: `elevenlabs:${RACHEL_VOICE_ID}`, label: 'ElevenLabs · Rachel · Nữ ấm áp' },
      { id: 'elevenlabs:EXAVITQu4vr4xnSDxMaL', label: 'ElevenLabs · Sarah · Gentle' },
      { id: 'elevenlabs:XB0fDUnXU5powFXDhCwa', label: 'ElevenLabs · Charlotte' },
    );
  }

  if (hasOpenAI) {
    voices.push(
      { id: 'openai:marin', label: 'Mira Natural · Marin' },
      { id: 'openai:cedar', label: 'Mira Natural · Cedar' },
      { id: 'openai:coral', label: 'Mira Natural · Coral' },
      { id: 'openai:shimmer', label: 'Mira Natural · Shimmer' },
    );
  }

  if (!voices.length) voices.push({ id: 'auto', label: 'Tự động · Giọng hệ thống' });
  res.setHeader('cache-control', 'private, max-age=60');
  res.status(200).json({ voices });
}
