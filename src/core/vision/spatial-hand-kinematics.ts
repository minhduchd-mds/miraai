export interface SpatialHandPoint {
  x: number;
  y: number;
  z: number;
}

export interface SpatialFingerState {
  curl: number;
  extension: number;
  tip: SpatialHandPoint;
  velocity: SpatialHandPoint;
}

export interface SpatialHandKinematicsState {
  handedness: string;
  present: boolean;
  confidence: number;
  palmCenter: SpatialHandPoint;
  palmNormal: SpatialHandPoint;
  palmSpan: number;
  handLength: number;
  pinchRatio: number;
  pinching: boolean;
  pinchConfidence: number;
  pointingConfidence: number;
  palmFacingConfidence: number;
  speed: number;
  stability: number;
  approachVelocity: number;
  contactRadius: number;
  index: SpatialFingerState;
  middle: SpatialFingerState;
  ring: SpatialFingerState;
  pinky: SpatialFingerState;
  thumb: SpatialFingerState;
  source: 'normalized' | 'world-shape';
  at: number;
}

interface HandSample {
  handedness: string;
  landmarks: Array<{ x: number; y: number; z?: number }>;
  worldLandmarks?: Array<{ x: number; y: number; z?: number }> | null;
  confidence?: number;
}

interface History {
  at: number;
  tips: Record<string, SpatialHandPoint>;
  palmCenter: SpatialHandPoint;
  state: SpatialHandKinematicsState;
}

const MIN_DT = 0.008;
const MAX_DT = 0.12;
const PINCH_RATIO_START = 0.52;
const PINCH_RATIO_FULL = 0.3;
const MAX_HISTORY_GAP_MS = 260;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Number.isFinite(value) ? value : 0));
}

function clamp01(value: number): number {
  return clamp(value, 0, 1);
}

function point(value: { x: number; y: number; z?: number } | undefined): SpatialHandPoint {
  return {
    x: Number(value?.x || 0),
    y: Number(value?.y || 0),
    z: Number(value?.z || 0),
  };
}

function add(a: SpatialHandPoint, b: SpatialHandPoint): SpatialHandPoint {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

function sub(a: SpatialHandPoint, b: SpatialHandPoint): SpatialHandPoint {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

function scale(a: SpatialHandPoint, s: number): SpatialHandPoint {
  return { x: a.x * s, y: a.y * s, z: a.z * s };
}

function magnitude(a: SpatialHandPoint): number {
  return Math.hypot(a.x, a.y, a.z);
}

function distance(a: SpatialHandPoint, b: SpatialHandPoint): number {
  return magnitude(sub(a, b));
}

function normalize(a: SpatialHandPoint): SpatialHandPoint {
  const length = magnitude(a);
  if (length < 1e-6) return { x: 0, y: 0, z: 0 };
  return scale(a, 1 / length);
}

function cross(a: SpatialHandPoint, b: SpatialHandPoint): SpatialHandPoint {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

function mean(points: SpatialHandPoint[]): SpatialHandPoint {
  if (!points.length) return { x: 0, y: 0, z: 0 };
  return scale(points.reduce(add, { x: 0, y: 0, z: 0 }), 1 / points.length);
}

function velocity(current: SpatialHandPoint, previous: SpatialHandPoint | undefined, dt: number): SpatialHandPoint {
  if (!previous || dt <= 0) return { x: 0, y: 0, z: 0 };
  return scale(sub(current, previous), 1 / dt);
}

function fingerExtension(points: SpatialHandPoint[], tip: number, pip: number, mcp: number): number {
  const wrist = points[0];
  const a = points[tip];
  const b = points[pip];
  const c = points[mcp];
  if (!wrist || !a || !b || !c) return 0;
  const radial = distance(wrist, a) / Math.max(1e-5, distance(wrist, b));
  const distal = distance(a, b) / Math.max(1e-5, distance(b, c));
  return clamp01(((radial - 1.01) / 0.46) * 0.68 + ((distal - 0.5) / 0.7) * 0.32);
}

function thumbExtension(points: SpatialHandPoint[]): number {
  const wrist = points[0];
  const tip = points[4];
  const ip = points[3];
  const mcp = points[2];
  if (!wrist || !tip || !ip || !mcp) return 0;
  return clamp01(
    ((distance(wrist, tip) / Math.max(1e-5, distance(wrist, ip))) - 1.01) / 0.42 * 0.7 +
    ((distance(tip, ip) / Math.max(1e-5, distance(ip, mcp))) - 0.5) / 0.68 * 0.3,
  );
}

function emptyFinger(): SpatialFingerState {
  return {
    curl: 1,
    extension: 0,
    tip: { x: 0, y: 0, z: 0 },
    velocity: { x: 0, y: 0, z: 0 },
  };
}

export const EMPTY_HAND_KINEMATICS: SpatialHandKinematicsState = {
  handedness: 'none',
  present: false,
  confidence: 0,
  palmCenter: { x: 0.5, y: 0.5, z: 0 },
  palmNormal: { x: 0, y: 0, z: 1 },
  palmSpan: 0,
  handLength: 0,
  pinchRatio: 1,
  pinching: false,
  pinchConfidence: 0,
  pointingConfidence: 0,
  palmFacingConfidence: 0,
  speed: 0,
  stability: 0,
  approachVelocity: 0,
  contactRadius: 0.018,
  index: emptyFinger(),
  middle: emptyFinger(),
  ring: emptyFinger(),
  pinky: emptyFinger(),
  thumb: emptyFinger(),
  source: 'normalized',
  at: 0,
};

export class SpatialHandKinematicsTracker {
  private history = new Map<string, History>();

  update(sample: HandSample, now = performance.now()): SpatialHandKinematicsState {
    const raw = sample.landmarks?.slice(0, 21) || [];
    if (raw.length < 21) {
      this.history.delete(sample.handedness);
      return { ...EMPTY_HAND_KINEMATICS, handedness: sample.handedness || 'none', at: now };
    }

    const normalized = raw.map(point);
    const world = sample.worldLandmarks?.slice(0, 21).map(point) || null;
    const shape = world && world.length >= 21 ? world : normalized;
    const source = world && world.length >= 21 ? 'world-shape' as const : 'normalized' as const;

    const wrist = shape[0];
    const indexMcp = shape[5];
    const middleMcp = shape[9];
    const pinkyMcp = shape[17];
    const palmCenterShape = mean([wrist, indexMcp, middleMcp, pinkyMcp]);
    const palmCenter = mean([normalized[0], normalized[5], normalized[9], normalized[17]]);
    const palmSpan = Math.max(1e-5, distance(indexMcp, pinkyMcp));
    const handLength = Math.max(1e-5, distance(wrist, shape[12]));
    const normalRaw = cross(sub(indexMcp, wrist), sub(pinkyMcp, wrist));
    const palmNormal = normalize(normalRaw);
    const palmFacingConfidence = clamp01((Math.abs(palmNormal.z) - 0.08) / 0.72);

    const pinchDistance = distance(shape[4], shape[8]);
    const pinchRatio = pinchDistance / palmSpan;
    const pinchConfidence = clamp01((PINCH_RATIO_START - pinchRatio) / (PINCH_RATIO_START - PINCH_RATIO_FULL));
    const pinching = pinchRatio <= PINCH_RATIO_START && pinchConfidence >= 0.18;

    const ext = {
      thumb: thumbExtension(shape),
      index: fingerExtension(shape, 8, 6, 5),
      middle: fingerExtension(shape, 12, 10, 9),
      ring: fingerExtension(shape, 16, 14, 13),
      pinky: fingerExtension(shape, 20, 18, 17),
    };

    const previous = this.history.get(sample.handedness);
    const historyValid = previous && now - previous.at <= MAX_HISTORY_GAP_MS;
    const dt = historyValid ? clamp((now - previous.at) / 1000, MIN_DT, MAX_DT) : 0;
    const tips: Record<string, SpatialHandPoint> = {
      thumb: normalized[4],
      index: normalized[8],
      middle: normalized[12],
      ring: normalized[16],
      pinky: normalized[20],
    };

    const finger = (name: keyof typeof tips, extension: number): SpatialFingerState => ({
      curl: clamp01(1 - extension),
      extension,
      tip: { ...tips[name] },
      velocity: velocity(tips[name], historyValid ? previous?.tips[name] : undefined, dt),
    });

    const index = finger('index', ext.index);
    const middle = finger('middle', ext.middle);
    const ring = finger('ring', ext.ring);
    const pinky = finger('pinky', ext.pinky);
    const thumb = finger('thumb', ext.thumb);

    const palmVelocity = velocity(
      palmCenter,
      historyValid ? previous?.palmCenter : undefined,
      dt,
    );
    const speed = magnitude(palmVelocity);
    const stability = clamp01(1 - speed / 1.2);
    const otherCurl = (middle.curl + ring.curl + pinky.curl) / 3;
    const pointingConfidence = clamp01(
      index.extension * 0.62 +
      otherCurl * 0.24 +
      palmFacingConfidence * 0.14
    );
    const approachVelocity = index.velocity.z;
    const contactRadius = clamp(
      (distance(normalized[5], normalized[17]) || 0.08) * 0.16,
      0.012,
      0.038,
    );

    const confidence = clamp01(Number(sample.confidence ?? 0.8));
    const state: SpatialHandKinematicsState = {
      handedness: sample.handedness || 'unknown',
      present: true,
      confidence,
      palmCenter,
      palmNormal,
      palmSpan,
      handLength,
      pinchRatio,
      pinching,
      pinchConfidence,
      pointingConfidence,
      palmFacingConfidence,
      speed,
      stability,
      approachVelocity,
      contactRadius,
      index,
      middle,
      ring,
      pinky,
      thumb,
      source,
      at: now,
    };

    this.history.set(state.handedness, {
      at: now,
      tips: Object.fromEntries(Object.entries(tips).map(([key, value]) => [key, { ...value }])),
      palmCenter: { ...palmCenter },
      state,
    });
    return state;
  }

  snapshot(handedness: string): SpatialHandKinematicsState {
    const value = this.history.get(handedness)?.state;
    return value ? structuredCloneLike(value) : { ...EMPTY_HAND_KINEMATICS, handedness };
  }

  reset(): void {
    this.history.clear();
  }
}

function structuredCloneLike(value: SpatialHandKinematicsState): SpatialHandKinematicsState {
  return {
    ...value,
    palmCenter: { ...value.palmCenter },
    palmNormal: { ...value.palmNormal },
    index: { ...value.index, tip: { ...value.index.tip }, velocity: { ...value.index.velocity } },
    middle: { ...value.middle, tip: { ...value.middle.tip }, velocity: { ...value.middle.velocity } },
    ring: { ...value.ring, tip: { ...value.ring.tip }, velocity: { ...value.ring.velocity } },
    pinky: { ...value.pinky, tip: { ...value.pinky.tip }, velocity: { ...value.pinky.velocity } },
    thumb: { ...value.thumb, tip: { ...value.thumb.tip }, velocity: { ...value.thumb.velocity } },
  };
}
