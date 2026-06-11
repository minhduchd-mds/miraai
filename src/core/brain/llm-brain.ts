import type { Brain, BrainReply, BrainTurn } from '../types';

// Prompt voice-first (đề xuất #5): câu trả lời sẽ được ĐỌC lên → phải ngắn, không markdown.
const SYSTEM = `Bạn là Mira — trợ lý giọng nói tiếng Việt của sản phẩm Soi (công cụ audit giao diện).
Tính cách: thân thiện, gọn gàng, tự nhiên. Xưng "em", gọi người dùng là "anh" (hoặc "chị" nếu rõ).
QUAN TRỌNG vì câu trả lời sẽ được ĐỌC LÊN bằng giọng nói:
- Trả lời RẤT NGẮN, 1–3 câu. Tuyệt đối không markdown, không gạch đầu dòng, không emoji, không liệt kê dài.
- Đọc số tự nhiên như khi nói (ví dụ "ba lỗi" thay vì "3 lỗi").
- Nói như đang trò chuyện trực tiếp.`;

// "Bộ não" thật qua LLM. CHỈ dùng dev cục bộ — gọi trực tiếp từ browser sẽ lộ key.
// Production: chuyển sang server/edge proxy (§12).
export class LLMBrain implements Brain {
  readonly name: string;

  constructor(
    private provider: 'anthropic' | 'openai',
    private apiKey: string,
    private model: string,
  ) {
    this.name = `LLM · ${provider} · ${model}`;
    console.warn(
      '[Mira] LLMBrain gọi LLM trực tiếp từ browser — API key bị lộ. Chỉ dùng cho dev cục bộ.',
    );
  }

  async reply(input: string, history: BrainTurn[]): Promise<BrainReply> {
    return this.provider === 'anthropic'
      ? this.anthropic(input, history)
      : this.openai(input, history);
  }

  private async anthropic(input: string, history: BrainTurn[]): Promise<BrainReply> {
    const messages = [
      ...history.map((h) => ({
        role: h.role === 'mira' ? 'assistant' : 'user',
        content: h.text,
      })),
      { role: 'user', content: input },
    ];

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: 300,
        system: SYSTEM,
        messages,
      }),
    });
    if (!res.ok) throw new Error(`anthropic ${res.status}`);
    const data = await res.json();
    const text = (data?.content?.[0]?.text ?? '').trim();
    return { text: text || 'Dạ em chưa rõ ý anh lắm.' };
  }

  private async openai(input: string, history: BrainTurn[]): Promise<BrainReply> {
    const messages = [
      { role: 'system', content: SYSTEM },
      ...history.map((h) => ({
        role: h.role === 'mira' ? 'assistant' : 'user',
        content: h.text,
      })),
      { role: 'user', content: input },
    ];

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({ model: this.model, max_tokens: 300, messages }),
    });
    if (!res.ok) throw new Error(`openai ${res.status}`);
    const data = await res.json();
    const text = (data?.choices?.[0]?.message?.content ?? '').trim();
    return { text: text || 'Dạ em chưa rõ ý anh lắm.' };
  }
}
