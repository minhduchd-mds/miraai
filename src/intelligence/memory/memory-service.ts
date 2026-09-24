import type { BrainTurn } from '../../core/types';
import { distillFacts, loadHistory, recallMemory, saveTurn } from '../../core/history-store';
import type { AffectState } from '../affect/mood-engine';
import { LocalMemoryStore } from './local-memory-store';
import { memoryEnabled } from './preferences';

function serverMemoryAvailable(): boolean {
  if (typeof window === 'undefined') return true;
  return !window.location.hostname.endsWith('.github.io');
}

export class MemoryService {
  private readonly local = new LocalMemoryStore();

  async loadRecent(): Promise<BrainTurn[]> {
    if (!memoryEnabled()) return [];
    const local = await this.local.loadRecent();
    if (!serverMemoryAvailable()) return local;
    const remote = await loadHistory();
    if (!remote.length) return local;
    if (!local.length) return remote;
    const merged: BrainTurn[] = [];
    const seen = new Set<string>();
    for (const turn of [...local, ...remote]) {
      const key = turn.role + ':' + turn.text;
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(turn);
    }
    return merged.slice(-40);
  }

  save(turn: BrainTurn): void {
    if (!memoryEnabled()) return;
    void this.local.saveTurn(turn);
    if (serverMemoryAvailable()) saveTurn(turn);
  }

  async recall(query: string): Promise<string> {
    if (!memoryEnabled()) return '';
    const local = await this.local.recall(query);
    if (!serverMemoryAvailable()) return local;
    const remote = await recallMemory(query);
    return [local, remote].filter(Boolean).join('\n\n');
  }

  distill(conversation: string): void {
    if (!memoryEnabled()) return;
    void this.local.distill(conversation);
    if (serverMemoryAvailable()) distillFacts(conversation);
  }

  observeAffect(affect: AffectState): void {
    if (!memoryEnabled()) return;
    void this.local.saveAffect(affect);
  }
}
