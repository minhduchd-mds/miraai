import { neon } from '@neondatabase/serverless';

// Kết nối Neon (đọc DATABASE_URL phía server). Chưa cấu hình → trả null để endpoint báo 503 gọn.
export function getSql() {
  const url = process.env.DATABASE_URL;
  if (!url) return null;
  return neon(url);
}

let ensured = false;

// Tạo bảng + pgvector + index (idempotent). chat_messages dùng chung cho lịch sử thô VÀ trí nhớ ngữ nghĩa.
export async function ensureSchema(sql) {
  if (ensured) return;
  await sql`create extension if not exists vector`;
  await sql`create table if not exists chat_messages (
    id bigserial primary key,
    device_id text not null,
    role text not null,
    text text not null,
    embedding vector(768),
    created_at timestamptz not null default now()
  )`;
  // Bảng cũ (trước khi có vector) → thêm cột nếu thiếu.
  await sql`alter table chat_messages add column if not exists embedding vector(768)`;
  await sql`create index if not exists chat_messages_device_idx on chat_messages (device_id, id)`;
  // HNSW cho tìm ngữ nghĩa (cosine). pgvector bỏ qua hàng embedding NULL.
  await sql`create index if not exists chat_messages_embed_idx
    on chat_messages using hnsw (embedding vector_cosine_ops)`;

  // Hồ sơ "facts" bền vững về người dùng (mem0-lite): tên, sở thích, mục tiêu, hoàn cảnh...
  await sql`create table if not exists user_facts (
    id bigserial primary key,
    device_id text not null,
    fact text not null,
    embedding vector(768),
    updated_at timestamptz not null default now()
  )`;
  await sql`create index if not exists user_facts_device_idx on user_facts (device_id, id)`;
  await sql`create index if not exists user_facts_embed_idx
    on user_facts using hnsw (embedding vector_cosine_ops)`;
  ensured = true;
}
