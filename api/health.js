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

export default function handler(req, res) {
  applyCors(req, res);

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
  res.setHeader('x-content-type-options', 'nosniff');
  return res.status(200).json({
    ok: true,
    configured: configuredProviders.length > 0,
    provider: configuredProviders.length === 1 ? configuredProviders[0] : configuredProviders.length > 1 ? 'multi' : 'none',
    providers: configuredProviders,
    runtime: 'serverless-api',
  });
}
