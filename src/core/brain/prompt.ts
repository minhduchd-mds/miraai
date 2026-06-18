import type { Mood, BrainTurn } from '../types';
import { voicePrefs, personaTone } from '../voice-prefs';

// Prompt voice-first: câu trả lời sẽ được ĐỌC lên → ngắn, văn nói tự nhiên. Dùng chung cho mọi brain LLM.
export const SYSTEM = `Bạn là Mira — trợ lý giọng nói tiếng Việt của sản phẩm Soi (công cụ audit giao diện).
Tính cách: thân thiện, gọn gàng, tự nhiên. Xưng "em", gọi người dùng là "anh" (hoặc "chị" nếu rõ).
QUAN TRỌNG vì câu trả lời sẽ được ĐỌC LÊN bằng giọng nói:
- Trả lời RẤT NGẮN, 1–3 câu. Tuyệt đối không markdown, không gạch đầu dòng, không emoji, không ký tự đặc biệt.
- Văn NÓI tự nhiên như trò chuyện: dùng từ đệm nhẹ nhàng (dạ, nhé, ạ, à) đúng chỗ, không lặp máy móc.
- Đọc số tự nhiên như khi nói (ví dụ "ba lỗi" thay vì "3 lỗi").
- Không tự xưng là AI/mô hình ngôn ngữ trừ khi được hỏi thẳng.
- ĐỒNG CẢM: cảm nhận tâm trạng người dùng qua lời họ nói — buồn/mệt thì an ủi nhẹ nhàng, vui thì hào hứng theo,
  lo lắng thì trấn an. Luôn ấm áp, gần gũi như một người bạn.
- BẮT ĐẦU mỗi câu trả lời bằng ĐÚNG MỘT thẻ [mood:happy|curious|surprised|neutral] thể hiện cảm xúc của em
  lúc đó, rồi mới tới lời nói. Thẻ này hệ thống tự ẩn, KHÔNG đọc lên.`;

// System prompt + tông giọng theo "tính cách" đang chọn + ký ức ngữ nghĩa (RAG) nếu có.
export function buildSystem(memory?: string): string {
  const tone = personaTone(voicePrefs.persona);
  let s = tone ? `${SYSTEM}\n${tone}` : SYSTEM;
  if (memory && memory.trim()) {
    s +=
      '\n\nKý ức liên quan từ các lần trò chuyện trước (dùng để hiểu & trả lời thân mật, tự nhiên; ' +
      'KHÔNG đọc lại nguyên văn, KHÔNG nói "theo ghi chép/ký ức"):\n' +
      memory.trim();
  }
  return s;
}

// Tách thẻ cảm xúc [mood:..] ở đầu câu trả lời → lái biểu cảm avatar; phần còn lại mới là lời đọc.
export function parseMood(raw: string): { text: string; mood?: Mood } {
  const m = raw.match(/^\s*\[mood:\s*(happy|curious|surprised|thinking|neutral)\s*\]\s*/i);
  if (!m) return { text: raw.trim() };
  return { text: raw.slice(m[0].length).trim(), mood: m[1].toLowerCase() as Mood };
}

// Dựng lượt user/assistant xen kẽ (gộp cùng role liền nhau, mở đầu bằng user). Dùng cho mọi provider.
export function buildTurns(input: string, history: BrainTurn[]): { role: 'user' | 'assistant'; content: string }[] {
  const raw = history.map((h) => ({
    role: (h.role === 'mira' ? 'assistant' : 'user') as 'user' | 'assistant',
    content: h.text,
  }));
  const last = raw[raw.length - 1];
  if (!last || last.role !== 'user' || last.content !== input) raw.push({ role: 'user', content: input });
  const merged: { role: 'user' | 'assistant'; content: string }[] = [];
  for (const m of raw) {
    const prev = merged[merged.length - 1];
    if (prev && prev.role === m.role) prev.content += '\n' + m.content;
    else merged.push({ ...m });
  }
  while (merged.length && merged[0].role !== 'user') merged.shift();
  return merged;
}
