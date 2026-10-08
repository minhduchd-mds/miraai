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

type ImportCandidate = { role?: unknown; text?: unknown; ts?: unknown; createdAt?: unknown };

/** Preserve repeated phrases on separate dates and make repeated restores idempotent. */
export function prepareImportedTurns(
  existing: readonly TurnRow[],
  items: readonly ImportCandidate[],
  fallbackTs = Date.now(),
): TurnRow[] {
  const byText = new Set(existing.map(row => JSON.stringify([row.role, row.text])));
  const byTimestamp = new Set(existing.map(row => JSON.stringify([row.role, row.text, row.ts])));
  const additions: TurnRow[] = [];
  for (const item of items.slice(-500)) {
    if (item?.role !== 'user' && item?.role !== 'mira') continue;
    const role = item.role;
    const text = typeof item.text === 'string' ? item.text.trim().slice(0, 6000) : '';
    if (!text) continue;
    const numericTs = item.ts == null ? NaN : Number(item.ts);
    const parsedDate = typeof item.createdAt === 'string' ? Date.parse(item.createdAt) : NaN;
    const numericOk = Number.isSafeInteger(numericTs) && numericTs > 0;
    const dateOk = Number.isSafeInteger(parsedDate) && parsedDate > 0;
    const ts = numericOk ? numericTs : dateOk ? parsedDate : fallbackTs;
    const textKey = JSON.stringify([role, text]);
    const timeKey = JSON.stringify([role, text, ts]);
    if (numericOk || dateOk ? byTimestamp.has(timeKey) : byText.has(textKey)) continue;
    byText.add(textKey);
    byTimestamp.add(timeKey);
    additions.push({ role, text, ts });
  }
  return additions;
}

/** Import only on demand; transaction failures must be surfaced. */
export async function importLocalTurns(
  db: IDBDatabase,
  items: Array<ImportCandidate>,
): Promise<void> {
  if (!Array.isArray(items) || !items.length) return;
  const existing = await getAll<TurnRow>(db, 'turns');
  const additions = prepareImportedTurns(existing, items);
  if (!additions.length) return;
  const tx = db.transaction('turns', 'readwrite');
  for (const row of additions) tx.objectStore('turns').add(row);
  await transactionDone(tx);
}
