import type { BrainTurn } from '../../core/types';
import type { AffectState } from '../affect/mood-engine';

const DB_NAME = 'mira-local-memory';
const DB_VERSION = 1;

interface TurnRow { id?: number; role: BrainTurn['role']; text: string; ts: number; }
interface EpisodeRow { id?: number; text: string; ts: number; }
interface AffectRow { id?: number; mood: AffectState['mood']; confidence: number; ts: number; }

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') return Promise.reject(new Error('IndexedDB unavailable'));
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onerror = () => reject(request.error || new Error('IndexedDB open failed'));
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
      request.onsuccess = () => resolve(request.result);
    }).catch((error) => {
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

async function readAll<T>(storeName: 'turns' | 'episodes' | 'affect'): Promise<T[]> {
  const db = await openDb();
  const tx = db.transaction(storeName, 'readonly');
  const rows = (await requestResult<any[]>(tx.objectStore(storeName).getAll())) as T[];
  await transactionDone(tx);
  return rows;
}

export class LocalMemoryStore {
  private lastAffectWriteAt = 0;
  private lastAffectKey = '';

  async loadRecent(limit = 40): Promise<BrainTurn[]> {
    try {
      const rows = await readAll<TurnRow>('turns');
      return rows.sort((a, b) => a.ts - b.ts).slice(-limit).map(({ role, text }) => ({ role, text }));
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
        readAll<TurnRow>('turns'),
        readAll<EpisodeRow>('episodes'),
        readAll<AffectRow>('affect'),
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

      const recentAffect = affects.sort((a, b) => b.ts - a.ts)[0];
      const parts: string[] = [];
      if (scored.length) {
        parts.push('Ký ức cục bộ liên quan:\n' + scored.map((item) => '- ' + item.text).join('\n'));
      }
      if (recentAffect && now - recentAffect.ts < 45 * 60_000 && recentAffect.confidence >= 0.55) {
        parts.push(
          'Tín hiệu biểu cảm gần đây: ' + recentAffect.mood +
          ' (độ tin cậy khoảng ' + Math.round(recentAffect.confidence * 100) +
          '%). Đây chỉ là ước lượng từ camera, không phải kết luận về cảm xúc hay sức khỏe.',
        );
      }
      return parts.join('\n\n');
    } catch {
      return '';
    }
  }
}
