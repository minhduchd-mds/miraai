export type SpatialAnchorKind = 'action' | 'window';

export interface SpatialPoint3 {
  x: number;
  y: number;
  z: number;
}

export interface SpatialAnchorVolume {
  id: string;
  label: string;
  kind: SpatialAnchorKind;
  center: SpatialPoint3;
  halfExtents: SpatialPoint3;
  priority?: number;
}

export interface SpatialCollisionHit {
  targetId: string;
  label: string;
  kind: SpatialAnchorKind;
  point: SpatialPoint3;
  center: SpatialPoint3;
  normalizedDistance: number;
  confidence: number;
}

export type SpatialTouchPhase = 'idle' | 'hover' | 'contact' | 'holding';

export interface SpatialDirectTouchState {
  phase: SpatialTouchPhase;
  targetId: string;
  label: string;
  kind: SpatialAnchorKind | null;
  since: number;
  ready: boolean;
  pinching: boolean;
  confidence: number;
  point: SpatialPoint3;
  hit: SpatialCollisionHit | null;
}

export interface SpatialDirectTouchInput {
  active: boolean;
  confidence: number;
  point: SpatialPoint3;
  pinching: boolean;
  anchors: SpatialAnchorVolume[];
}

export const EMPTY_SPATIAL_TOUCH: SpatialDirectTouchState = {
  phase: 'idle',
  targetId: '',
  label: '',
  kind: null,
  since: 0,
  ready: false,
  pinching: false,
  confidence: 0,
  point: { x: 0.5, y: 0.5, z: 0 },
  hit: null,
};

const CONTACT_DWELL_MS = 90;
const RELEASE_GRACE_MS = 90;
const MIN_TOUCH_CONFIDENCE = 0.58;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Number.isFinite(value) ? value : 0));
}

function clamp01(value: number): number {
  return clamp(value, 0, 1);
}

function axisDistance(value: number, center: number, halfExtent: number): number {
  const extent = Math.max(0.001, halfExtent);
  return Math.abs(value - center) / extent;
}

/**
 * Conservative axis-aligned 3D collision test in Mira's normalized camera space.
 * A future WebXR/device adapter can feed metric world-space anchors into the same
 * tracker after changing only the coordinate adapter.
 */
export function hitTestSpatialPoint(
  point: SpatialPoint3,
  anchors: SpatialAnchorVolume[],
  confidence = 1,
): SpatialCollisionHit | null {
  if (confidence < MIN_TOUCH_CONFIDENCE) return null;

  const hits = anchors
    .map((anchor) => {
      const dx = axisDistance(point.x, anchor.center.x, anchor.halfExtents.x);
      const dy = axisDistance(point.y, anchor.center.y, anchor.halfExtents.y);
      const dz = axisDistance(point.z, anchor.center.z, anchor.halfExtents.z);
      if (dx > 1 || dy > 1 || dz > 1) return null;

      const normalizedDistance = Math.hypot(dx, dy, dz) / Math.sqrt(3);
      const score = normalizedDistance - Number(anchor.priority || 0);
      return { anchor, normalizedDistance, score };
    })
    .filter(Boolean)
    .sort((a: any, b: any) => a.score - b.score) as Array<{
      anchor: SpatialAnchorVolume;
      normalizedDistance: number;
      score: number;
    }>;

  const best = hits[0];
  if (!best) return null;
  return {
    targetId: best.anchor.id,
    label: best.anchor.label,
    kind: best.anchor.kind,
    point: { ...point },
    center: { ...best.anchor.center },
    normalizedDistance: best.normalizedDistance,
    confidence: clamp01(confidence * (1 - Math.min(0.38, best.normalizedDistance * 0.25))),
  };
}

/**
 * Converts normalized 2D target geometry plus a relative z plane into a small
 * collision volume around the UI surface. The z half-extent is intentionally
 * generous for monocular webcam input, but direct touch still requires a stable
 * contact dwell and sufficient hand confidence.
 */
export function spatialAnchorFromRect(input: {
  id: string;
  label: string;
  kind: SpatialAnchorKind;
  left: number;
  top: number;
  right: number;
  bottom: number;
  z?: number;
  depthRadius?: number;
  priority?: number;
}): SpatialAnchorVolume {
  const left = clamp(input.left, 0, 1);
  const top = clamp(input.top, 0, 1);
  const right = clamp(input.right, left, 1);
  const bottom = clamp(input.bottom, top, 1);
  const width = Math.max(0.018, right - left);
  const height = Math.max(0.018, bottom - top);
  const depth = Math.max(0.035, Math.abs(Number(input.depthRadius ?? 0.065)));

  return {
    id: input.id,
    label: input.label,
    kind: input.kind,
    center: {
      x: (left + right) / 2,
      y: (top + bottom) / 2,
      z: clamp(Number(input.z ?? 0), -1, 1),
    },
    halfExtents: {
      x: width / 2 + 0.012,
      y: height / 2 + 0.012,
      z: depth,
    },
    priority: input.priority,
  };
}

/**
 * Session-only fingertip contact state.
 *
 * "Contact" here means a stable collision proxy in normalized camera/depth
 * coordinates. It is not proof of physical touch. Mira still requires pinch
 * for action commit/grab, avoiding accidental activation from a passing hand.
 */
export class SpatialDirectTouchTracker {
  private state: SpatialDirectTouchState = { ...EMPTY_SPATIAL_TOUCH, point: { ...EMPTY_SPATIAL_TOUCH.point } };
  private candidateId = '';
  private candidateSince = 0;
  private lastHitAt = -Infinity;

  update(input: SpatialDirectTouchInput, now = performance.now()): SpatialDirectTouchState {
    const point = {
      x: clamp(input.point.x, 0, 1),
      y: clamp(input.point.y, 0, 1),
      z: clamp(input.point.z, -1, 1),
    };

    if (!input.active || input.confidence < MIN_TOUCH_CONFIDENCE) {
      return this.clear(point);
    }

    const hit = hitTestSpatialPoint(point, input.anchors, input.confidence);
    if (!hit) {
      if (this.state.targetId && now - this.lastHitAt <= RELEASE_GRACE_MS) {
        this.state = {
          ...this.state,
          point,
          pinching: input.pinching,
          phase: this.state.ready ? (input.pinching ? 'holding' : 'contact') : 'hover',
        };
        return this.snapshot();
      }
      return this.clear(point);
    }

    this.lastHitAt = now;
    if (this.candidateId !== hit.targetId) {
      this.candidateId = hit.targetId;
      this.candidateSince = now;
    }

    const stableMs = Math.max(0, now - this.candidateSince);
    const ready = stableMs >= CONTACT_DWELL_MS;
    this.state = {
      phase: ready ? (input.pinching ? 'holding' : 'contact') : 'hover',
      targetId: hit.targetId,
      label: hit.label,
      kind: hit.kind,
      since: this.candidateSince,
      ready,
      pinching: input.pinching,
      confidence: hit.confidence,
      point,
      hit,
    };
    return this.snapshot();
  }

  reset(): SpatialDirectTouchState {
    this.candidateId = '';
    this.candidateSince = 0;
    this.lastHitAt = -Infinity;
    this.state = { ...EMPTY_SPATIAL_TOUCH, point: { ...EMPTY_SPATIAL_TOUCH.point } };
    return this.snapshot();
  }

  snapshot(): SpatialDirectTouchState {
    return {
      ...this.state,
      point: { ...this.state.point },
      hit: this.state.hit
        ? {
            ...this.state.hit,
            point: { ...this.state.hit.point },
            center: { ...this.state.hit.center },
          }
        : null,
    };
  }

  private clear(point: SpatialPoint3): SpatialDirectTouchState {
    this.candidateId = '';
    this.candidateSince = 0;
    this.state = {
      ...EMPTY_SPATIAL_TOUCH,
      point,
    };
    return this.snapshot();
  }
}
