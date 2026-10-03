const ALLOWED_ORIGIN = process.env.MIRA_TTS_ALLOWED_ORIGIN || 'https://minhduchd-mds.github.io';

function applyCors(req, res) {
  const origin = String(req.headers?.origin || '');
  res.setHeader('access-control-allow-origin', origin === ALLOWED_ORIGIN ? origin : ALLOWED_ORIGIN);
  res.setHeader('access-control-allow-methods', 'GET,OPTIONS');
  res.setHeader('access-control-allow-headers', 'content-type');
  res.setHeader('access-control-max-age', '86400');
  res.setHeader('vary', 'Origin');
}

function originAllowed(req) {
  const origin = String(req.headers?.origin || '');
  return !origin || origin === ALLOWED_ORIGIN;
}

// Voice metadata for Mira neural TTS. Only advertise providers configured on the server.
export default function handler(req, res) {
  applyCors(req, res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (!originAllowed(req)) return res.status(403).json({ error: 'origin_not_allowed' });
  if (req.method !== 'GET') return res.status(405).json({ error: 'method_not_allowed' });

  const hasOpenAI = !!process.env.OPENAI_API_KEY;
  const hasEleven = !!(process.env.elevenlabs_api_key || process.env.ELEVENLABS_API_KEY);
  const voices = [];

  if (hasOpenAI) {
    voices.push(
      { id: 'openai:marin', label: 'Mira Natural · Marin' },
      { id: 'openai:cedar', label: 'Mira Natural · Cedar' },
      { id: 'openai:coral', label: 'Mira Natural · Coral' },
      { id: 'openai:shimmer', label: 'Mira Natural · Shimmer' },
    );
  }

  if (hasEleven) {
    voices.push(
      { id: 'elevenlabs:EXAVITQu4vr4xnSDxMaL', label: 'ElevenLabs · Sarah · Gentle' },
      { id: 'elevenlabs:21m00Tcm4TlvDq8ikWAM', label: 'ElevenLabs · Rachel' },
      { id: 'elevenlabs:XB0fDUnXU5powFXDhCwa', label: 'ElevenLabs · Charlotte' },
    );
  }

  if (!voices.length) voices.push({ id: 'auto', label: 'Tự động · Giọng hệ thống' });
  res.setHeader('cache-control', 'private, max-age=60');
  res.setHeader('x-content-type-options', 'nosniff');
  res.status(200).json({ voices });
}
