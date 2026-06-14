// Vercel serverless: TRUY HỒI ký ức ngữ nghĩa cho Mira.
// GET /api/memory?device=<id>&q=<câu hỏi> → embed câu hỏi → tìm top-k lượt cũ gần nghĩa nhất (cosine, pgvector).
// Dùng để "mồi" ngữ cảnh cho não → Mira nhớ đúng chuyện liên quan dù ở phiên trước.
import { getSql, ensureSchema } from '../lib/db.js';
import { embed, toVectorLiteral } from '../lib/gemini.js';

export default async function handler(req, res) {
  const sql = getSql();
  if (!sql) return res.status(503).json({ error: 'chưa cấu hình DATABASE_URL' });
  if (req.method !== 'GET') return res.status(405).json({ error: 'method not allowed' });

  const device = (req.query?.device || '').toString();
  const q = (req.query?.q || '').toString().trim();
  if (!device || !q) return res.status(400).json({ error: 'thiếu device/q' });

  try {
    await ensureSchema(sql);

    let qv = null;
    try {
      qv = await embed(q, 'RETRIEVAL_QUERY');
    } catch (e) {
      return res.status(502).json({ error: 'embed lỗi: ' + String(e && e.message ? e.message : e).slice(0, 160) });
    }
    if (!qv) return res.status(200).json({ memories: [] }); // không có key embedding → bỏ qua truy hồi ngữ nghĩa

    const vec = toVectorLiteral(qv);
    const rows = await sql`
      select role, text, 1 - (embedding <=> ${vec}::vector) as score
      from chat_messages
      where device_id = ${device} and embedding is not null
      order by embedding <=> ${vec}::vector
      limit 6`;
    return res.status(200).json({ memories: rows });
  } catch (e) {
    return res.status(500).json({ error: String(e && e.message ? e.message : e).slice(0, 200) });
  }
}
