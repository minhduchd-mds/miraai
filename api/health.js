import {
  applyCors,
  defaultElevenModel,
  defaultElevenVoice,
  originAllowed,
  ttsContractMetadata,
} from '../server/tts-policy.mjs';

export default function handler(req, res) {
  applyCors(req, res, 'GET,OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (!originAllowed(req)) return res.status(403).json({ error: 'origin_not_allowed' });
  if (req.method !== 'GET') return res.status(405).json({ error: 'method_not_allowed' });

  const configured = Boolean(process.env.elevenlabs_api_key || process.env.ELEVENLABS_API_KEY);
  res.setHeader('cache-control', 'no-store');
  return res.status(200).json({
    ok: true,
    ...ttsContractMetadata(configured),
    providers: configured ? ['elevenlabs'] : [],
    elevenLabs: {
      configured,
      voice: defaultElevenVoice(),
      voiceLabel: 'Sarah · Reassuring Female · ElevenLabs',
      model: defaultElevenModel(),
      language: 'vi',
    },
    runtime: 'vercel-serverless-api',
    release: process.env.VERCEL_GIT_COMMIT_SHA || '',
  });
}
