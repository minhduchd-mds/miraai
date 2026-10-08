/**
 * Webcam bimanual guard. Reject duplicate/low-confidence hands and pinches
 * too close to establish a stable scale/rotation baseline. Order by handedness
 * so a detector's frame-order swap cannot rotate windows 180 degrees.
 * This only authorizes synthetic UI transforms, never privileged actions.
 */
export type BimanualCandidate = {
  handedness?: string;
  score?: number;
  pinching?: boolean;
  pointerX?: number;
  pointerY?: number;
  x?: number;
  y?: number;
};

function point(hand: BimanualCandidate) {
  return {
    x: Number(hand.pointerX ?? hand.x),
    y: Number(hand.pointerY ?? hand.y),
  };
}

export function selectStableBimanualHands(candidates: unknown): BimanualCandidate[] {
  if (!Array.isArray(candidates)) return [];
  const filtered = candidates.filter((hand): hand is BimanualCandidate => {
    if (!hand || typeof hand !== 'object' || hand.pinching !== true) return false;
    const p = point(hand);
    return Number.isFinite(p.x) && Number.isFinite(p.y) &&
      p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1 &&
      Number.isFinite(Number(hand.score ?? 0)) && Number(hand.score ?? 0) >= 0.5;
  });
  if (filtered.length < 2) return [];
  const sorted = [...filtered].sort((a,b) => {
    const rank = (hand: BimanualCandidate) => hand.handedness === 'Left' ? 0
      : hand.handedness === 'Right' ? 1 : 2;
    return rank(a) - rank(b) || point(a).x - point(b).x;
  });
  const pair = sorted.slice(0,2);
  const names = pair.map(hand => String(hand.handedness || ''));
  if (names[0] && names[0] !== 'Unknown' && names[0] === names[1]) return [];
  const a = point(pair[0]), b = point(pair[1]);
  if (Math.hypot(a.x-b.x,a.y-b.y) < 0.08) return [];
  return pair;
}

/**
 * Adds temporal continuity to bimanual manipulation.
 * Geometry alone is insufficient: require the SAME pair across a dwell
 * period and reset after long frame gaps, detector ID swaps or jumps.
 */
export class StableBimanualPairRuntime {
  private pairKey = '';
  private since = 0;
  private lastAt = -Infinity;
  private previous: Array<{ x: number; y: number }> = [];

  update(candidates: unknown, now: number): BimanualCandidate[] {
    const pair = selectStableBimanualHands(candidates);
    const validLabels = pair.map((hand) => String(hand.handedness || 'Unknown'));
    if (!Number.isFinite(now) || pair.length !== 2 ||
        validLabels.some((name) => name !== 'Left' && name !== 'Right')) {
      this.reset();
      return [];
    }

    const key = validLabels.join('|');
    const positions = pair.map(point);
    const movedTooFar = this.previous.length === 2 &&
      positions.some((position, index) => Math.hypot(
        position.x - this.previous[index].x,
        position.y - this.previous[index].y,
      ) > 0.24);
    const frameGap = this.lastAt !== -Infinity &&
      (now < this.lastAt || now - this.lastAt > 360);

    if (key !== this.pairKey || movedTooFar || frameGap) {
      this.pairKey = key;
      this.since = now;
    }
    this.lastAt = now;
    this.previous = positions;
    return now - this.since >= 180 ? pair : [];
  }

  reset(): void {
    this.pairKey = '';
    this.since = 0;
    this.lastAt = -Infinity;
    this.previous = [];
  }
}
