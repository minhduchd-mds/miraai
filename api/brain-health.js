import { markPrivateResponse } from '../lib/private-response.js';
import { providerOrder } from '../lib/brain-gateway.js';
import { requestGatewayOidcToken, gatewayModels } from '../lib/vercel-ai-gateway.js';
import {freeRouterSnapshot} from '../lib/free-model-router.js';
import { applyCors, originAllowed } from '../server/tts-policy.mjs';
import { liveModel } from '../lib/live-token.js';

/** Configuration readiness only: never executes a paid model request. */
export default function handler(req, res) {
  applyCors(req, res, 'GET,OPTIONS');
  markPrivateResponse(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (!originAllowed(req)) return res.status(403).json({ error: 'origin_not_allowed' });
  if (req.method !== 'GET') return res.status(405).json({ error: 'method_not_allowed' });
  const providers = providerOrder({ runtimeOidcToken: requestGatewayOidcToken(req) });
  const routing = process.env.MIRA_BRAIN_AUTO_ROUTER === '1' ? freeRouterSnapshot() : null;
  // A fresh catalogue with zero usable free models means chat WILL fail: never report ok.
  // A stale/unfetched catalogue is reported as unverified rather than healthy.
  const routingDead = Boolean(routing && routing.catalogFresh && routing.available === 0);
  const routingUnverified = Boolean(routing && !routing.catalogFresh);
  const status = !providers.length ? 'unconfigured'
    : routingDead ? 'no_models_available'
      : routingUnverified ? 'configured_unverified' : 'configured';
  return res.status(200).json({
    ok: providers.length > 0 && !routingDead,
    configured: providers.length > 0,
    status,
    providers,
    freeOnly: process.env.MIRA_BRAIN_FREE_ONLY === '1',
    gatewayModels: providers.includes('gateway') ? gatewayModels() : [],
    autoModelRouting: process.env.MIRA_BRAIN_FREE_ONLY === '1' && process.env.MIRA_BRAIN_AUTO_ROUTER === '1',
    routing,
    // Mira Live readiness (configuration only; a token is minted only on POST /api/chat?route=live-token).
    live: {
      configured: Boolean(String(process.env.GEMINI_API_KEY || '').trim()) && process.env.MIRA_LIVE_DISABLED !== '1',
      model: liveModel(),
    },
    inferenceVerified: false,
    // Readiness is NOT proof of a successful LLM response.
    scope: 'configuration_only',
  });
}
