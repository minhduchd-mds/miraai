import type { Brain, BrainReply, BrainTurn } from '../types';
import { buildSystem, parseMood, buildTurns } from './prompt';
import { CannedBrain } from './canned-brain';

/** Production brain client: provider credentials live behind /api/chat. */
export class GeminiBrain implements Brain {
  readonly name = 'Mira Brain · server';
  private fallback: Brain = new CannedBrain();

  async reply(input: string, history: BrainTurn[], context?: string): Promise<BrainReply> {
    try {
      const system = buildSystem(context);
      const messages = buildTurns(input, history).map((message) => ({
        role: message.role === 'assistant' ? 'model' : 'user',
        text: message.content,
      }));
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ system, messages }),
        signal: AbortSignal.timeout(25_000),
      });
      if (!response.ok) throw new Error(`/api/chat ${response.status}`);
      const json = await response.json();
      const parsed = parseMood(String(json?.text || '').trim());
      if (!parsed.text) throw new Error('empty');
      return { text: parsed.text, mood: parsed.mood };
    } catch {
      return this.fallback.reply(input, history);
    }
  }
}
