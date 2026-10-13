import type { BrainTurn } from '../../core/types';

/**
 * Reconcile browser and cloud conversation streams without dropping intentional
 * repeated utterances. Only aligned overlapping turns are coalesced. We have
 * no shared turn ID/timestamp in BrainTurn, so unrelated disjoint streams
 * cannot be placed in a provably chronological order.
 */
export function mergeTurnHistory(local: BrainTurn[], remote: BrainTurn[], limit = 40): BrainTurn[] {
  if (!local.length) return remote.slice(-limit);
  if (!remote.length) return local.slice(-limit);
  const same = (a: BrainTurn, b: BrainTurn) => a.role === b.role && a.text === b.text;
  const n = local.length, m = remote.length;
  // Longest common subsequence: preserve order within BOTH sources. A Set
  // would erase real repeated greetings, corrections and boundary reminders.
  const lcs = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i][j] = same(local[i], remote[j])
        ? lcs[i + 1][j + 1] + 1
        : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }
  const merged: BrainTurn[] = [];
  let i = 0, j = 0;
  while (i < n || j < m) {
    if (i === n) { merged.push(remote[j++]); continue; }
    if (j === m) { merged.push(local[i++]); continue; }
    if (same(local[i], remote[j])) { merged.push(local[i]); i++; j++; continue; }
    if (lcs[i + 1][j] >= lcs[i][j + 1]) merged.push(local[i++]);
    else merged.push(remote[j++]);
  }
  return merged.slice(-limit);
}
