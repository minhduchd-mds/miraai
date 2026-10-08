import type { BrainTurn } from '../../core/types';
import type { AffectState } from '../affect/mood-engine';
import type { LocalMemorySnapshot } from './local-memory-store';

type StoreName = 'turns' | 'episodes' | 'affect';
interface TurnRow { role: BrainTurn['role']; text: string; ts: number }
interface EpisodeRow { text: string; ts: number }
interface AffectRow {
  id?: number; mood: AffectState['mood']; confidence: number;
  valence?: number; arousal?: number; engagement?: number;
  fatigue?: number; tension?: number; ts: number;
}

function transactionDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error('IndexedDB transaction failed'));
    tx.onabort = () => reject(tx.error || new Error('IndexedDB transaction aborted'));
  });
}

async function getAll<T>(db: IDBDatabase, storeName: StoreName): Promise<T[]> {
  const tx = db.transaction(storeName, 'readonly');
  const rowsPromise = new Promise<T[]>((resolve, reject) => {
    const request = tx.objectStore(storeName).getAll();
    request.onsuccess = () => resolve(request.result as T[]);
    request.onerror = () => reject(request.error || new Error('IndexedDB export failed'));
  });
  const rows = await rowsPromise;
  await transactionDone(tx);
  return rows;
}

/** Read the complete archive on explicit export; any error prevents incomplete backups. */
export async function exportLocalSnapshot(db: IDBDatabase): Promise<LocalMemorySnapshot> {
  const [turns, episodes, affects] = await Promise.all([
    getAll<TurnRow>(db, 'turns'),
    getAll<EpisodeRow>(db, 'episodes'),
    getAll<AffectRow>(db, 'affect'),
  ]);
  return {
    exportedAt: new Date().toISOString(),
    turns: turns.sort((a, b) => a.ts - b.ts)
      .map(({ role, text, ts }) => ({ role, text, ts })),
    episodes: episodes.sort((a, b) => a.ts - b.ts)
      .map(({ text, ts }) => ({ text, ts })),
    affects: affects.sort((a, b) => a.ts - b.ts)
      .map(({ id: _id, ...row }) => row),
  };
}

/** Merge capsule turns; do not suppress transaction errors or remove existing rows. */
export async function importLocalTurns(
  db: IDBDatabase,
  items: Array<{ role?: unknown; text?: unknown; ts?: unknown; createdAt?: unknown }>,
): Promise<void> {
  if (!Array.isArray(items) || !items.length) return;
  const existing = await getAll<TurnRow>(db, 'turns');
  const seen = new Set(existing.map((row) => row.role + ':' + row.text));
  const tx = db.transaction('turns', 'readwrite');
  const store = tx.objectStore('turns');
  for (const item of items.slice(-500)) {
    const role: BrainTurn['role'] = item?.role === 'mira' ? 'mira' : 'user';
    const text = typeof item?.text === 'string' ? item.text.trim().slice(0, 6000) : '';
    if (!text || seen.has(role + ':' + text)) continue;
    seen.add(role + ':' + text);
    const parsedDate = typeof item?.createdAt === 'string' ? Date.parse(item.createdAt) : NaN;
    const rawTs = Number(item?.ts);
    const ts = Number.isFinite(rawTs) && rawTs > 0
      ? rawTs : Number.isFinite(parsedDate) ? parsedDate : Date.now();
    store.add({ role, text, ts });
  }
  await transactionDone(tx);
}
