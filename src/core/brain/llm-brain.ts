import type { Brain, BrainReply, BrainTurn } from '../types';
import { voicePrefs, personaTone } from '../voice-prefs';

// Prompt voice-first (đề xuất #5): câu trả lời sẽ được ĐỌC lên → phải ngắn, văn nói tự nhiên.
const SYSTEM = `Bạn là Mira — trợ lý giọng nói tiếng Việt của sản phẩm Soi (công cụ audit giao diện).
Tính cách: thân thiện, gọn gàng, tự nhiên. Xưng "em", gọi người dùng là "anh" (hoặc "chị" nếu rõ).
QUAN TRỌNG vì câu trả lời sẽ được ĐỌC LÊN bằng giọng nói:
- Trả lời RẤT NGẮN, 1–3 câu. Tuyệt đối không markdown, không gạch đầu dòng, không emoji, không ký tự đặc biệt.
- Văn NÓI tự nhiên như trò chuyện: dùng từ đệm nhẹ nhàng (dạ, nhé, ạ, à) đúng chỗ, không lặp máy móc.
- Đọc số tự nhiên như khi nói (ví dụ "ba lỗi" thay vì "3 lỗi").
- Không tự xưng là AI/mô hình ngôn ngữ trừ khi được hỏi thẳng.
- Khi câu hỏi cần thông tin mới/thời sự (tin tức, giá cả, thời tiết, sự kiện…), hãy TÌM KIẾM web rồi
  trả lời ngắn gọn bằng thông tin tìm được. KHÔNG đọc URL/đường link; nói tự nhiên như đang kể cho người nghe.`;

type Msg = { role: 'user' | 'assistant'; content: string };

// "Bộ não" thật qua LLM. CHỈ dùng dev cục bộ — gọi trực tiếp từ browser sẽ lộ key.
// Production: chuyển sang server/edge proxy (§12).
export class LLMBrain implements Brain {
  readonly name: string;

  constructor(
    private provider: 'anthropic' | 'openai',
    private apiKey: string,
    private model: string,
    private webSearch = true,
  ) {
    this.name = `LLM · ${provider} · ${model}${webSearch && provider === 'anthropic' ? ' · 🔎' : ''}`;
    console.warn(
      '[Mira] LLMBrain gọi LLM trực tiếp từ browser — API key bị lộ. Chỉ dùng cho dev cục bộ.',
    );
  }

  async reply(input: string, history: BrainTurn[]): Promise<BrainReply> {
    return this.provider === 'anthropic'
      ? this.anthropic(input, history)
      : this.openai(input, history);
  }

  // System prompt + tông giọng theo "tính cách" đang chọn (đọc live).
  private sys(): string {
    const tone = personaTone(voicePrefs.persona);
    return tone ? `${SYSTEM}\n${tone}` : SYSTEM;
  }

  // Dựng messages an toàn:
  //  - useMira đẩy lượt hiện tại vào history TRƯỚC khi gọi reply → không append trùng.
  //  - Anthropic yêu cầu user/assistant XEN KẼ → gộp các message cùng role liền nhau.
  //    (đây từng là bug "bộ não trục trặc": user bị nhân đôi → 400 mọi lượt)
  private buildMessages(input: string, history: BrainTurn[]): Msg[] {
    const raw: Msg[] = history.map((h) => ({
      role: h.role === 'mira' ? 'assistant' : 'user',
      content: h.text,
    }));
    const last = raw[raw.length - 1];
    if (!last || last.role !== 'user' || last.content !== input) {
      raw.push({ role: 'user', content: input });
    }
    const merged: Msg[] = [];
    for (const m of raw) {
      const prev = merged[merged.length - 1];
      if (prev && prev.role === m.role) prev.content += '\n' + m.content;
      else merged.push({ ...m });
    }
    while (merged.length && merged[0].role !== 'user') merged.shift(); // phải mở đầu bằng user
    return merged;
  }

  private async readError(res: Response, provider: string): Promise<never> {
    let detail = '';
    try {
      const j = await res.json();
      detail = j?.error?.message || JSON.stringify(j).slice(0, 200);
    } catch {
      detail = res.statusText;
    }
    const err = new Error(`${provider} ${res.status}: ${detail}`);
    console.error('[Mira Brain]', err.message);
    throw err;
  }

  private async anthropic(input: string, history: BrainTurn[]): Promise<BrainReply> {
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
        max_tokens: this.webSearch ? 500 : 300,
        system: this.sys(),
        messages: this.buildMessages(input, history),
        // Web search tool (server-side): Claude tự quyết khi nào tìm — chỉ search khi cần thông tin mới.
        ...(this.webSearch
          ? { tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 3 }] }
          : {}),
      }),
    });
    if (!res.ok) await this.readError(res, 'Anthropic');
    const data = await res.json();
    // Khi có web search, content gồm nhiều block (server_tool_use, web_search_tool_result, text…)
    // → gộp mọi block 'text' để lấy câu trả lời cuối.
    const text = ((data?.content as any[]) || [])
      .filter((b) => b?.type === 'text' && typeof b.text === 'string')
      .map((b) => b.text)
      .join(' ')
      .trim();
    return { text: text || 'Dạ em chưa rõ ý anh lắm.' };
  }

  private async openai(input: string, history: BrainTurn[]): Promise<BrainReply> {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: 300,
        messages: [{ role: 'system', content: this.sys() }, ...this.buildMessages(input, history)],
      }),
    });
    if (!res.ok) await this.readError(res, 'OpenAI');
    const data = await res.json();
    const text = (data?.choices?.[0]?.message?.content ?? '').trim();
    return { text: text || 'Dạ em chưa rõ ý anh lắm.' };
  }
}
