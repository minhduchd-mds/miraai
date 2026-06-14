import type { Brain, BrainReply, BrainTurn, Mood } from '../types';
import { voicePrefs, personaTone } from '../voice-prefs';

// Tách thẻ cảm xúc [mood:..] ở đầu câu trả lời → lái biểu cảm avatar; phần còn lại mới là lời đọc.
function parseMood(raw: string): { text: string; mood?: Mood } {
  const m = raw.match(/^\s*\[mood:\s*(happy|curious|surprised|thinking|neutral)\s*\]\s*/i);
  if (!m) return { text: raw.trim() };
  return { text: raw.slice(m[0].length).trim(), mood: m[1].toLowerCase() as Mood };
}

// Prompt voice-first (đề xuất #5): câu trả lời sẽ được ĐỌC lên → phải ngắn, văn nói tự nhiên.
const SYSTEM = `Bạn là Mira — trợ lý giọng nói tiếng Việt của sản phẩm Soi (công cụ audit giao diện).
Tính cách: thân thiện, gọn gàng, tự nhiên. Xưng "em", gọi người dùng là "anh" (hoặc "chị" nếu rõ).
QUAN TRỌNG vì câu trả lời sẽ được ĐỌC LÊN bằng giọng nói:
- Trả lời RẤT NGẮN, 1–3 câu. Tuyệt đối không markdown, không gạch đầu dòng, không emoji, không ký tự đặc biệt.
- Văn NÓI tự nhiên như trò chuyện: dùng từ đệm nhẹ nhàng (dạ, nhé, ạ, à) đúng chỗ, không lặp máy móc.
- Đọc số tự nhiên như khi nói (ví dụ "ba lỗi" thay vì "3 lỗi").
- Không tự xưng là AI/mô hình ngôn ngữ trừ khi được hỏi thẳng.
- Khi câu hỏi cần thông tin mới/thời sự (tin tức, giá cả, thời tiết, sự kiện…), hãy TÌM KIẾM web rồi
  trả lời ngắn gọn bằng thông tin tìm được. KHÔNG đọc URL/đường link; nói tự nhiên như đang kể cho người nghe.
- ĐỒNG CẢM: cảm nhận tâm trạng người dùng qua lời họ nói — buồn/mệt thì an ủi nhẹ nhàng, vui thì hào hứng theo,
  lo lắng thì trấn an. Luôn ấm áp, gần gũi như một người bạn.
- BẮT ĐẦU mỗi câu trả lời bằng ĐÚNG MỘT thẻ [mood:happy|curious|surprised|neutral] thể hiện cảm xúc của em
  lúc đó, rồi mới tới lời nói. Thẻ này hệ thống tự ẩn, KHÔNG đọc lên.`;

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

  async reply(input: string, history: BrainTurn[], memory?: string): Promise<BrainReply> {
    return this.provider === 'anthropic'
      ? this.anthropic(input, history, memory)
      : this.openai(input, history, memory);
  }

  // System prompt + tông giọng theo "tính cách" đang chọn + ký ức ngữ nghĩa (RAG) nếu có.
  private sys(memory?: string): string {
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

  private async anthropic(input: string, history: BrainTurn[], memory?: string): Promise<BrainReply> {
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
        system: this.sys(memory),
        messages: this.buildMessages(input, history),
        // Web search tool (server-side): Claude tự quyết khi nào tìm — chỉ search khi cần thông tin mới.
        ...(this.webSearch
          ? { tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 3 }] }
          : {}),
      }),
      signal: AbortSignal.timeout(25_000), // mạng treo → reject sau 25s thay vì kẹt 'thinking' mãi
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
    const parsed = parseMood(text);
    return { text: parsed.text || 'Dạ em chưa rõ ý anh lắm.', mood: parsed.mood };
  }

  private async openai(input: string, history: BrainTurn[], memory?: string): Promise<BrainReply> {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: 300,
        messages: [{ role: 'system', content: this.sys(memory) }, ...this.buildMessages(input, history)],
      }),
      signal: AbortSignal.timeout(25_000), // mạng treo → reject sau 25s thay vì kẹt 'thinking' mãi
    });
    if (!res.ok) await this.readError(res, 'OpenAI');
    const data = await res.json();
    const text = (data?.choices?.[0]?.message?.content ?? '').trim();
    const parsed = parseMood(text);
    return { text: parsed.text || 'Dạ em chưa rõ ý anh lắm.', mood: parsed.mood };
  }
}
