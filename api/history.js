import { getSql, ensureSchema } from '../lib/db.js';
import { embed, toVectorLiteral } from '../lib/gemini.js';
import { resolveMemoryScope } from '../lib/memory-scope.js';

export default async function handler(req, res) {
  const sql = getSql();
  if (!sql) return res.status(503).json({ error: 'chưa cấu hình DATABASE_URL (nối Neon ↔ Vercel)' });

  try {
    await ensureSchema(sql);

    if (req.method === 'GET') {
      const device = resolveMemoryScope(req, res, req.query?.device);
      const rows = await sql`
        select role, text from chat_messages
        where device_id = ${device} order by id desc limit 20`;
      return res.status(200).json({ turns: rows.reverse() });
    }

    if (req.method === 'POST') {
      let body = req.body;
      if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
      const device = resolveMemoryScope(req, res, body?.device);
      const role = (body?.role || '').toString();
      const text = (body?.text || '').toString().slice(0, 4000);
      if (!text) return res.status(400).json({ error: 'thiếu text' });
      if (role !== 'user' && role !== 'mira') return res.status(400).json({ error: 'role không hợp lệ' });

      let emb = null;
      let embErr = null;
      try {
        emb = await embed(text, 'RETRIEVAL_DOCUMENT');
      } catch (error) {
        embErr = String(error?.message || error).slice(0, 160);
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
  } catch (error) {
    return res.status(500).json({ error: String(error?.message || error).slice(0, 200) });
  }
}
