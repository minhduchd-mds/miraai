import type { Brain, BrainReply, BrainTurn } from '../types';

const RULES: { test: RegExp; reply: () => BrainReply }[] = [
  {
    test: /(xin chào|chào|hế?lô|^hi$|^hey$|mira ơi|mira oi)/i,
    reply: () => ({ text: 'Em đây. Anh cứ nói tự nhiên nhé.', mood: 'happy' }),
  },
  {
    test: /(cảm ơn|cám ơn|thank)/i,
    reply: () => ({ text: 'Dạ. Em vẫn ở đây.', mood: 'happy' }),
  },
  {
    test: /(bạn là ai|em là ai|mira là gì|giới thiệu)/i,
    reply: () => ({
      text: 'Em là Mira, người đồng hành giọng nói chạy cùng anh trên trình duyệt. Em có voice loop, memory cục bộ, camera nhận diện cử chỉ và có thể chạy bộ não local khi máy hỗ trợ WebGPU.',
      mood: 'neutral',
    }),
  },
  {
    test: /(làm được gì|chức năng|tính năng)/i,
    reply: () => ({
      text: 'Em có thể nghe và nói liên tục, ghi nhớ cục bộ, nhận diện tay và nét mặt, điều chỉnh cách nói theo tín hiệu biểu cảm, và chạy mô hình ngôn ngữ local nếu thiết bị hỗ trợ.',
      mood: 'curious',
    }),
  },
];

function truncate(text: string, max = 90): string {
  return text.length > max ? text.slice(0, max).trim() + '…' : text;
}

export class CannedBrain implements Brain {
  readonly name = 'Mira Brain · lightweight fallback';

  async reply(input: string, _history?: BrainTurn[], _context?: string): Promise<BrainReply> {
    const hit = RULES.find((rule) => rule.test.test(input));
    if (hit) return hit.reply();
    return {
      text: 'Em nghe anh nói: “' + truncate(input) + '”. Máy hiện chưa chạy được bộ não WebGPU nên em đang ở chế độ nhẹ; voice, memory và vision vẫn hoạt động.',
      mood: 'curious',
    };
  }
}
