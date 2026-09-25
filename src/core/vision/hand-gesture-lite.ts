export type LiteGesture =
  | 'Open_Palm'
  | 'Closed_Fist'
  | 'Thumb_Up'
  | 'Thumb_Down'
  | 'Victory'
  | 'Pointing_Up'
  | 'ILoveYou'
  | 'None';

export interface HandPoint {
  x: number;
  y: number;
  z?: number;
}

export interface LiteGestureResult {
  gesture: LiteGesture;
  score: number;
  extensions: {
    thumb: number;
    index: number;
    middle: number;
    ring: number;
    pinky: number;
  };
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

function distance(a: HandPoint, b: HandPoint): number {
  return Math.hypot(a.x - b.x, a.y - b.y, Number(a.z || 0) - Number(b.z || 0));
}

function extension(points: HandPoint[], tip: number, pip: number, mcp: number): number {
  const wrist = points[0];
  const a = points[tip];
  const b = points[pip];
  const c = points[mcp];
  if (!wrist || !a || !b || !c) return 0;
  const tipRadius = distance(wrist, a);
  const pipRadius = Math.max(1e-5, distance(wrist, b));
  const mcpRadius = Math.max(1e-5, distance(wrist, c));
  const distal = distance(a, b);
  const proximal = Math.max(1e-5, distance(b, c));
  return clamp01(
    ((tipRadius / pipRadius) - 1.02) / 0.42 * 0.68 +
    ((distal / proximal) - 0.52) / 0.62 * 0.32,
  );
}

function thumbExtension(points: HandPoint[]): number {
  const wrist = points[0];
  const tip = points[4];
  const ip = points[3];
  const mcp = points[2];
  if (!wrist || !tip || !ip || !mcp) return 0;
  return clamp01(
    ((distance(wrist, tip) / Math.max(1e-5, distance(wrist, ip))) - 1.02) / 0.38 * 0.72 +
    ((distance(tip, ip) / Math.max(1e-5, distance(ip, mcp))) - 0.56) / 0.58 * 0.28,
  );
}

function patternScore(open: number[], closed: number[]): number {
  const openScore = open.length ? Math.min(...open.map(clamp01)) : 1;
  const closedScore = closed.length ? Math.min(...closed.map((value) => clamp01(1 - value))) : 1;
  return clamp01(openScore * 0.64 + closedScore * 0.36);
}

/**
 * Lightweight geometry-only gesture recognizer used by Holistic Vision.
 * It intentionally covers Mira's interaction gestures, not arbitrary sign language.
 */
export function inferLiteGesture(points: HandPoint[]): LiteGestureResult {
  if (!Array.isArray(points) || points.length < 21) {
    return {
      gesture: 'None',
      score: 0,
      extensions: { thumb: 0, index: 0, middle: 0, ring: 0, pinky: 0 },
    };
  }

  const thumb = thumbExtension(points);
  const index = extension(points, 8, 6, 5);
  const middle = extension(points, 12, 10, 9);
  const ring = extension(points, 16, 14, 13);
  const pinky = extension(points, 20, 18, 17);
  const e = { thumb, index, middle, ring, pinky };

  const candidates: Array<{ gesture: LiteGesture; score: number }> = [
    { gesture: 'Open_Palm', score: patternScore([index, middle, ring, pinky], []) * (0.82 + thumb * 0.18) },
    { gesture: 'Closed_Fist', score: patternScore([], [thumb, index, middle, ring, pinky]) },
    { gesture: 'Victory', score: patternScore([index, middle], [ring, pinky]) },
    { gesture: 'Pointing_Up', score: patternScore([index], [middle, ring, pinky]) },
    { gesture: 'ILoveYou', score: patternScore([thumb, index, pinky], [middle, ring]) },
  ];

  const fingersClosed = patternScore([], [index, middle, ring, pinky]);
  if (thumb >= 0.62 && fingersClosed >= 0.62) {
    const wrist = points[0];
    const thumbTip = points[4];
    const dy = thumbTip.y - wrist.y;
    const thumbVertical = clamp01((Math.abs(dy) - 0.025) / 0.12);
    if (thumbVertical > 0.2) {
      candidates.push({
        gesture: dy < 0 ? 'Thumb_Up' : 'Thumb_Down',
        score: clamp01(thumb * 0.62 + fingersClosed * 0.28 + thumbVertical * 0.1),
      });
    }
  }

  candidates.sort((a, b) => b.score - a.score);
  const best = candidates[0];
  return {
    gesture: best && best.score >= 0.56 ? best.gesture : 'None',
    score: best?.score || 0,
    extensions: e,
  };
}
