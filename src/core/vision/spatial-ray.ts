export interface SpatialVec3 {
  x: number;
  y: number;
  z: number;
}

export interface SpatialRay3D {
  origin: SpatialVec3;
  direction: SpatialVec3;
  confidence: number;
  source: 'hand';
}

export interface SpatialRayTarget {
  id: string;
  label: string;
  left: number;
  top: number;
  right: number;
  bottom: number;
  z: number;
  depthRadius?: number;
  priority?: number;
}

export interface SpatialRayHit {
  targetId: string;
  label: string;
  point: SpatialVec3;
  distance: number;
  confidence: number;
}

export interface SpatialDepthState {
  active: boolean;
  ready: boolean;
  delta: number;
  normalizedDelta: number;
  confidence: number;
  jitter: number;
  samples: number;
}

const DEPTH_READY_SAMPLES = 6;
const DEPTH_DEAD_ZONE = 0.008;
const DEPTH_RANGE = 0.11;
const MAX_HISTORY = 12;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Number.isFinite(value) ? value : 0));
}

function clamp01(value: number): number {
  return clamp(value, 0, 1);
}

function magnitude(v: SpatialVec3): number {
  return Math.hypot(v.x, v.y, v.z);
}

function normalize(v: SpatialVec3): SpatialVec3 | null {
  const length = magnitude(v);
  if (length < 1e-5) return null;
  return { x: v.x / length, y: v.y / length, z: v.z / length };
}

function variance(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  return values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
}

/**
 * Builds a relative 3D pointing ray from the index MCP (5) through the
 * index fingertip (8). Coordinates stay in the MediaPipe normalized camera
 * frame; x is mirrored to match Mira's on-screen preview.
 *
 * This is not metric world-space tracking. A WebXR/ARKit adapter can replace
 * this source later while preserving the same SpatialRay3D contract.
 */
export function handRayFromLandmarks(
  landmarks: Array<{ x: number; y: number; z?: number }>,
): SpatialRay3D | null {
  const base = landmarks[5] || landmarks[6];
  const tip = landmarks[8];
  if (!base || !tip) return null;
  // Web camera coordinates must be finite. Invalid landmarks are dropped, not
  // converted into a misleading normalized pointer/ray.
  for (const point of [base, tip]) {
    if (![point.x, point.y, point.z ?? 0].every(Number.isFinite) ||
        point.x < 0 || point.x > 1 || point.y < 0 || point.y > 1) return null;
  }

  const origin: SpatialVec3 = {
    x: 1 - Number(base.x || 0),
    y: Number(base.y || 0),
    z: Number(base.z || 0),
  };
  const tipPoint: SpatialVec3 = {
    x: 1 - Number(tip.x || 0),
    y: Number(tip.y || 0),
    z: Number(tip.z || 0),
  };
  const direction = normalize({
    x: tipPoint.x - origin.x,
    y: tipPoint.y - origin.y,
    z: tipPoint.z - origin.z,
  });
  if (!direction) return null;

  const segment = Math.hypot(tipPoint.x - origin.x, tipPoint.y - origin.y, tipPoint.z - origin.z);
  return {
    origin,
    direction,
    confidence: clamp01(0.52 + Math.min(0.38, segment * 2.8)),
    source: 'hand',
  };
}

export function intersectRayWithZPlane(
  ray: SpatialRay3D,
  planeZ: number,
): { point: SpatialVec3; distance: number } | null {
  const dz = ray.direction.z;
  if (Math.abs(dz) < 0.015) return null;
  const distance = (planeZ - ray.origin.z) / dz;
  if (!Number.isFinite(distance) || distance < 0 || distance > 4) return null;
  return {
    point: {
      x: ray.origin.x + ray.direction.x * distance,
      y: ray.origin.y + ray.direction.y * distance,
      z: planeZ,
    },
    distance,
  };
}

/**
 * Ray-casts only against explicitly depth-aware targets.
 * Ordinary 2D controls remain on the existing focus/pinch path.
 */
export function hitTestSpatialRay(
  ray: SpatialRay3D | null,
  targets: SpatialRayTarget[],
): SpatialRayHit | null {
  if (!ray || !Number.isFinite(ray.confidence) || ray.confidence < 0.55 ||
      ![...Object.values(ray.origin), ...Object.values(ray.direction)].every(Number.isFinite)) return null;

  const hits = targets
    .filter((target) =>
      [target.z, target.left, target.right, target.top, target.bottom].every(Number.isFinite) &&
      target.right > target.left && target.bottom > target.top
    )
    .map((target) => {
      const hit = intersectRayWithZPlane(ray, target.z);
      if (!hit) return null;
      const radius = Math.max(0, Number(target.depthRadius || 0));
      const inside =
        hit.point.x >= target.left - radius &&
        hit.point.x <= target.right + radius &&
        hit.point.y >= target.top - radius &&
        hit.point.y <= target.bottom + radius;
      if (!inside) return null;
      const cx = (target.left + target.right) / 2;
      const cy = (target.top + target.bottom) / 2;
      const centerError = Math.hypot(hit.point.x - cx, hit.point.y - cy);
      return {
        target,
        hit,
        score: hit.distance + centerError * 0.65 - Number(target.priority || 0),
      };
    })
    .filter(Boolean)
    .sort((a: any, b: any) => a.score - b.score) as Array<{
      target: SpatialRayTarget;
      hit: { point: SpatialVec3; distance: number };
      score: number;
    }>;

  const best = hits[0];
  if (!best) return null;
  return {
    targetId: best.target.id,
    label: best.target.label,
    point: best.hit.point,
    distance: best.hit.distance,
    confidence: clamp01(ray.confidence * (1 - Math.min(0.35, best.score * 0.08))),
  };
}

/**
 * Stabilizes MediaPipe's relative hand-z signal during a pinch grab.
 * It unlocks depth only after several low-jitter samples and returns a
 * normalized relative displacement, not metric distance.
 */
export class SpatialDepthAnchorTracker {
  private baseline = 0;
  private samples: number[] = [];
  private filtered = 0;
  private active = false;

  begin(z: number): SpatialDepthState {
    const value = Number.isFinite(z) ? z : 0;
    this.baseline = value;
    this.filtered = value;
    this.samples = [value];
    this.active = true;
    return this.snapshot();
  }

  update(z: number): SpatialDepthState {
    if (!this.active) return this.snapshot();
    const value = Number.isFinite(z) ? z : this.filtered;
    this.filtered += (value - this.filtered) * 0.24;
    this.samples.push(value);
    if (this.samples.length > MAX_HISTORY) this.samples.shift();

    const recent = this.samples.slice(-DEPTH_READY_SAMPLES);
    const jitter = Math.sqrt(variance(recent));
    const ready = recent.length >= DEPTH_READY_SAMPLES && jitter <= 0.018;
    const rawDelta = this.baseline - this.filtered;
    const delta = Math.abs(rawDelta) <= DEPTH_DEAD_ZONE
      ? 0
      : rawDelta - Math.sign(rawDelta) * DEPTH_DEAD_ZONE;
    const normalizedDelta = ready
      ? clamp(delta / DEPTH_RANGE, -1, 1)
      : 0;
    const confidence = ready
      ? clamp01(1 - jitter / 0.025)
      : clamp01(recent.length / DEPTH_READY_SAMPLES * 0.45);

    return {
      active: true,
      ready,
      delta,
      normalizedDelta,
      confidence,
      jitter,
      samples: this.samples.length,
    };
  }

  end(): SpatialDepthState {
    const state = this.snapshot();
    this.reset();
    return state;
  }

  reset(): void {
    this.baseline = 0;
    this.samples = [];
    this.filtered = 0;
    this.active = false;
  }

  snapshot(): SpatialDepthState {
    const recent = this.samples.slice(-DEPTH_READY_SAMPLES);
    const jitter = Math.sqrt(variance(recent));
    const ready = this.active && recent.length >= DEPTH_READY_SAMPLES && jitter <= 0.018;
    const rawDelta = this.baseline - this.filtered;
    const delta = Math.abs(rawDelta) <= DEPTH_DEAD_ZONE
      ? 0
      : rawDelta - Math.sign(rawDelta) * DEPTH_DEAD_ZONE;
    return {
      active: this.active,
      ready,
      delta,
      normalizedDelta: ready ? clamp(delta / DEPTH_RANGE, -1, 1) : 0,
      confidence: ready ? clamp01(1 - jitter / 0.025) : clamp01(recent.length / DEPTH_READY_SAMPLES * 0.45),
      jitter,
      samples: this.samples.length,
    };
  }
}
