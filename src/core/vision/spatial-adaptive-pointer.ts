/**
 * Spatial v22: confidence-gated, camera-frame-driven 2D pointer stabilization.
 * Coordinates are normalized screen positions, never physical 3D measurements.
 */
export interface SpatialScreenPoint { x: number; y: number }
type Sample = SpatialScreenPoint & { at: number; pendingJump: SpatialScreenPoint | null };

export class SpatialAdaptivePointer {
  private readonly tracks = new Map<string, Sample>();

  update(hand: string, x: number, y: number, at: number, confidence = 1): SpatialScreenPoint | null {
    if ((hand !== 'Left' && hand !== 'Right') ||
        ![x, y, at, confidence].every(Number.isFinite) ||
        x < 0 || x > 1 || y < 0 || y > 1 || at <= 0 || confidence < 0.35) {
      this.tracks.delete(hand);
      return null;
    }

    const prior = this.tracks.get(hand);
    if (!prior || at - prior.at > 260) {
      this.tracks.set(hand, { x, y, at, pendingJump: null });
      return { x, y };
    }
    if (at < prior.at) { this.tracks.delete(hand); return null; }
    if (at === prior.at) return { x: prior.x, y: prior.y };

    const dt = at - prior.at;
    const distance = Math.hypot(x - prior.x, y - prior.y);

    // Reject a detector ID swap or a lone coordinate spike. Two consistent
    // far-away observations allow intentional rapid repositioning.
    if (dt < 120 && distance > 0.24) {
      if (prior.pendingJump && Math.hypot(x-prior.pendingJump.x, y-prior.pendingJump.y) <= 0.06) {
        this.tracks.set(hand, { x, y, at, pendingJump: null });
        return { x, y };
      }
      this.tracks.set(hand, { ...prior, at, pendingJump: { x, y } });
      return { x: prior.x, y: prior.y };
    }

    const speed = distance / (dt / 1000);
    const tauMs = speed > 0.7 ? 20 : speed > 0.22 ? 38 : 95;
    const alpha = (1 - Math.exp(-dt / tauMs)) * Math.max(0.55, Math.min(1, confidence));
    const next = {
      x: prior.x + (x - prior.x) * alpha,
      y: prior.y + (y - prior.y) * alpha,
      at,
      pendingJump: null,
    };
    this.tracks.set(hand, next);
    return { x: next.x, y: next.y };
  }

  retain(hands: readonly string[]): void {
    for (const hand of this.tracks.keys()) {
      if (!hands.includes(hand)) this.tracks.delete(hand);
    }
  }

  reset(): void { this.tracks.clear(); }
}
