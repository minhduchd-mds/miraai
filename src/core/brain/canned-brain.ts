import type { Brain, BrainReply } from '../types';

// Brain demo: không cần API key, chứng minh đủ vòng voice + UI.
// Tính cách Mira: trợ lý audit của Soi, xưng "em", trả lời NGẮN (đề xuất #5 — voice-first).
const RULES: { test: RegExp; reply: () => BrainReply }[] = [
  {
    test: /(xin chào|chào|hế?lô|^hi$|^hey$|mira ơi|mira oi)/i,
    reply: () => ({ text: 'Em đây! Anh cần em giúp gì cho phiên audit hôm nay?', mood: 'happy' }),
  },
  {
    test: /(tóm tắt|tổng hợp|báo cáo).*(audit|phiên|sáng|kết quả)|audit.*(thế nào|sao|ra sao)/i,
    reply: () => ({
      text: 'Phiên sáng nay có ba lỗi nghiêm trọng và mười hai cảnh báo. Em ưu tiên phần lệch màu ở màn Đăng nhập trước nhé.',
      mood: 'neutral',
    }),
  },
  {
    test: /(so sánh|so |đối chiếu).*(figma)|figma/i,
    reply: () => ({
      text: 'Em đang so màn hiện tại với bản Figma. Khác biệt rõ nhất là khoảng cách nút và sắc xanh nhấn lệch một chút.',
      mood: 'curious',
    }),
  },
  {
    test: /(lỗi nghiêm trọng|critical|nghiêm trọng|lỗi nặng)/i,
    reply: () => ({
      text: 'Có ba lỗi nghiêm trọng: tương phản chữ ở form, nút thiếu trạng thái focus, và ảnh nền tải chậm. Anh muốn em đọc chi tiết cái nào?',
      mood: 'thinking',
    }),
  },
  {
    test: /(cảm ơn|cám ơn|thank)/i,
    reply: () => ({ text: 'Dạ không có gì ạ. Anh cứ gọi em bất cứ lúc nào.', mood: 'happy' }),
  },
  {
    test: /(bạn là ai|em là ai|giới thiệu|mira là gì|làm được gì)/i,
    reply: () => ({
      text: 'Em là Mira, trợ lý giọng nói của Soi. Em giúp anh đọc và soát kết quả audit giao diện bằng giọng nói.',
      mood: 'neutral',
    }),
  },
];

function truncate(s: string, n = 60): string {
  return s.length > n ? s.slice(0, n).trim() + '…' : s;
}

export class CannedBrain implements Brain {
  readonly name = 'demo (canned)';

  async reply(input: string): Promise<BrainReply> {
    // Độ trễ "suy nghĩ" giả lập để trạng thái THINKING hiện rõ (cảm giác thật hơn).
    await new Promise((r) => setTimeout(r, 450 + Math.random() * 500));
    const hit = RULES.find((r) => r.test.test(input));
    if (hit) return hit.reply();
    return {
      text: `Em nghe anh nói: “${truncate(input)}”. Bản demo này chưa nối LLM thật — anh cắm API key vào file .env để em trả lời thông minh hơn nhé.`,
      mood: 'curious',
    };
  }
}
