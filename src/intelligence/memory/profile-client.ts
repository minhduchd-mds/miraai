import { createRuntimeMemoryStore, isLocalOnlyMemoryRuntime } from './runtime-store';

const localMemory = createRuntimeMemoryStore();

export interface MemoryFact {
  id: number;
  fact: string;
  updatedAt?: string;
}

export interface MemoryProfile {
  facts: MemoryFact[];
  messageCount: number;
}

export async function loadMemoryProfile(): Promise<MemoryProfile> {
  if (isLocalOnlyMemoryRuntime()) {
    return { facts: [], messageCount: await localMemory.countTurns() };
  }
  const response = await fetch('/api/profile', { credentials: 'same-origin' });
  if (!response.ok) throw new Error(`profile ${response.status}`);
  const json = await response.json();
  return {
    facts: Array.isArray(json?.facts)
      ? json.facts.map((item: any) => ({
          id: Number(item.id),
          fact: String(item.fact || ''),
          updatedAt: item.updated_at ? String(item.updated_at) : undefined,
        }))
      : [],
    messageCount: Number(json?.messageCount || 0),
  };
}

export async function updateMemoryFact(id: number, fact: string): Promise<void> {
  if (isLocalOnlyMemoryRuntime()) throw new Error('Structured facts are server-only; local-only memory stores conversation history.');
  const response = await fetch('/api/profile', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({ id, fact }),
  });
  if (!response.ok) throw new Error(`profile ${response.status}`);
}

export async function forgetMemoryFact(id: number): Promise<void> {
  if (isLocalOnlyMemoryRuntime()) throw new Error('Structured facts are server-only; local-only memory stores conversation history.');
  const response = await fetch('/api/profile', {
    method: 'DELETE',
    headers: { 'content-type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({ id }),
  });
  if (!response.ok) throw new Error(`profile ${response.status}`);
}

export async function forgetAllMemory(): Promise<void> {
  if (isLocalOnlyMemoryRuntime()) {
    await localMemory.clearAll();
    return;
  }
  const response = await fetch('/api/profile', {
    method: 'DELETE',
    headers: { 'content-type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({ all: true }),
  });
  if (!response.ok) throw new Error(`profile ${response.status}`);
}

export async function exportMemory(): Promise<void> {
  const value = isLocalOnlyMemoryRuntime()
    ? await localMemory.exportSnapshot()
    : await (async () => {
        const response = await fetch('/api/profile?export=1', { credentials: 'same-origin' });
        if (!response.ok) throw new Error(`profile ${response.status}`);
        return response.json();
      })();
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `mira-memory-${new Date().toISOString().slice(0, 10)}.json`;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
