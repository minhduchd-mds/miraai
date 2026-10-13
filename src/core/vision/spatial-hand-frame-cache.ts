/**
 * Session-only memoization. A UI poll is not a new camera inference frame:
 * do not recompute motion, clone landmarks or re-arm gestures on the same frame.
 */
export class SpatialHandFrameCache<T> {
  private frameAt = 0;
  private hands: T[] = [];
  private rollbackReported = false;

  read(frameAt: number, build: (at: number) => T[], onStale?: () => void): T[] {
    if (!Number.isFinite(frameAt) || frameAt <= 0) {
      if (this.frameAt !== 0) {
        this.reset();
        onStale?.();
      }
      return this.hands;
    }
    // Late worker responses must never replace a newer gesture frame. Keep
    // the timestamp high-water mark, clear visible hands once and wait for a
    // genuinely newer inference; repeated UI polls cannot re-arm old actions.
    if (frameAt < this.frameAt) {
      if (!this.rollbackReported) {
        this.hands = [];
        this.rollbackReported = true;
        onStale?.();
      }
      return this.hands;
    }
    if (frameAt > this.frameAt) {
      this.rollbackReported = false;
      this.hands = build(frameAt);
      this.frameAt = frameAt;
    }
    return this.hands;
  }

  reset(): void {
    this.frameAt = 0;
    this.hands = [];
    this.rollbackReported = false;
  }
}
