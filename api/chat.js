// Vercel serverless: "bộ não" Mira MIỄN PHÍ qua Gemini-flash. Key đọc PHÍA SERVER → không lộ ra browser.
// POST {system, messages:[{role:'user'|'model', text}]} → {text}. Thiếu key → 503 (client tự rớt về demo).
import { generateChat } from '../lib/gemini.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
  const system = (body?.system || '').toString();
  const messages = Array.isArray(body?.messages) ? body.messages : [];
  if (!messages.length) return res.status(400).json({ error: 'thiếu messages' });

  try {
    const text = await generateChat(system, messages, { maxTokens: 400 });
    if (text == null) return res.status(503).json({ error: 'server chưa cấu hình GEMINI key' });
    return res.status(200).json({ text });
  } catch (e) {
    return res.status(502).json({ error: String(e && e.message ? e.message : e).slice(0, 200) });
  }
}
