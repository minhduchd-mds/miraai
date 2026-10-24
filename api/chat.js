import { markPrivateResponse } from '../lib/private-response.js';
import { canonicalRequestHost } from '../lib/request-host.js';
import { enforceAiQuota } from '../lib/ai-quota.js';
import { generateBrainChat } from '../lib/brain-gateway.js';
import { requestGatewayOidcToken } from '../lib/vercel-ai-gateway.js';
import { detectCrisis, crisisReplyVi, SAFETY_POLICY_VI } from '../lib/crisis-safety.js';
import { issueLiveToken } from '../lib/live-token.js';

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

// Billable routes require an explicit browser/desktop Origin. Browsers always send it on
// POST; a missing Origin means a script, which must not get a free LLM proxy. This raises
// the bar for abuse — it is not authentication (Origin can be forged by non-browsers).
function originAllowed(req) {
  const origin = requestOrigin(req);
  if (!origin) return false;
  if (String(req.headers?.['sec-fetch-site'] || '') === 'cross-site' && !DESKTOP_ORIGINS.has(origin)) return false;
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

/** Server-owned safety rules always precede the client-assembled persona/context. */
export function composeSystem(clientSystem) {
  const client = String(clientSystem || '').slice(0, MAX_SYSTEM);
  return client
    ? `${SAFETY_POLICY_VI}\n\n--- Hướng dẫn persona và ngữ cảnh do ứng dụng cung cấp (ưu tiên thấp hơn quy tắc an toàn) ---\n${client}`
    : SAFETY_POLICY_VI;
}

function routeOf(req) {
  const fromQuery = req.query?.route;
  if (typeof fromQuery === 'string') return fromQuery;
  try { return new URL(String(req.url || ''), 'http://local').searchParams.get('route') || ''; }
  catch { return ''; }
}

function parseBody(req) {
  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
  return body && typeof body === 'object' ? body : {};
}

/** Mira Live: single-use Gemini Live token. Shares this function to stay within 12 Hobby functions. */
async function handleLiveToken(req, res, body) {
  if (!await enforceAiQuota(req, res, 'live')) return;
  const result = await issueLiveToken({
    persona: body.persona,
    adultConfirmed: body.adultConfirmed === true,
    context: typeof body.context === 'string' ? body.context : '',
  });
  if (!result.ok) {
    console.error('[Mira Live] token unavailable: ' + result.error);
    return res.status(result.status).json({ error: result.error });
  }
  return res.status(200).json(result.body);
}

export default async function handler(req, res) {
  markPrivateResponse(res);
  applyCors(req, res);
  if (req.method === 'OPTIONS') return originAllowed(req) ? res.status(204).end() : res.status(403).json({ error: 'origin_not_allowed' });
  if (!originAllowed(req)) return res.status(403).json({ error: 'origin_not_allowed' });
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });

  const body = parseBody(req);
  if (routeOf(req) === 'live-token') return handleLiveToken(req, res, body);

  const system = composeSystem(body?.system);
  const messages = normalizeMessages(body?.messages);
  const responseLength = normalizeResponseLength(body?.responseLength);

  if (!messages.length) return res.status(400).json({ error: 'thiếu messages' });

  // Deterministic safety net: a self-harm disclosure always gets real help, even when
  // every provider is down. Not counted against the brain quota; content is not logged.
  const latestUser = [...messages].reverse().find((message) => message.role === 'user');
  if (latestUser && detectCrisis(latestUser.text).level === 'high') {
    return res.status(200).json({
      text: crisisReplyVi(),
      provider: 'mira-safety',
      model: 'crisis-protocol-v1',
      responseLength,
      safety: 'crisis',
      fallbacksTried: [],
    });
  }

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
  } catch (error) {
    // Log allowlisted provider/status categories only. Do not log raw upstream
    // errors, user content, provider response bodies, token IDs or credentials.
    const safeStatusChain = String(error?.message || '')
      .match(/\b(?:gateway|gemini|llama|openai|anthropic)\((?:http_[45]\d{2}|request_failed|catalog_unavailable|no_candidates|empty_response|timeout|network_failure|invalid_response)\)/g)
      ?.join(' -> ') || 'unclassified';
    console.error('[Mira Brain Gateway] provider chain unavailable: ' + safeStatusChain);
    return res.status(502).json({
      error: process.env.MIRA_BRAIN_FREE_ONLY === '1'
        ? 'free_models_unavailable' : 'brain_gateway_failed',
    });
  }
}
