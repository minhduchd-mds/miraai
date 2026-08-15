import { generateBrainChat } from '../lib/brain-gateway.js';

const MAX_SYSTEM = 12000;
const MAX_MESSAGE = 6000;
const MAX_MESSAGES = 40;
const MAX_CONTEXT_CHARS = 36000;
const RESPONSE_BUDGETS = Object.freeze({ short: 450, auto: 1200, detailed: 1800, deep: 2200 });

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
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }

  const system = String(body?.system || '').slice(0, MAX_SYSTEM);
  const messages = normalizeMessages(body?.messages);
  const responseLength = normalizeResponseLength(body?.responseLength);

  if (!messages.length) return res.status(400).json({ error: 'thiếu messages' });

  try {
    const result = await generateBrainChat(system, messages, { maxTokens: RESPONSE_BUDGETS[responseLength] });
    if (!result) {
      return res.status(503).json({
        error: 'server chưa cấu hình Mira Brain provider',
        hint: 'Set GEMINI_API_KEY or OPENAI_API_KEY+OPENAI_MODEL or ANTHROPIC_API_KEY+ANTHROPIC_MODEL',
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
    console.error('[Mira Brain Gateway]', error);
    return res.status(502).json({ error: String(error?.message || error).slice(0, 300) });
  }
}
