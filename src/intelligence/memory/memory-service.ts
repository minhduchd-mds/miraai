import type { BrainTurn } from '../../core/types';
import { distillFacts, loadHistory, recallMemory, saveTurn } from '../../core/history-store';
import { memoryEnabled } from './preferences';

/** Boundary around persistence/RAG so the conversation runtime does not depend on storage details. */
export class MemoryService {
  loadRecent(): Promise<BrainTurn[]> {
    return memoryEnabled() ? loadHistory() : Promise.resolve([]);
  }

  save(turn: BrainTurn): void {
    if (memoryEnabled()) saveTurn(turn);
  }

  recall(query: string): Promise<string> {
    return memoryEnabled() ? recallMemory(query) : Promise.resolve('');
  }

  distill(conversation: string): void {
    if (memoryEnabled()) distillFacts(conversation);
  }
}
