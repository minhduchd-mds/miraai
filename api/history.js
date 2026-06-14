// Vercel serverless: lưu/đọc lịch sử chat của Mira trên Neon (Postgres).
// Khoá theo "device" (id sinh ở client) → mỗi máy 1 luồng riêng, KHÔNG cần đăng nhập.
// POST còn tính EMBEDDING (Gemini) để dùng cho trí nhớ ngữ nghĩa (/api/memory). Thiếu key/DB → vẫn chạy thô.
import { getSql, ensureSchema } from '../lib/db.js';
import { embed, toVectorLiteral } from '../lib/gemini.js';

export default async function handler(req, res) {
  const sql = getSql();
  if (!sql) return res.status(503).json({ error: 'chưa cấu hình DATABASE_URL (nối Neon ↔ Vercel)' });

  try {
    await ensureSchema(sql);

    if (req.method === 'GET') {
      const device = (req.query?.device || '').toString();
      if (!device) return res.status(400).json({ error: 'thiếu device' });
      const rows = await sql`
        select role, text from chat_messages
        where device_id = ${device} order by id desc limit 20`;
      return res.status(200).json({ turns: rows.reverse() });
    }

    if (req.method === 'POST') {
      let body = req.body;
      if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
      const device = (body?.device || '').toString();
      const role = (body?.role || '').toString();
      const text = (body?.text || '').toString().slice(0, 4000);
      if (!device || !text) return res.status(400).json({ error: 'thiếu device/text' });
      if (role !== 'user' && role !== 'mira') return res.status(400).json({ error: 'role không hợp lệ' });

      // Embedding (best-effort): lỗi/thiếu key → vẫn lưu lượt (embedding NULL).
      let emb = null;
      let embErr = null;
      try {
        emb = await embed(text, 'RETRIEVAL_DOCUMENT');
      } catch (e) {
        embErr = String(e && e.message ? e.message : e).slice(0, 160);
      }

      if (emb) {
        await sql`insert into chat_messages (device_id, role, text, embedding)
          values (${device}, ${role}, ${text}, ${toVectorLiteral(emb)}::vector)`;
      } else {
        await sql`insert into chat_messages (device_id, role, text)
          values (${device}, ${role}, ${text})`;
      }
      return res.status(200).json({ ok: true, embedded: !!emb, ...(embErr ? { embErr } : {}) });
    }

    return res.status(405).json({ error: 'method not allowed' });
  } catch (e) {
    return res.status(500).json({ error: String(e && e.message ? e.message : e).slice(0, 200) });
  }
}
