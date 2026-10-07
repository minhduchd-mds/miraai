import type { BrainTurn } from '../../core/types';
import type { AffectState } from '../affect/mood-engine';
import { desktopInvoke } from '../../desktop/bridge';
import type { LocalMemorySnapshot, PortableMemoryLink, PortableStructuredMemory } from './local-memory-store';

interface DesktopAffectRow {
  mood: AffectState['mood'];
  confidence: number;
  valence?: number;
  arousal?: number;
  engagement?: number;
  fatigue?: number;
  tension?: number;
  ts: number;
}

/** Narrow SQLite-backed memory API used only inside the packaged desktop runtime. */
export class DesktopMemoryStore {
  private lastAffectWriteAt = 0;
  private lastAffectKey = '';

  async countTurns(): Promise<number> {
    try { return await desktopInvoke<number>('desktop_memory_count'); } catch { return 0; }
  }

  async exportSnapshot(): Promise<LocalMemorySnapshot> {
    return desktopInvoke<LocalMemorySnapshot>('desktop_memory_export');
  }

  async importStructuredMemoryGraph(
    nodes: PortableStructuredMemory[],
    links: PortableMemoryLink[],
  ): Promise<void> {
    if (!Array.isArray(nodes) || !nodes.length) return;
    try {
      await desktopInvoke('desktop_memory_import_structured', {
        nodes: nodes.slice(-240),
        links: Array.isArray(links) ? links.slice(-600) : [],
      });
    } catch { /* best effort merge-only import */ }
  }

  async importTurns(items: Array<{ role?: unknown; text?: unknown; ts?: unknown; createdAt?: unknown }>): Promise<void> {
    if (!Array.isArray(items) || !items.length) return;
    try { await desktopInvoke('desktop_memory_import_turns', { items: items.slice(-500) }); } catch { /* best effort */ }
  }

  async clearAll(): Promise<void> {
    try {
      await desktopInvoke('desktop_memory_clear');
      this.lastAffectWriteAt = 0;
      this.lastAffectKey = '';
    } catch { /* noop */ }
  }

  async loadRecent(limit = 40): Promise<BrainTurn[]> {
    try {
      const rows = await desktopInvoke<Array<BrainTurn & { ts?: number }>>('desktop_memory_recent', {
        limit: Math.max(1, Math.min(200, Math.round(limit))),
      });
      return rows.map(({ role, text }) => ({ role, text }));
    } catch {
      return [];
    }
  }

  async saveTurn(turn: BrainTurn): Promise<void> {
    const text = turn.text.trim();
    if (!text) return;
    try {
      await desktopInvoke('desktop_memory_save_turn', { role: turn.role, text: text.slice(0, 6000) });
    } catch { /* storage never blocks conversation */ }
  }

  async distill(conversation: string): Promise<void> {
    const text = conversation.trim();
    if (!text) return;
    try { await desktopInvoke('desktop_memory_save_episode', { text: text.slice(0, 9000) }); } catch { /* noop */ }
  }

  async saveAffect(affect: AffectState): Promise<void> {
    const now = Date.now();
    const key = affect.mood + ':' + Math.round(affect.confidence * 10);
    if (key === this.lastAffectKey && now - this.lastAffectWriteAt < 30_000) return;
    if (now - this.lastAffectWriteAt < 12_000) return;
    this.lastAffectKey = key;
    this.lastAffectWriteAt = now;
    try {
      await desktopInvoke('desktop_memory_save_affect', {
        row: {
          mood: affect.mood,
          confidence: affect.confidence,
          valence: affect.dimensions.valence,
          arousal: affect.dimensions.arousal,
          engagement: affect.dimensions.engagement,
          fatigue: affect.dimensions.fatigue,
          tension: affect.dimensions.tension,
          ts: now,
        },
      });
    } catch { /* optional telemetry */ }
  }

  async recall(query: string): Promise<string> {
    const q = query.trim();
    if (!q) return '';
    try { return await desktopInvoke<string>('desktop_memory_recall', { query: q.slice(0, 2000) }); } catch { return ''; }
  }
}
