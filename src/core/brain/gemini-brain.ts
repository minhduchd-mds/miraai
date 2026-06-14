import type { Brain, BrainReply, BrainTurn } from '../types';
import { buildSystem, parseMood, buildTurns } from './prompt';
import { CannedBrain } from './canned-brain';

// "Bộ não" MIỄN PHÍ qua Gemini-flash: gọi /api/chat (Vercel serverless, key đọc PHÍA SERVER → không lộ).
// /api/chat lỗi (dev cục bộ không có /api, hoặc server thiếu key) → tự rớt về brain demo (CannedBrain) để không câm.
export class GeminiBrain implements Brain {
  readonly name = 'Gemini · free (server)';
  private fallback: Brain = new CannedBrain();

  async reply(input: string, history: BrainTurn[], memory?: string): Promise<BrainReply> {
    try {
      const system = buildSystem(memory);
      const messages = buildTurns(input, history).map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        text: m.content,
      }));
      const r = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ system, messages }),
        signal: AbortSignal.timeout(25_000),
      });
      if (!r.ok) throw new Error(`/api/chat ${r.status}`);
      const j = await r.json();
      const parsed = parseMood((j?.text || '').toString().trim());
      if (!parsed.text) throw new Error('empty');
      return { text: parsed.text, mood: parsed.mood };
    } catch {
      return this.fallback.reply(input, history); // không tới được server/thiếu key → demo brain
    }
  }
}
