/**
 * Keeps one controlling hand through transient MediaPipe detector swaps.
 * Switching hands never inherits an in-progress pinch: the new hand must
 * release before its first control activation. No camera data is persisted.
 */
export type PrimarySpatialHand = {
  handedness?: string;
  pinching?: boolean;
  pointerX?: number;
  pointerY?: number;
  x?: number;
  y?: number;
};

export type PrimaryHandSelection<T> = {
  hand: T | null;
  switched: boolean;
  pinchAllowed: boolean;
};

const HAND_LOSS_GRACE_MS = 240;

function label(hand: PrimarySpatialHand): string {
  return String(hand.handedness || 'Unknown');
}

function valid(hand: PrimarySpatialHand): boolean {
  if (!hand || typeof hand !== 'object') return false;
  const x = Number(hand.pointerX ?? hand.x);
  const y = Number(hand.pointerY ?? hand.y);
  return Number.isFinite(x) && Number.isFinite(y) &&
    x >= 0 && x <= 1 && y >= 0 && y <= 1;
}

export class StablePrimaryHandRuntime {
  private selected = '';
  private lastSeenAt = -Infinity;
  private requireRelease = false;

  update<T extends PrimarySpatialHand>(hands: readonly T[], now: number): PrimaryHandSelection<T> {
    if (!Number.isFinite(now)) {
      this.reset();
      return { hand: null, switched: false, pinchAllowed: false };
    }
    const candidates = (Array.isArray(hands) ? hands : []).filter(valid);
    let next = this.selected
      ? candidates.find((hand) => label(hand) === this.selected)
      : undefined;

    if (!next && this.selected && now - this.lastSeenAt < HAND_LOSS_GRACE_MS) {
      this.requireRelease = true;
      return { hand: null, switched: false, pinchAllowed: false };
    }

    if (!next) {
      next = candidates.find((hand) => label(hand) === 'Right') || candidates[0];
    }
    if (!next) {
      this.requireRelease = true;
      return { hand: null, switched: false, pinchAllowed: false };
    }

    const nextLabel = label(next);
    const switched = Boolean(this.selected && this.selected !== nextLabel);
    if (switched) this.requireRelease = true;
    this.selected = nextLabel;
    this.lastSeenAt = now;

    if (!next.pinching) this.requireRelease = false;
    return {
      hand: next,
      switched,
      pinchAllowed: Boolean(next.pinching) && !this.requireRelease,
    };
  }

  reset(): void {
    this.selected = '';
    this.lastSeenAt = -Infinity;
    this.requireRelease = false;
  }
}
