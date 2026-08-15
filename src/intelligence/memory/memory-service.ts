import type { BrainTurn } from '../../core/types';
import { distillFacts, loadHistory, recallMemory, saveTurn } from '../../core/history-store';

/** Boundary around persistence/RAG so the conversation runtime no longer depends on storage details. */
export class MemoryService {
  loadRecent(): Promise<BrainTurn[]> {
    return loadHistory();
  }

  save(turn: BrainTurn): void {
    saveTurn(turn);
  }

  recall(query: string): Promise<string> {
    return recallMemory(query);
  }

  distill(conversation: string): void {
    distillFacts(conversation);
  }
}
