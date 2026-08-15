import { legacyDeviceId } from '../../core/history-store';

export interface MemoryFact {
  id: number;
  fact: string;
  updatedAt?: string;
}

export interface MemoryProfile {
  facts: MemoryFact[];
  messageCount: number;
}

function seed(): string {
  return encodeURIComponent(legacyDeviceId());
}

export async function loadMemoryProfile(): Promise<MemoryProfile> {
  const response = await fetch(`/api/profile?device=${seed()}`, { credentials: 'same-origin' });
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
  const response = await fetch('/api/profile', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({ device: legacyDeviceId(), id, fact }),
  });
  if (!response.ok) throw new Error(`profile ${response.status}`);
}

export async function forgetMemoryFact(id: number): Promise<void> {
  const response = await fetch('/api/profile', {
    method: 'DELETE',
    headers: { 'content-type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({ device: legacyDeviceId(), id }),
  });
  if (!response.ok) throw new Error(`profile ${response.status}`);
}

export async function forgetAllMemory(): Promise<void> {
  const response = await fetch('/api/profile', {
    method: 'DELETE',
    headers: { 'content-type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({ device: legacyDeviceId(), all: true }),
  });
  if (!response.ok) throw new Error(`profile ${response.status}`);
}

export async function exportMemory(): Promise<void> {
  const response = await fetch(`/api/profile?device=${seed()}&export=1`, { credentials: 'same-origin' });
  if (!response.ok) throw new Error(`profile ${response.status}`);
  const blob = new Blob([JSON.stringify(await response.json(), null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `mira-memory-${new Date().toISOString().slice(0, 10)}.json`;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
