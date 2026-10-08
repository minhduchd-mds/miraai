import type { BrainTurn } from '../../core/types';
import type { AffectState } from '../affect/mood-engine';

const DB_NAME = 'mira-local-memory';
const DB_VERSION = 1;

interface TurnRow { id?: number; role: BrainTurn['role']; text: string; ts: number; }
interface EpisodeRow { id?: number; text: string; ts: number; }
interface AffectRow {
  id?: number;
  mood: AffectState['mood'];
  confidence: number;
  valence?: number;
  arousal?: number;
  engagement?: number;
  fatigue?: number;
  tension?: number;
  ts: number;
}

export interface PortableStructuredMemory {
  id: number;
  kind: string;
  text: string;
  importance: number;
  status: string;
  firstSeenTs: number;
  lastSeenTs: number;
  hitCount: number;
}

export interface PortableMemoryLink {
  sourceId: number;
  targetId: number;
  relation: string;
  weight: number;
  createdAt: number;
}

export interface LocalMemorySnapshot {
  exportedAt: string;
  turns: Array<{ role: BrainTurn['role']; text: string; ts: number }>;
  episodes: Array<{ text: string; ts: number }>;
  affects: Array<Omit<AffectRow, 'id'>>;
  structuredMemories?: PortableStructuredMemory[];
  memoryLinks?: PortableMemoryLink[];
}

let dbPromise: Promise<IDBDatabase> | null = null;
let persistencePromise: Promise<boolean> | null = null;

async function requestPersistentStorage(): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.storage?.persist) return false;
  if (!persistencePromise) {
    persistencePromise = navigator.storage.persist().catch(() => false);
  }
  return persistencePromise;
}

function openDb(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') return Promise.reject(new Error('IndexedDB unavailable'));
  if (!dbPromise) {
    dbPromise = (async () => {
      await requestPersistentStorage();
      return new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onerror = () => reject(request.error || new Error('IndexedDB open failed'));
      request.onblocked = () => reject(new Error('IndexedDB upgrade blocked by another Mira tab'));
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('turns')) {
          const store = db.createObjectStore('turns', { keyPath: 'id', autoIncrement: true });
          store.createIndex('ts', 'ts');
        }
        if (!db.objectStoreNames.contains('episodes')) {
          const store = db.createObjectStore('episodes', { keyPath: 'id', autoIncrement: true });
          store.createIndex('ts', 'ts');
        }
        if (!db.objectStoreNames.contains('affect')) {
          const store = db.createObjectStore('affect', { keyPath: 'id', autoIncrement: true });
          store.createIndex('ts', 'ts');
        }
      };
        request.onsuccess = () => {
          const db = request.result;
          db.onversionchange = () => {
            db.close();
            dbPromise = null;
          };
          resolve(db);
        };
      });
    })().catch((error) => {
      dbPromise = null;
      throw error;
    });
  }
  return dbPromise;
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('IndexedDB request failed'));
  });
}

function transactionDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error('IndexedDB transaction failed'));
    tx.onabort = () => reject(tx.error || new Error('IndexedDB transaction aborted'));
  });
}

function normalize(text: string): string[] {
  return text.toLocaleLowerCase('vi')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length > 1);
}

function similarity(query: string[], text: string): number {
  if (!query.length) return 0;
  const hay = new Set(normalize(text));
  let hits = 0;
  for (const token of query) if (hay.has(token)) hits += 1;
  return hits / query.length;
}

/**
 * Traverse the timestamp index newest-first rather than materializing the
 * entire conversation/affect store during each user turn.
 */
async function readRecent<T>(storeName: 'turns' | 'episodes' | 'affect', limit: number): Promise<T[]> {
  const db = await openDb();
  const tx = db.transaction(storeName, 'readonly');
  const rows = await new Promise<T[]>((resolve, reject) => {
    const result: T[] = [];
    const cursor = tx.objectStore(storeName).index('ts').openCursor(null, 'prev');
    cursor.onerror = () => reject(cursor.error || new Error('IndexedDB cursor failed'));
    cursor.onsuccess = () => {
      const item = cursor.result;
      if (!item || result.length >= limit) {
        resolve(result.reverse());
        return;
      }
      result.push(item.value as T);
      if (result.length >= limit) resolve(result.reverse());
      else item.continue();
    };
  });
  await transactionDone(tx);
  return rows;
}

export class LocalMemoryStore {
  private lastAffectWriteAt = 0;
  private lastAffectKey = '';

  async countTurns(): Promise<number> {
    // A failed IndexedDB read must never masquerade as an empty archive.
    const db = await openDb();
    const tx = db.transaction('turns', 'readonly');
    const count = await requestResult(tx.objectStore('turns').count());
    await transactionDone(tx);
    return count;
  }

  async exportSnapshot(): Promise<LocalMemorySnapshot> {
    const db = await openDb();
    const { exportLocalSnapshot } = await import('./local-memory-portability');
    return exportLocalSnapshot(db);
  }

  async importStructuredMemoryGraph(
    _nodes: PortableStructuredMemory[],
    _links: PortableMemoryLink[],
  ): Promise<void> {
    // Browser-only IndexedDB runtime does not create inferred structured memory.
    // The method exists only so portable capsules can stay runtime-polymorphic.
  }

  async importTurns(items: Array<{ role?: unknown; text?: unknown; ts?: unknown; createdAt?: unknown }>): Promise<void> {
    if (!Array.isArray(items) || !items.length) return;
    const db = await openDb();
    const { importLocalTurns } = await import('./local-memory-portability');
    await importLocalTurns(db, items);
  }

  async clearAll(): Promise<void> {
    {
      const db = await openDb();
      const tx = db.transaction(['turns', 'episodes', 'affect'], 'readwrite');
      tx.objectStore('turns').clear();
      tx.objectStore('episodes').clear();
      tx.objectStore('affect').clear();
      await transactionDone(tx);
      this.lastAffectWriteAt = 0;
      this.lastAffectKey = '';
    }
  }

  async loadRecent(limit = 40): Promise<BrainTurn[]> {
    try {
      const rows = await readRecent<TurnRow>('turns', Math.max(1, Math.min(200, Math.round(limit))));
      return rows.map(({ role, text }) => ({ role, text }));
    } catch {
      return [];
    }
  }

  async saveTurn(turn: BrainTurn): Promise<void> {
    const text = turn.text.trim();
    if (!text) return;
    try {
      const db = await openDb();
      const tx = db.transaction('turns', 'readwrite');
      tx.objectStore('turns').add({
        role: turn.role,
        text: text.slice(0, 6000),
        ts: Date.now(),
      } satisfies TurnRow);
      await transactionDone(tx);
    } catch { /* local persistence is best-effort */ }
  }

  async distill(conversation: string): Promise<void> {
    const text = conversation.trim();
    if (!text) return;
    try {
      const db = await openDb();
      const tx = db.transaction('episodes', 'readwrite');
      tx.objectStore('episodes').add({ text: text.slice(0, 9000), ts: Date.now() } satisfies EpisodeRow);
      await transactionDone(tx);
    } catch { /* noop */ }
  }

  async saveAffect(affect: AffectState): Promise<void> {
    const now = Date.now();
    const key = affect.mood + ':' + Math.round(affect.confidence * 10);
    if (key === this.lastAffectKey && now - this.lastAffectWriteAt < 30_000) return;
    if (now - this.lastAffectWriteAt < 12_000) return;
    this.lastAffectKey = key;
    this.lastAffectWriteAt = now;
    try {
      const db = await openDb();
      const tx = db.transaction('affect', 'readwrite');
      tx.objectStore('affect').add({
        mood: affect.mood,
        confidence: affect.confidence,
        valence: affect.dimensions.valence,
        arousal: affect.dimensions.arousal,
        engagement: affect.dimensions.engagement,
        fatigue: affect.dimensions.fatigue,
        tension: affect.dimensions.tension,
        ts: now,
      } satisfies AffectRow);
      await transactionDone(tx);
    } catch { /* noop */ }
  }

  async recall(query: string): Promise<string> {
    const q = query.trim();
    if (!q) return '';
    try {
      const [turns, episodes, affects] = await Promise.all([
        readRecent<TurnRow>('turns', 260),
        readRecent<EpisodeRow>('episodes', 120),
        readRecent<AffectRow>('affect', 1),
      ]);
      const tokens = normalize(q);
      const now = Date.now();
      const scored = [
        ...turns.slice(-260).map((row) => ({
          text: (row.role === 'mira' ? 'Mira' : 'Người dùng') + ': ' + row.text,
          score: similarity(tokens, row.text) + Math.max(0, 0.18 - (now - row.ts) / 1000 / 60 / 60 / 24 / 180),
        })),
        ...episodes.slice(-120).map((row) => ({
          text: row.text,
          score: similarity(tokens, row.text) + Math.max(0, 0.12 - (now - row.ts) / 1000 / 60 / 60 / 24 / 240),
        })),
      ].filter((item) => item.score > 0.08).sort((a, b) => b.score - a.score).slice(0, 6);

      const recentAffect = affects[affects.length - 1];
      const parts: string[] = [];
      if (scored.length) {
        parts.push('Ký ức cục bộ liên quan:\n' + scored.map((item) => '- ' + item.text).join('\n'));
      }
      if (recentAffect && now - recentAffect.ts < 45 * 60_000 && recentAffect.confidence >= 0.55) {
        parts.push(
          'Tín hiệu biểu cảm gần đây: ' + recentAffect.mood +
          ' (độ tin cậy khoảng ' + Math.round(recentAffect.confidence * 100) +
          '%; valence ' + Number(recentAffect.valence || 0).toFixed(2) +
          '; arousal ' + Math.round(Number(recentAffect.arousal || 0) * 100) +
          '%; engagement ' + Math.round(Number(recentAffect.engagement || 0) * 100) +
          '%). Đây chỉ là tín hiệu hành vi quan sát được, không phải kết luận về cảm xúc hay sức khỏe.',
        );
      }
      return parts.join('\n\n');
    } catch {
      return '';
    }
  }
}
