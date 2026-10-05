import {
  applyCors,
  defaultElevenModel,
  defaultElevenVoice,
  originAllowed,
} from '../server/tts-policy.mjs';

export default function handler(req, res) {
  applyCors(req, res, 'GET,OPTIONS');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (!originAllowed(req)) return res.status(403).json({ error: 'origin_not_allowed' });
  if (req.method !== 'GET') return res.status(405).json({ error: 'method_not_allowed' });

  const hasOpenAI = Boolean(process.env.OPENAI_API_KEY);
  const hasEleven = Boolean(process.env.elevenlabs_api_key || process.env.ELEVENLABS_API_KEY);
  const configuredProviders = [
    ...(hasOpenAI ? ['openai'] : []),
    ...(hasEleven ? ['elevenlabs'] : []),
  ];

  res.setHeader('cache-control', 'no-store');
  return res.status(200).json({
    ok: true,
    configured: configuredProviders.length > 0,
    provider: configuredProviders.length === 1 ? configuredProviders[0] : configuredProviders.length > 1 ? 'multi' : 'none',
    providers: configuredProviders,
    elevenLabs: {
      configured: hasEleven,
      voice: defaultElevenVoice(),
      voiceLabel: 'Rachel · nữ ấm áp',
      model: defaultElevenModel(),
    },
    runtime: 'vercel-serverless-api',
  });
}
