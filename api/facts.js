// Vercel serverless: chắt lọc "facts" bền vững về người dùng (mem0-lite) — TOÀN BỘ bằng Gemini FREE.
// POST {device, conversation} → Gemini trích facts → embed → khử trùng (cosine>0.88 thì bỏ) → lưu user_facts.
// Fire-and-forget từ client; lỗi/thiếu key → bỏ qua, không ảnh hưởng chat.
import { getSql, ensureSchema } from '../lib/db.js';
import { embed, toVectorLiteral, generateJson } from '../lib/gemini.js';

const DISTILL_PROMPT = `Bạn trích "sự thật BỀN VỮNG" về NGƯỜI DÙNG từ đoạn hội thoại (tiếng Việt) với trợ lý Mira.
Chỉ lấy thông tin lâu dài đáng nhớ: tên, tuổi, công việc, sở thích, mục tiêu, hoàn cảnh, quan hệ, thói quen, điều thích/ghét.
BỎ QUA chuyện vặt/nhất thời (thời tiết hôm nay, câu xã giao). Nếu không có gì đáng nhớ → mảng rỗng.
Mỗi fact: 1 câu NGẮN, ngôi thứ ba, vd "Tên là Đức", "Làm Business Analyst", "Thích cà phê sữa đá".
Trả JSON đúng dạng: {"facts": ["...", "..."]}`;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });
  const sql = getSql();
  if (!sql) return res.status(503).json({ error: 'chưa cấu hình DATABASE_URL' });

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
  const device = (body?.device || '').toString();
  const conversation = (body?.conversation || '').toString().slice(0, 8000);
  if (!device || !conversation) return res.status(400).json({ error: 'thiếu device/conversation' });

  try {
    await ensureSchema(sql);

    let parsed = null;
    try {
      parsed = await generateJson(`${DISTILL_PROMPT}\n\n--- HỘI THOẠI ---\n${conversation}`);
    } catch (e) {
      return res.status(502).json({ error: 'gemini gen lỗi: ' + String(e?.message || e).slice(0, 140) });
    }
    const facts = Array.isArray(parsed?.facts) ? parsed.facts.filter((f) => typeof f === 'string' && f.trim()) : [];
    if (!facts.length) return res.status(200).json({ added: 0, facts: [] });

    const added = [];
    for (const fact of facts.slice(0, 5)) {
      const text = fact.trim().slice(0, 300);
      let emb;
      try {
        emb = await embed(text, 'RETRIEVAL_DOCUMENT');
      } catch {
        continue; // embed lỗi → bỏ fact này
      }
      if (!emb) continue;
      const vec = toVectorLiteral(emb);
      // Khử trùng: đã có fact gần nghĩa (cosine > 0.88 ↔ distance < 0.12) → bỏ, chỉ chạm updated_at.
      const dup = await sql`
        select id from user_facts
        where device_id = ${device} and embedding is not null and (embedding <=> ${vec}::vector) < 0.12
        limit 1`;
      if (dup.length) {
        await sql`update user_facts set updated_at = now() where id = ${dup[0].id}`;
        continue;
      }
      await sql`insert into user_facts (device_id, fact, embedding) values (${device}, ${text}, ${vec}::vector)`;
      added.push(text);
    }
    return res.status(200).json({ added: added.length, facts: added });
  } catch (e) {
    return res.status(500).json({ error: String(e?.message || e).slice(0, 200) });
  }
}
