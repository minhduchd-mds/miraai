// Vercel serverless: lưu/đọc lịch sử chat của Mira trên Neon (Postgres).
// Khoá theo "device" (id sinh ở client, lưu localStorage) → mỗi máy/trình duyệt 1 luồng riêng, KHÔNG cần đăng nhập.
// Cần env DATABASE_URL (nối Neon ↔ Vercel). Chưa có → trả 503, client tự chạy bằng bộ nhớ tạm (không vỡ).
import { neon } from '@neondatabase/serverless';

let ensured = false;
async function ensureTable(sql) {
  if (ensured) return;
  await sql`create table if not exists chat_messages (
    id bigserial primary key,
    device_id text not null,
    role text not null,
    text text not null,
    created_at timestamptz not null default now()
  )`;
  await sql`create index if not exists chat_messages_device_idx on chat_messages (device_id, id)`;
  ensured = true;
}

export default async function handler(req, res) {
  const url = process.env.DATABASE_URL;
  if (!url) return res.status(503).json({ error: 'chưa cấu hình DATABASE_URL (nối Neon ↔ Vercel)' });

  const sql = neon(url);
  try {
    await ensureTable(sql);

    if (req.method === 'GET') {
      const device = (req.query?.device || '').toString();
      if (!device) return res.status(400).json({ error: 'thiếu device' });
      // 20 lượt gần nhất, trả theo thứ tự thời gian tăng dần.
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
      await sql`insert into chat_messages (device_id, role, text) values (${device}, ${role}, ${text})`;
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'method not allowed' });
  } catch (e) {
    return res.status(500).json({ error: String(e && e.message ? e.message : e).slice(0, 200) });
  }
}
