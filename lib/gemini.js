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
// Thử lần lượt vài model flash free: nếu model nào 429 (hết quota) thì rớt sang model nhẹ hơn.
export async function generateJson(prompt, { maxTokens = 400 } = {}) {
  const key = apiKey();
  if (!key) return null;
  const models = process.env.GEMINI_MODEL
    ? [process.env.GEMINI_MODEL]
    : ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.0-flash-lite', 'gemini-2.0-flash'];
  let last = '';
  for (const model of models) {
    const cfg = { temperature: 0.2, maxOutputTokens: maxTokens, responseMimeType: 'application/json' };
    // Model 2.5 mặc định "thinking" → ăn hết token output (trả rỗng). Tắt đi để có JSON thật.
    if (model.startsWith('gemini-2.5')) cfg.thinkingConfig = { thinkingBudget: 0 };
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify({ contents: [{ parts: [{ text: String(prompt).slice(0, 12000) }] }], generationConfig: cfg }),
      },
    );
    if (!r.ok) { last = `${r.status} (${model})`; continue; } // 429/400/404… → thử model khác
    const j = await r.json();
    let txt = (j?.candidates?.[0]?.content?.parts || []).map((p) => p?.text || '').join('').trim();
    txt = txt.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim(); // bóc fence nếu có
    if (!txt) { last = `empty (${model})`; continue; }
    try { return JSON.parse(txt); } catch { last = `parse-fail (${model})`; continue; }
  }
  throw new Error(`Gemini gen thất bại mọi model: ${last}`);
}

// pgvector nhận literal dạng '[0.1,0.2,...]' (kèm cast ::vector trong câu SQL).
export function toVectorLiteral(values) {
  return '[' + values.join(',') + ']';
}

export const HAS_EMBED_KEY = !!apiKey();
