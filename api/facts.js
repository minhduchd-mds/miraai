import { getSql, ensureSchema } from '../lib/db.js';
import { embed, toVectorLiteral, generateJson } from '../lib/gemini.js';
import { resolveMemoryScope } from '../lib/memory-scope.js';

const DISTILL_PROMPT = `Bạn trích "sự thật BỀN VỮNG" về NGƯỜI DÙNG từ đoạn hội thoại (tiếng Việt) với trợ lý Mira.
Chỉ lấy thông tin lâu dài đáng nhớ: tên, tuổi, công việc, sở thích, mục tiêu, hoàn cảnh, quan hệ, thói quen, điều thích/ghét.
BỎ QUA chuyện vặt/nhất thời. Nếu không có gì đáng nhớ → mảng rỗng.
Mỗi fact: 1 câu NGẮN, ngôi thứ ba. Trả JSON đúng dạng: {"facts": ["...", "..."]}`;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });
  const sql = getSql();
  if (!sql) return res.status(503).json({ error: 'chưa cấu hình DATABASE_URL' });

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
  const device = resolveMemoryScope(req, res, body?.device);
  const conversation = (body?.conversation || '').toString().slice(0, 8000);
  if (!conversation) return res.status(400).json({ error: 'thiếu conversation' });

  try {
    await ensureSchema(sql);
    let parsed = null;
    try {
      parsed = await generateJson(`${DISTILL_PROMPT}\n\n--- HỘI THOẠI ---\n${conversation}`);
    } catch (error) {
      return res.status(502).json({ error: 'gemini gen lỗi: ' + String(error?.message || error).slice(0, 140) });
    }

    const facts = Array.isArray(parsed?.facts)
      ? parsed.facts.filter((fact) => typeof fact === 'string' && fact.trim())
      : [];
    if (!facts.length) return res.status(200).json({ added: 0, facts: [] });

    const added = [];
    for (const fact of facts.slice(0, 5)) {
      const text = fact.trim().slice(0, 300);
      let embedding;
      try {
        embedding = await embed(text, 'RETRIEVAL_DOCUMENT');
      } catch {
        continue;
      }
      if (!embedding) continue;
      const vector = toVectorLiteral(embedding);
      const duplicate = await sql`
        select id from user_facts
        where device_id = ${device} and embedding is not null and (embedding <=> ${vector}::vector) < 0.12
        limit 1`;
      if (duplicate.length) {
        await sql`update user_facts set updated_at = now() where id = ${duplicate[0].id}`;
        continue;
      }
      await sql`insert into user_facts (device_id, fact, embedding) values (${device}, ${text}, ${vector}::vector)`;
      added.push(text);
    }
    return res.status(200).json({ added: added.length, facts: added });
  } catch (error) {
    return res.status(500).json({ error: String(error?.message || error).slice(0, 200) });
  }
}
