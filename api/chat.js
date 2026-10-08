import { markPrivateResponse } from '../lib/private-response.js';
import { canonicalRequestHost } from '../lib/request-host.js';
import { enforceAiQuota } from '../lib/ai-quota.js';
import { generateBrainChat } from '../lib/brain-gateway.js';
import { requestGatewayOidcToken } from '../lib/vercel-ai-gateway.js';

const MAX_SYSTEM = 12000;
const MAX_MESSAGE = 6000;
const MAX_MESSAGES = 40;
const MAX_CONTEXT_CHARS = 36000;
const RESPONSE_BUDGETS = Object.freeze({ short: 450, auto: 1200, detailed: 1800, deep: 2200 });
const DESKTOP_ORIGINS = new Set(['tauri://localhost', 'http://tauri.localhost', 'https://tauri.localhost']);

function requestOrigin(req) {
  return String(req.headers?.origin || '').trim();
}

function requestHost(req) {
  return canonicalRequestHost(req);
}

function originAllowed(req) {
  const origin = requestOrigin(req);
  if (!origin) return String(req.headers?.['sec-fetch-site'] || '') !== 'cross-site';
  if (DESKTOP_ORIGINS.has(origin)) return true;
  const host = requestHost(req);
  return Boolean(host && origin === `https://${host}`);
}

function applyCors(req, res) {
  const origin = requestOrigin(req);
  if (origin && originAllowed(req)) res.setHeader('access-control-allow-origin', origin);
  res.setHeader('access-control-allow-methods', 'POST,OPTIONS');
  res.setHeader('access-control-allow-headers', 'content-type');
  res.setHeader('access-control-max-age', '86400');
  res.setHeader('vary', 'Origin');
}

function normalizeResponseLength(value) {
  return Object.prototype.hasOwnProperty.call(RESPONSE_BUDGETS, value) ? value : 'auto';
}

/** Keep more short voice turns, while bounding total prompt size when answers become long. */
function normalizeMessages(raw) {
  const messages = (Array.isArray(raw) ? raw : [])
    .slice(-MAX_MESSAGES)
    .map((message) => ({
      role: message?.role === 'model' || message?.role === 'assistant' || message?.role === 'mira' ? 'model' : 'user',
      text: String(message?.text || '').slice(0, MAX_MESSAGE),
    }))
    .filter((message) => message.text.trim());

  const selected = [];
  let chars = 0;
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (chars + message.text.length > MAX_CONTEXT_CHARS && selected.length) break;
    selected.push(message);
    chars += message.text.length;
  }
  return selected.reverse();
}

export default async function handler(req, res) {
  markPrivateResponse(res);
  applyCors(req, res);
  if (!originAllowed(req)) return res.status(403).json({ error: 'origin_not_allowed' });
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }

  const system = String(body?.system || '').slice(0, MAX_SYSTEM);
  const messages = normalizeMessages(body?.messages);
  const responseLength = normalizeResponseLength(body?.responseLength);

  if (!messages.length) return res.status(400).json({ error: 'thiếu messages' });
  if (!await enforceAiQuota(req, res, 'brain')) return;

  try {
    const result = await generateBrainChat(system, messages, {
      maxTokens: RESPONSE_BUDGETS[responseLength],
      runtimeOidcToken: requestGatewayOidcToken(req),
    });
    if (!result) {
      return res.status(503).json({
        error: 'server chưa cấu hình Mira Brain provider',
        hint: 'Configure MIRA_BRAIN_PROVIDER=gateway on Vercel with OIDC, or a supported server-side provider key',
      });
    }
    return res.status(200).json({
      text: result.text,
      provider: result.provider,
      model: result.model,
      responseLength,
      fallbacksTried: result.fallbacksTried || [],
    });
  } catch {
    // Upstream errors can embed prompt text or credentials. Never log them.
    console.error('[Mira Brain Gateway] provider chain unavailable');
    return res.status(502).json({
      error: process.env.MIRA_BRAIN_FREE_ONLY === '1'
        ? 'free_models_unavailable' : 'brain_gateway_failed',
    });
  }
}
