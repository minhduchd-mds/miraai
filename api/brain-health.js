import { markPrivateResponse } from '../lib/private-response.js';
import { providerOrder } from '../lib/brain-gateway.js';
import { requestGatewayOidcToken, gatewayModels } from '../lib/vercel-ai-gateway.js';
import {freeRouterSnapshot} from '../lib/free-model-router.js';
import { applyCors, originAllowed } from '../server/tts-policy.mjs';

/** Configuration readiness only: never executes a paid model request. */
export default function handler(req, res) {
  applyCors(req, res, 'GET,OPTIONS');
  markPrivateResponse(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (!originAllowed(req)) return res.status(403).json({ error: 'origin_not_allowed' });
  if (req.method !== 'GET') return res.status(405).json({ error: 'method_not_allowed' });
  const providers = providerOrder({ runtimeOidcToken: requestGatewayOidcToken(req) });
  return res.status(200).json({
    ok: true,
    configured: providers.length > 0,
    status: providers.length ? 'configured' : 'unconfigured',
    providers,
    freeOnly: process.env.MIRA_BRAIN_FREE_ONLY === '1',
    gatewayModels: providers.includes('gateway') ? gatewayModels() : [],
    autoModelRouting: process.env.MIRA_BRAIN_FREE_ONLY === '1' && process.env.MIRA_BRAIN_AUTO_ROUTER === '1',
    routing: process.env.MIRA_BRAIN_AUTO_ROUTER === '1' ? freeRouterSnapshot() : null,
    inferenceVerified: false,
    // Readiness is NOT proof of a successful LLM response.
    scope: 'configuration_only',
  });
}
