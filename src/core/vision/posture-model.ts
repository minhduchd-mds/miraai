export type PostureLabel = 'upright' | 'lean_left' | 'lean_right' | 'slouched' | 'moving' | 'unknown';

export interface PosePoint {
  x: number;
  y: number;
  z?: number;
  visibility?: number;
}

export interface PostureEstimate {
  present: boolean;
  label: PostureLabel;
  confidence: number;
  upright: number;
  slump: number;
  lean: number;
  shoulderSlope: number;
  torsoLength: number;
  centerX: number;
  centerY: number;
}

export const EMPTY_POSTURE: PostureEstimate = {
  present: false,
  label: 'unknown',
  confidence: 0,
  upright: 0,
  slump: 0,
  lean: 0,
  shoulderSlope: 0,
  torsoLength: 0,
  centerX: 0.5,
  centerY: 0.5,
};

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

function point(points: PosePoint[], index: number): PosePoint | null {
  const p = points[index];
  if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) return null;
  return p;
}

function midpoint(a: PosePoint, b: PosePoint) {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function distance(a: PosePoint, b: PosePoint): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/**
 * 2D posture estimate from MediaPipe pose landmarks.
 * "Slouched" here is only a visual geometry label, not a health assessment.
 */
export function derivePosture(points: PosePoint[]): PostureEstimate {
  const nose = point(points, 0);
  const leftShoulder = point(points, 11);
  const rightShoulder = point(points, 12);
  const leftHip = point(points, 23);
  const rightHip = point(points, 24);
  if (!nose || !leftShoulder || !rightShoulder || !leftHip || !rightHip) return { ...EMPTY_POSTURE };

  const shoulder = midpoint(leftShoulder, rightShoulder);
  const hip = midpoint(leftHip, rightHip);
  const shoulderWidth = Math.max(0.05, distance(leftShoulder, rightShoulder));
  const torsoLength = Math.max(0.04, Math.hypot(hip.x - shoulder.x, hip.y - shoulder.y));
  const vis = [nose, leftShoulder, rightShoulder, leftHip, rightHip]
    .map((p) => Number.isFinite(p.visibility) ? Number(p.visibility) : 0.8);
  const confidence = clamp01(vis.reduce((a, b) => a + b, 0) / vis.length);

  if (confidence < 0.34 || torsoLength < 0.055) return { ...EMPTY_POSTURE, confidence };

  const lean = Math.max(-1, Math.min(1, (shoulder.x - hip.x) / shoulderWidth));
  const headLift = (shoulder.y - nose.y) / torsoLength;
  const slump = clamp01((0.58 - headLift) / 0.34);
  const shoulderSlope = Math.max(-1, Math.min(1, (leftShoulder.y - rightShoulder.y) / shoulderWidth));
  const upright = clamp01(1 - slump * 0.78 - Math.abs(lean) * 0.36 - Math.abs(shoulderSlope) * 0.12);

  let label: PostureLabel = 'upright';
  if (slump >= 0.58) label = 'slouched';
  else if (lean <= -0.3) label = 'lean_left';
  else if (lean >= 0.3) label = 'lean_right';

  return {
    present: true,
    label,
    confidence,
    upright,
    slump,
    lean,
    shoulderSlope,
    torsoLength,
    centerX: (shoulder.x + hip.x) / 2,
    centerY: (shoulder.y + hip.y) / 2,
  };
}
