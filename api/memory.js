import { getSql, ensureSchema } from '../lib/db.js';
import { embed, toVectorLiteral } from '../lib/gemini.js';
import { resolveMemoryScope } from '../lib/memory-scope.js';

export default async function handler(req, res) {
  const sql = getSql();
  if (!sql) return res.status(503).json({ error: 'chưa cấu hình DATABASE_URL' });
  if (req.method !== 'GET') return res.status(405).json({ error: 'method not allowed' });

  const q = (req.query?.q || '').toString().trim();
  if (!q) return res.status(400).json({ error: 'thiếu q' });
  const device = resolveMemoryScope(req, res, req.query?.device);

  try {
    await ensureSchema(sql);
    let queryVector = null;
    try {
      queryVector = await embed(q, 'RETRIEVAL_QUERY');
    } catch (error) {
      return res.status(502).json({ error: 'embed lỗi: ' + String(error?.message || error).slice(0, 160) });
    }
    if (!queryVector) return res.status(200).json({ memories: [], facts: [] });

    const vector = toVectorLiteral(queryVector);
    const memories = await sql`
      select role, text, 1 - (embedding <=> ${vector}::vector) as score
      from chat_messages
      where device_id = ${device} and embedding is not null
      order by embedding <=> ${vector}::vector
      limit 6`;
    const facts = await sql`
      select fact, 1 - (embedding <=> ${vector}::vector) as score
      from user_facts
      where device_id = ${device} and embedding is not null
      order by embedding <=> ${vector}::vector
      limit 5`;
    return res.status(200).json({ memories, facts });
  } catch (error) {
    return res.status(500).json({ error: String(error?.message || error).slice(0, 200) });
  }
}
