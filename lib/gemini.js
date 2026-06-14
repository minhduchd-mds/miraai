// Embedding qua Gemini (gemini-embedding-001) — dùng cho trí nhớ ngữ nghĩa của Mira.
// Key đọc PHÍA SERVER (Vercel env). Nhận nhiều tên env phổ biến để khỏi lệ thuộc cách user đặt.
// Trả vector 768 chiều (cắt MRL) để index được trên pgvector. Dùng cosine → không cần chuẩn hoá lại.
const EMBED_DIM = 768;

function apiKey() {
  return (
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    process.env.GOOGLE_GENERATIVE_AI_API_KEY ||
    process.env.GEMINI_KEY ||
    null
  );
}

// taskType: 'RETRIEVAL_DOCUMENT' khi lưu, 'RETRIEVAL_QUERY' khi tìm. Không key → trả null (bỏ qua, không vỡ).
export async function embed(text, taskType = 'RETRIEVAL_DOCUMENT') {
  const key = apiKey();
  if (!key) return null;
  const r = await fetch(
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent',
    {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        content: { parts: [{ text: String(text).slice(0, 8000) }] },
        taskType,
        outputDimensionality: EMBED_DIM,
      }),
    },
  );
  if (!r.ok) throw new Error(`Gemini embed ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const j = await r.json();
  const values = j?.embedding?.values || j?.embeddings?.[0]?.values;
  if (!Array.isArray(values) || values.length !== EMBED_DIM) {
    throw new Error(`embedding dim bất thường: ${Array.isArray(values) ? values.length : 'null'}`);
  }
  return values;
}

// Sinh JSON bằng Gemini-flash (free tier) — dùng để chắt lọc "facts" về người dùng. Không key → null.
export async function generateJson(prompt, { maxTokens = 400 } = {}) {
  const key = apiKey();
  if (!key) return null;
  const model = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
  const r = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        contents: [{ parts: [{ text: String(prompt).slice(0, 12000) }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: maxTokens, responseMimeType: 'application/json' },
      }),
    },
  );
  if (!r.ok) throw new Error(`Gemini gen ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const j = await r.json();
  const txt = (j?.candidates?.[0]?.content?.parts || []).map((p) => p?.text || '').join('').trim();
  try {
    return JSON.parse(txt);
  } catch {
    return null;
  }
}

// pgvector nhận literal dạng '[0.1,0.2,...]' (kèm cast ::vector trong câu SQL).
export function toVectorLiteral(values) {
  return '[' + values.join(',') + ']';
}

export const HAS_EMBED_KEY = !!apiKey();
