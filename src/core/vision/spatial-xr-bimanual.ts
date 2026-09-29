export interface XRBimanualMetricPoint {
  x: number;
  y: number;
  z: number;
}

export interface XRBimanualHandSample {
  handedness: string;
  pinching: boolean;
  indexTip: XRBimanualMetricPoint | null;
  thumbTip: XRBimanualMetricPoint | null;
  wrist: XRBimanualMetricPoint | null;
}

export interface XRBimanualTransform {
  objectId: string;
  active: boolean;
  scaleRatio: number;
  yawDeg: number;
  pitchDeg: number;
  rollDeg: number;
  metricCenterDelta: XRBimanualMetricPoint;
}

interface BimanualFrame {
  center: XRBimanualMetricPoint;
  distance: number;
  yawDeg: number;
  pitchDeg: number;
  rollDeg: number;
}

interface BimanualSession {
  objectId: string;
  start: BimanualFrame;
  base: XRBimanualTransform;
  last: XRBimanualTransform;
}

const MIN_PAIR_DISTANCE_M = 0.055;
const MIN_SCALE = 0.58;
const MAX_SCALE = 1.72;
const MAX_YAW_DEG = 72;
const MAX_PITCH_DEG = 58;
const MAX_ROLL_DEG = 95;
const SMOOTHING = 0.28;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Number.isFinite(value) ? value : 0));
}

function finitePoint(point: XRBimanualMetricPoint | null | undefined): XRBimanualMetricPoint | null {
  if (!point) return null;
  const x = Number(point.x);
  const y = Number(point.y);
  const z = Number(point.z);
  if (![x, y, z].every(Number.isFinite)) return null;
  return { x, y, z };
}

function add(a: XRBimanualMetricPoint, b: XRBimanualMetricPoint): XRBimanualMetricPoint {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

function subtract(a: XRBimanualMetricPoint, b: XRBimanualMetricPoint): XRBimanualMetricPoint {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

function multiply(point: XRBimanualMetricPoint, scalar: number): XRBimanualMetricPoint {
  return { x: point.x * scalar, y: point.y * scalar, z: point.z * scalar };
}

function dot(a: XRBimanualMetricPoint, b: XRBimanualMetricPoint): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

function cross(a: XRBimanualMetricPoint, b: XRBimanualMetricPoint): XRBimanualMetricPoint {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

function length(point: XRBimanualMetricPoint): number {
  return Math.hypot(point.x, point.y, point.z);
}

function normalize(point: XRBimanualMetricPoint): XRBimanualMetricPoint | null {
  const magnitude = length(point);
  if (!Number.isFinite(magnitude) || magnitude < 1e-6) return null;
  return multiply(point, 1 / magnitude);
}

function midpoint(a: XRBimanualMetricPoint, b: XRBimanualMetricPoint): XRBimanualMetricPoint {
  return multiply(add(a, b), 0.5);
}

function pinchCenter(hand: XRBimanualHandSample): XRBimanualMetricPoint | null {
  const index = finitePoint(hand.indexTip);
  const thumb = finitePoint(hand.thumbTip);
  if (!index || !thumb) return null;
  return midpoint(index, thumb);
}

function wrapDegrees(value: number): number {
  let next = Number.isFinite(value) ? value : 0;
  while (next > 180) next -= 360;
  while (next < -180) next += 360;
  return next;
}

function radiansToDegrees(value: number): number {
  return value * 180 / Math.PI;
}

function signedAngleDeg(
  from: XRBimanualMetricPoint,
  to: XRBimanualMetricPoint,
  around: XRBimanualMetricPoint,
): number {
  const sin = dot(around, cross(from, to));
  const cos = clamp(dot(from, to), -1, 1);
  return radiansToDegrees(Math.atan2(sin, cos));
}

function defaultTransform(objectId: string): XRBimanualTransform {
  return {
    objectId,
    active: false,
    scaleRatio: 1,
    yawDeg: 0,
    pitchDeg: 0,
    rollDeg: 0,
    metricCenterDelta: { x: 0, y: 0, z: 0 },
  };
}

function cloneTransform(value: XRBimanualTransform): XRBimanualTransform {
  return {
    ...value,
    metricCenterDelta: { ...value.metricCenterDelta },
  };
}

function orderedPair(hands: XRBimanualHandSample[]): XRBimanualHandSample[] | null {
  const candidates = hands.filter((hand) =>
    Boolean(hand?.pinching && finitePoint(hand.indexTip) && finitePoint(hand.thumbTip)),
  );
  if (candidates.length < 2) return null;

  const pair = candidates.slice(0, 2);
  pair.sort((a, b) => {
    const aHand = String(a.handedness || '').toLowerCase();
    const bHand = String(b.handedness || '').toLowerCase();
    if (aHand === bHand) {
      return (pinchCenter(a)?.x || 0) - (pinchCenter(b)?.x || 0);
    }
    if (aHand.includes('left')) return -1;
    if (bHand.includes('left')) return 1;
    return aHand.localeCompare(bHand);
  });
  return pair;
}

function frameFromHands(hands: XRBimanualHandSample[]): BimanualFrame | null {
  const pair = orderedPair(hands);
  if (!pair) return null;

  const firstCenter = pinchCenter(pair[0]);
  const secondCenter = pinchCenter(pair[1]);
  if (!firstCenter || !secondCenter) return null;

  const between = subtract(secondCenter, firstCenter);
  const distance = length(between);
  const axis = normalize(between);
  if (!axis || distance < MIN_PAIR_DISTANCE_M) return null;

  const wristA = finitePoint(pair[0].wrist);
  const wristB = finitePoint(pair[1].wrist);
  const guideA = wristA ? normalize(subtract(firstCenter, wristA)) : null;
  const guideB = wristB ? normalize(subtract(secondCenter, wristB)) : null;
  const guide = normalize(add(
    guideA || { x: 0, y: 1, z: 0 },
    guideB || { x: 0, y: 1, z: 0 },
  )) || { x: 0, y: 1, z: 0 };

  let referenceUp = subtract({ x: 0, y: 1, z: 0 }, multiply(axis, dot({ x: 0, y: 1, z: 0 }, axis)));
  if (length(referenceUp) < 1e-4) {
    referenceUp = subtract({ x: 0, y: 0, z: 1 }, multiply(axis, dot({ x: 0, y: 0, z: 1 }, axis)));
  }
  const normalizedReferenceUp = normalize(referenceUp) || { x: 0, y: 1, z: 0 };

  let actualUp = subtract(guide, multiply(axis, dot(guide, axis)));
  actualUp = normalize(actualUp) || normalizedReferenceUp;

  const yawDeg = radiansToDegrees(Math.atan2(axis.z, axis.x));
  const pitchDeg = radiansToDegrees(Math.atan2(axis.y, Math.hypot(axis.x, axis.z)));
  const rollDeg = signedAngleDeg(normalizedReferenceUp, actualUp, axis);

  return {
    center: midpoint(firstCenter, secondCenter),
    distance,
    yawDeg,
    pitchDeg,
    rollDeg,
  };
}

/**
 * Session-only two-hand metric XR transform layer.
 *
 * This runtime consumes real XR joint coordinates only. It never invents
 * metric depth from webcam data and never writes metric coordinates into
 * SpatialObjectRuntime. Translation stays metric here; scale/orientation are
 * emitted as bounded presentation transforms for the DOM spatial layer.
 */
export class SpatialXRBimanualRuntime {
  private session: BimanualSession | null = null;
  private committed = new Map<string, XRBimanualTransform>();

  begin(objectId: string, hands: XRBimanualHandSample[]): XRBimanualTransform | null {
    if (!objectId) return null;
    const start = frameFromHands(hands);
    if (!start) return null;

    const base = this.committed.get(objectId) || defaultTransform(objectId);
    const initial = { ...cloneTransform(base), active: true };
    this.session = {
      objectId,
      start,
      base: cloneTransform(base),
      last: cloneTransform(initial),
    };
    return cloneTransform(initial);
  }

  update(objectId: string, hands: XRBimanualHandSample[]): XRBimanualTransform | null {
    if (!this.session || this.session.objectId !== objectId) return null;
    const current = frameFromHands(hands);
    if (!current) return cloneTransform(this.session.last);

    const base = this.session.base;
    const start = this.session.start;
    const targetScale = clamp(
      base.scaleRatio * current.distance / Math.max(MIN_PAIR_DISTANCE_M, start.distance),
      MIN_SCALE,
      MAX_SCALE,
    );
    const targetYaw = clamp(
      base.yawDeg + wrapDegrees(current.yawDeg - start.yawDeg),
      -MAX_YAW_DEG,
      MAX_YAW_DEG,
    );
    const targetPitch = clamp(
      base.pitchDeg + wrapDegrees(current.pitchDeg - start.pitchDeg),
      -MAX_PITCH_DEG,
      MAX_PITCH_DEG,
    );
    const targetRoll = clamp(
      base.rollDeg + wrapDegrees(current.rollDeg - start.rollDeg),
      -MAX_ROLL_DEG,
      MAX_ROLL_DEG,
    );
    const targetCenterDelta = subtract(current.center, start.center);
    const previous = this.session.last;

    const next: XRBimanualTransform = {
      objectId,
      active: true,
      scaleRatio: previous.scaleRatio + (targetScale - previous.scaleRatio) * SMOOTHING,
      yawDeg: previous.yawDeg + (targetYaw - previous.yawDeg) * SMOOTHING,
      pitchDeg: previous.pitchDeg + (targetPitch - previous.pitchDeg) * SMOOTHING,
      rollDeg: previous.rollDeg + (targetRoll - previous.rollDeg) * SMOOTHING,
      metricCenterDelta: {
        x: previous.metricCenterDelta.x + (targetCenterDelta.x - previous.metricCenterDelta.x) * SMOOTHING,
        y: previous.metricCenterDelta.y + (targetCenterDelta.y - previous.metricCenterDelta.y) * SMOOTHING,
        z: previous.metricCenterDelta.z + (targetCenterDelta.z - previous.metricCenterDelta.z) * SMOOTHING,
      },
    };
    this.session.last = next;
    return cloneTransform(next);
  }

  end(objectId?: string): XRBimanualTransform | null {
    if (!this.session || (objectId && this.session.objectId !== objectId)) return null;
    const committed = { ...cloneTransform(this.session.last), active: false };
    this.committed.set(committed.objectId, cloneTransform(committed));
    this.session = null;
    return cloneTransform(committed);
  }

  snapshot(objectId: string): XRBimanualTransform {
    if (this.session?.objectId === objectId) return cloneTransform(this.session.last);
    return cloneTransform(this.committed.get(objectId) || defaultTransform(objectId));
  }

  commitExternal(objectId: string, transform: XRBimanualTransform): XRBimanualTransform {
    const next: XRBimanualTransform = {
      objectId,
      active: false,
      scaleRatio: clamp(Number(transform.scaleRatio || 1), MIN_SCALE, MAX_SCALE),
      yawDeg: clamp(Number(transform.yawDeg || 0), -MAX_YAW_DEG, MAX_YAW_DEG),
      pitchDeg: clamp(Number(transform.pitchDeg || 0), -MAX_PITCH_DEG, MAX_PITCH_DEG),
      rollDeg: clamp(Number(transform.rollDeg || 0), -MAX_ROLL_DEG, MAX_ROLL_DEG),
      metricCenterDelta: {
        x: Number.isFinite(Number(transform.metricCenterDelta?.x)) ? Number(transform.metricCenterDelta.x) : 0,
        y: Number.isFinite(Number(transform.metricCenterDelta?.y)) ? Number(transform.metricCenterDelta.y) : 0,
        z: Number.isFinite(Number(transform.metricCenterDelta?.z)) ? Number(transform.metricCenterDelta.z) : 0,
      },
    };
    this.committed.set(objectId, cloneTransform(next));
    if (this.session?.objectId === objectId) {
      this.session.base = cloneTransform(next);
      this.session.last = cloneTransform(next);
    }
    return cloneTransform(next);
  }

  resetObject(objectId: string): XRBimanualTransform {
    if (this.session?.objectId === objectId) this.session = null;
    this.committed.delete(objectId);
    return defaultTransform(objectId);
  }

  reset(): void {
    this.session = null;
    this.committed.clear();
  }
}
