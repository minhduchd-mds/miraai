import {
  applyCors,
  defaultElevenVoice,
  originAllowed,
} from '../server/tts-policy.mjs';

function normalizeVoice(voice) {
  const labels = voice?.labels && typeof voice.labels === 'object' ? voice.labels : {};
  return {
    id: `elevenlabs:${String(voice?.voice_id || '')}`,
    voiceId: String(voice?.voice_id || ''),
    name: String(voice?.name || ''),
    category: String(voice?.category || ''),
    gender: String(labels.gender || '').toLowerCase(),
    accent: String(labels.accent || '').toLowerCase(),
    language: String(labels.language || '').toLowerCase(),
    description: String(labels.description || ''),
    useCase: String(labels.use_case || ''),
  };
}

export default async function handler(req, res) {
  applyCors(req, res, 'GET,OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (!originAllowed(req)) return res.status(403).json({ error: 'origin_not_allowed' });
  if (req.method !== 'GET') return res.status(405).json({ error: 'method_not_allowed' });

  const key = process.env.elevenlabs_api_key || process.env.ELEVENLABS_API_KEY || '';
  const configured = Boolean(key);
  const currentVoice = defaultElevenVoice();

  let voices = [];
  let discovery = configured ? 'empty' : 'not_configured';

  if (configured) {
    try {
      const response = await fetch('https://api.elevenlabs.io/v1/voices', {
        headers: { 'xi-api-key': key },
        signal: AbortSignal.timeout(8_000),
      });
      if (!response.ok) throw new Error(`voices_${response.status}`);
      const body = await response.json();
      const all = (Array.isArray(body?.voices) ? body.voices : [])
        .map(normalizeVoice)
        .filter((voice) => voice.voiceId);

      voices = all
        .filter((voice) => voice.category === 'premade' || voice.category === 'generated')
        .sort((a, b) => {
          const af = a.gender === 'female' ? 1 : 0;
          const bf = b.gender === 'female' ? 1 : 0;
          if (af !== bf) return bf - af;
          return a.name.localeCompare(b.name);
        });
      discovery = voices.length ? 'default_or_owned' : 'none';
    } catch {
      discovery = 'unavailable';
    }
  }

  res.setHeader('cache-control', 'private, max-age=60');
  return res.status(200).json({
    provider: 'elevenlabs',
    elevenLabsOnly: true,
    configured,
    currentVoice: `elevenlabs:${currentVoice}`,
    discovery,
    voices,
  });
}
