import type { Brain, BrainReply, BrainTurn } from '../types';
import { voicePrefs, responseTimeoutMs } from '../voice-prefs';
import { buildSystem, parseMood, buildTurns } from './prompt';
import { CannedBrain } from './canned-brain';

function isGitHubPagesRuntime(): boolean {
  return typeof window !== 'undefined' && window.location.hostname.endsWith('.github.io');
}

/** Production brain client: provider credentials live behind /api/chat. */
export class GeminiBrain implements Brain {
  readonly name = 'Mira Brain · server';
  private fallback: Brain = new CannedBrain();

  async reply(input: string, history: BrainTurn[], context?: string): Promise<BrainReply> {
    // Static GitHub Pages has no server functions. Stay responsive with the built-in
    // local brain instead of issuing a guaranteed /api/chat 404 on every turn.
    if (isGitHubPagesRuntime()) return this.fallback.reply(input, history);
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
        body: JSON.stringify({ system, messages, responseLength: voicePrefs.responseLength }),
        signal: AbortSignal.timeout(responseTimeoutMs(voicePrefs.responseLength)),
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
