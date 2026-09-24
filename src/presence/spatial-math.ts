export interface Point2 {
  x: number;
  y: number;
}

export interface TwoHandGeometry {
  center: Point2;
  distance: number;
  angleDeg: number;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function smoothValue(previous: number, next: number, alpha: number): number {
  const a = clamp(alpha, 0, 1);
  return previous + (next - previous) * a;
}

export function measureTwoHands(a: Point2, b: Point2): TwoHandGeometry {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return {
    center: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
    distance: Math.hypot(dx, dy),
    angleDeg: Math.atan2(dy, dx) * 180 / Math.PI,
  };
}

export function shortestAngleDeltaDeg(from: number, to: number): number {
  let delta = (to - from) % 360;
  if (delta > 180) delta -= 360;
  if (delta < -180) delta += 360;
  return delta;
}

export function scaleFromDistance(
  baseScale: number,
  startDistance: number,
  currentDistance: number,
  min = 0.72,
  max = 1.55,
): number {
  if (startDistance <= 0.001) return clamp(baseScale, min, max);
  return clamp(baseScale * (currentDistance / startDistance), min, max);
}

export function rotationFromAngles(
  baseRotation: number,
  startAngle: number,
  currentAngle: number,
  min = -24,
  max = 24,
): number {
  return clamp(baseRotation + shortestAngleDeltaDeg(startAngle, currentAngle), min, max);
}
