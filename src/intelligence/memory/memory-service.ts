import type { BrainTurn } from '../../core/types';
import { distillFacts, loadHistory, recallMemory, saveTurn } from '../../core/history-store';
import type { AffectState } from '../affect/mood-engine';
import { createRuntimeMemoryStore, isLocalOnlyMemoryRuntime } from './runtime-store';
import { memoryEnabled } from './preferences';

function serverMemoryAvailable(): boolean {
  if (typeof window === 'undefined') return true;
  return !isLocalOnlyMemoryRuntime();
}

function memoryOptOut(text: string): boolean {
  const normalized = text
    .toLocaleLowerCase('vi')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return /\b(dung nho|dung luu|khong can nho|khong luu|chuyen nay dung nho|chuyen nay dung luu)\b/.test(normalized);
}

export class MemoryService {
  private readonly local = createRuntimeMemoryStore();
  private skipAssistantPersistenceOnce = false;

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

    if (turn.role === 'user') {
      if (memoryOptOut(turn.text)) {
        this.skipAssistantPersistenceOnce = true;
        return;
      }
      this.skipAssistantPersistenceOnce = false;
    } else if (this.skipAssistantPersistenceOnce) {
      this.skipAssistantPersistenceOnce = false;
      return;
    }

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
    const userText = conversation.split('\nMira:')[0]?.replace(/^Người dùng:\s*/i, '') || conversation;
    if (memoryOptOut(userText)) return;
    void this.local.distill(conversation);
    if (serverMemoryAvailable()) distillFacts(conversation);
  }

  observeAffect(affect: AffectState): void {
    if (!memoryEnabled()) return;
    void this.local.saveAffect(affect);
  }
}
