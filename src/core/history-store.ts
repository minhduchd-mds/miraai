import type { BrainTurn } from './types';

// Legacy id is retained as the first server memory-scope seed so existing Neon history is not lost.
const DEVICE_KEY = 'mira.device';

export function legacyDeviceId(): string {
  try {
    let id = localStorage.getItem(DEVICE_KEY);
    if (!id) {
      id = 'dev_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
      localStorage.setItem(DEVICE_KEY, id);
    }
    return id;
  } catch {
    return 'dev_anon';
  }
}

const seed = () => encodeURIComponent(legacyDeviceId());

export async function loadHistory(): Promise<BrainTurn[]> {
  try {
    const response = await fetch(`/api/history?device=${seed()}`, { credentials: 'same-origin' });
    if (!response.ok) return [];
    const json = await response.json();
    const turns = Array.isArray(json?.turns) ? json.turns : [];
    return turns
      .filter((turn: any) => (turn?.role === 'user' || turn?.role === 'mira') && typeof turn?.text === 'string')
      .map((turn: any) => ({ role: turn.role, text: turn.text }) as BrainTurn);
  } catch {
    return [];
  }
}

export async function recallMemory(query: string): Promise<string> {
  const q = (query || '').trim();
  if (!q) return '';
  try {
    const response = await fetch(`/api/memory?device=${seed()}&q=${encodeURIComponent(q)}`, {
      credentials: 'same-origin',
    });
    if (!response.ok) return '';
    const json = await response.json();
    const facts = (Array.isArray(json?.facts) ? json.facts : [])
      .filter((fact: any) => typeof fact?.fact === 'string' && (fact.score == null || fact.score > 0.4))
      .slice(0, 5);
    const memories = (Array.isArray(json?.memories) ? json.memories : [])
      .filter((memory: any) => typeof memory?.text === 'string' && (memory.score == null || memory.score > 0.55))
      .slice(0, 5);
    const parts: string[] = [];
    if (facts.length) parts.push('Hồ sơ người dùng:\n' + facts.map((fact: any) => `- ${fact.fact}`).join('\n'));
    if (memories.length) {
      parts.push(
        'Đoạn trò chuyện cũ liên quan:\n' +
          memories
            .map((memory: any) => `- ${memory.role === 'mira' ? 'Mira đã nói' : 'Người dùng đã nói'}: ${memory.text}`)
            .join('\n'),
      );
    }
    return parts.join('\n\n');
  } catch {
    return '';
  }
}

export function distillFacts(conversation: string): void {
  const text = (conversation || '').trim();
  if (!text) return;
  try {
    void fetch('/api/facts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ device: legacyDeviceId(), conversation: text }),
    }).catch(() => {});
  } catch {
    // best-effort persistence
  }
}

export function saveTurn(turn: BrainTurn): void {
  try {
    void fetch('/api/history', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ device: legacyDeviceId(), role: turn.role, text: turn.text }),
    }).catch(() => {});
  } catch {
    // best-effort persistence
  }
}
