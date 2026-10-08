/**
 * Session-only memoization. A UI poll is not a new camera inference frame:
 * do not recompute motion, clone landmarks or re-arm gestures on the same frame.
 */
export class SpatialHandFrameCache<T> {
  private frameAt = 0;
  private hands: T[] = [];

  read(frameAt: number, build: (at: number) => T[], onStale?: () => void): T[] {
    if (!Number.isFinite(frameAt) || frameAt <= 0) {
      if (this.frameAt !== 0) {
        this.reset();
        onStale?.();
      }
      return this.hands;
    }
    if (frameAt !== this.frameAt) {
      this.hands = build(frameAt);
      this.frameAt = frameAt;
    }
    return this.hands;
  }

  reset(): void {
    this.frameAt = 0;
    this.hands = [];
  }
}
