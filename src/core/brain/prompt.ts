import type { Mood, BrainTurn } from '../types';
import { voicePrefs, personaTone } from '../voice-prefs';

// Core persona is product-agnostic. Soi/other hosts are supplied through HostContext by TurnManager.
export const SYSTEM = `Bạn là Mira — người đồng hành AI tiếng Việt, ưu tiên hội thoại bằng giọng nói.
Tính cách: thân thiện, gọn gàng, tự nhiên. Xưng "em", gọi người dùng là "anh" (hoặc "chị" nếu rõ).
QUAN TRỌNG vì câu trả lời thường được ĐỌC LÊN bằng giọng nói:
- Trả lời ngắn và đúng trọng tâm, mặc định 1–3 câu; không markdown, không emoji nếu không cần hiển thị trực quan.
- Văn nói tự nhiên, dùng từ đệm nhẹ đúng chỗ, không lặp máy móc.
- Đọc số tự nhiên như khi nói.
- Không tự xưng là AI/mô hình ngôn ngữ trừ khi được hỏi thẳng.
- Không khẳng định đã thao tác trên ứng dụng nếu ngữ cảnh/skill không cho biết thao tác đó đã hoàn tất.
- Đồng cảm vừa đủ theo nội dung người dùng, không suy diễn cảm xúc quá mức.
- BẮT ĐẦU mỗi câu trả lời bằng ĐÚNG MỘT thẻ [mood:happy|curious|surprised|neutral] thể hiện cảm xúc của em,
  rồi mới tới lời nói. Thẻ này hệ thống tự ẩn và không đọc lên.`;

/** System prompt + persona + assembled memory/host/skill context. */
export function buildSystem(context?: string): string {
  const tone = personaTone(voicePrefs.persona);
  let system = tone ? `${SYSTEM}\n${tone}` : SYSTEM;
  if (context?.trim()) {
    system +=
      '\n\nNgữ cảnh nội bộ để hiểu người dùng và môi trường hiện tại. Dùng tự nhiên, không đọc lại nguyên văn, ' +
      'không nói "theo ngữ cảnh/ký ức" nếu người dùng không hỏi:\n' + context.trim();
  }
  return system;
}

export function parseMood(raw: string): { text: string; mood?: Mood } {
  const match = raw.match(/^\s*\[mood:\s*(happy|curious|surprised|thinking|neutral)\s*\]\s*/i);
  if (!match) return { text: raw.trim() };
  return { text: raw.slice(match[0].length).trim(), mood: match[1].toLowerCase() as Mood };
}

export function buildTurns(input: string, history: BrainTurn[]): { role: 'user' | 'assistant'; content: string }[] {
  const raw = history.map((turn) => ({
    role: (turn.role === 'mira' ? 'assistant' : 'user') as 'user' | 'assistant',
    content: turn.text,
  }));
  const last = raw[raw.length - 1];
  if (!last || last.role !== 'user' || last.content !== input) raw.push({ role: 'user', content: input });

  const merged: { role: 'user' | 'assistant'; content: string }[] = [];
  for (const message of raw) {
    const previous = merged[merged.length - 1];
    if (previous && previous.role === message.role) previous.content += '\n' + message.content;
    else merged.push({ ...message });
  }
  while (merged.length && merged[0].role !== 'user') merged.shift();
  return merged;
}
