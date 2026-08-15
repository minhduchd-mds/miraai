import type { Brain, BrainReply, BrainTurn } from '../types';
import { responseTimeoutMs, responseTokenBudget, voicePrefs } from '../voice-prefs';
import { buildSystem, parseMood, buildTurns } from './prompt';

// Claude có web_search tool → thêm hướng dẫn tìm web vào system (Gemini không có nên prompt.ts không kèm).
const WEB_SEARCH_NOTE =
  '\n- Khi câu hỏi cần thông tin mới/thời sự (tin tức, giá cả, thời tiết, sự kiện…), hãy TÌM KIẾM web rồi ' +
  'trả lời với độ dài theo preset hội thoại hiện tại. KHÔNG đọc URL/đường link; nói tự nhiên như đang kể cho người nghe.';

// "Bộ não" thật qua LLM. CHỈ dùng dev cục bộ — gọi trực tiếp từ browser sẽ lộ key.
export class LLMBrain implements Brain {
  readonly name: string;

  constructor(
    private provider: 'anthropic' | 'openai',
    private apiKey: string,
    private model: string,
    private webSearch = true,
  ) {
    this.name = `LLM · ${provider} · ${model}${webSearch && provider === 'anthropic' ? ' · 🔎' : ''}`;
    console.warn('[Mira] LLMBrain gọi LLM trực tiếp từ browser — API key bị lộ. Chỉ dùng cho dev cục bộ.');
  }

  async reply(input: string, history: BrainTurn[], memory?: string): Promise<BrainReply> {
    return this.provider === 'anthropic'
      ? this.anthropic(input, history, memory)
      : this.openai(input, history, memory);
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
    const budget = responseTokenBudget(voicePrefs.responseLength);
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
        max_tokens: budget,
        system: buildSystem(memory) + (this.webSearch ? WEB_SEARCH_NOTE : ''),
        messages: buildTurns(input, history),
        ...(this.webSearch ? { tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 3 }] } : {}),
      }),
      signal: AbortSignal.timeout(responseTimeoutMs(voicePrefs.responseLength)),
    });
    if (!res.ok) await this.readError(res, 'Anthropic');
    const data = await res.json();
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
        max_tokens: responseTokenBudget(voicePrefs.responseLength),
        messages: [{ role: 'system', content: buildSystem(memory) }, ...buildTurns(input, history)],
      }),
      signal: AbortSignal.timeout(responseTimeoutMs(voicePrefs.responseLength)),
    });
    if (!res.ok) await this.readError(res, 'OpenAI');
    const data = await res.json();
    const text = (data?.choices?.[0]?.message?.content ?? '').trim();
    const parsed = parseMood(text);
    return { text: parsed.text || 'Dạ em chưa rõ ý anh lắm.', mood: parsed.mood };
  }
}
