import { getSql, ensureSchema } from '../lib/db.js';
import { embed, toVectorLiteral } from '../lib/gemini.js';
import { resolveMemoryScope } from '../lib/memory-scope.js';

function parseBody(req) {
  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
  return body && typeof body === 'object' ? body : {};
}

export default async function handler(req, res) {
  const sql = getSql();
  if (!sql) return res.status(503).json({ error: 'chưa cấu hình DATABASE_URL' });

  const body = req.method === 'GET' ? {} : parseBody(req);
  const device = resolveMemoryScope(req, res, req.query?.device || body?.device);

  try {
    await ensureSchema(sql);

    if (req.method === 'GET') {
      const facts = await sql`
        select id, fact, updated_at from user_facts
        where device_id = ${device} order by updated_at desc limit 100`;
      const countRows = await sql`select count(*)::int as count from chat_messages where device_id = ${device}`;
      const messageCount = Number(countRows[0]?.count || 0);

      if ((req.query?.export || '').toString() === '1') {
        const messages = await sql`
          select role, text, created_at from chat_messages
          where device_id = ${device} order by id asc limit 1000`;
        return res.status(200).json({ exportedAt: new Date().toISOString(), facts, messages });
      }
      return res.status(200).json({ facts, messageCount });
    }

    if (req.method === 'PATCH') {
      const id = Number(body?.id);
      const fact = String(body?.fact || '').trim().slice(0, 300);
      if (!Number.isInteger(id) || id <= 0 || !fact) return res.status(400).json({ error: 'id/fact không hợp lệ' });

      let embedding = null;
      try { embedding = await embed(fact, 'RETRIEVAL_DOCUMENT'); } catch { /* keep text editable without embeddings */ }
      if (embedding) {
        await sql`update user_facts set fact = ${fact}, embedding = ${toVectorLiteral(embedding)}::vector, updated_at = now()
          where id = ${id} and device_id = ${device}`;
      } else {
        await sql`update user_facts set fact = ${fact}, updated_at = now()
          where id = ${id} and device_id = ${device}`;
      }
      return res.status(200).json({ ok: true });
    }

    if (req.method === 'DELETE') {
      const id = Number(body?.id);
      if (body?.all === true) {
        await sql`delete from chat_messages where device_id = ${device}`;
        await sql`delete from user_facts where device_id = ${device}`;
        return res.status(200).json({ ok: true, all: true });
      }
      if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'id không hợp lệ' });
      await sql`delete from user_facts where id = ${id} and device_id = ${device}`;
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'method not allowed' });
  } catch (error) {
    return res.status(500).json({ error: String(error?.message || error).slice(0, 200) });
  }
}
