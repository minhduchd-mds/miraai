import type { PhotorealVisualQuality } from './photoreal-depth';

export interface PhotorealCameraPoseInput {
  enabled: boolean;
  yaw: number;
  pitch: number;
  roll: number;
  distanceM: number;
  baselineDistanceM: number;
  confidence: number;
  quality: PhotorealVisualQuality;
}

export interface PhotorealCameraSpatialFrame {
  roomX: number;
  roomY: number;
  subjectX: number;
  subjectY: number;
  foregroundX: number;
  foregroundY: number;
  rotateXDeg: number;
  rotateYDeg: number;
  rollDeg: number;
  scale: number;
  shadowX: number;
  intensity: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Number.isFinite(value) ? value : 0));
}

function clamp01(value: number): number {
  return clamp(value, 0, 1);
}

/**
 * Converts existing camera head-pose telemetry into a bounded, presentation-only
 * 3D viewpoint. This never infers scene geometry and remains session-only.
 */
export function computeCameraSpatialFrame(
  input: PhotorealCameraPoseInput,
): PhotorealCameraSpatialFrame {
  const gain = {
    lite: 0,
    balanced: 0.56,
    high: 0.8,
    ultra: 1,
  }[input.quality];
  const confidence = clamp01(input.confidence);

  if (!input.enabled || confidence < 0.42 || gain === 0) {
    return {
      roomX: 0,
      roomY: 0,
      subjectX: 0,
      subjectY: 0,
      foregroundX: 0,
      foregroundY: 0,
      rotateXDeg: 0,
      rotateYDeg: 0,
      rollDeg: 0,
      scale: 1,
      shadowX: 0,
      intensity: 0,
    };
  }

  const yaw = clamp(input.yaw / 0.68, -1, 1);
  const pitch = clamp(input.pitch / 0.52, -1, 1);
  const roll = clamp(input.roll / 0.48, -1, 1);
  const baseline = Number(input.baselineDistanceM || 0);
  const distance = Number(input.distanceM || 0);
  const relativeDepth = baseline > 0.1 && distance > 0.1
    ? clamp((baseline - distance) / Math.max(0.18, baseline * 0.45), -1, 1)
    : 0;
  const intensity = clamp(confidence * gain, 0, 1);

  return {
    roomX: clamp(-yaw * 4.2 * intensity, -4.2, 4.2),
    roomY: clamp(-pitch * 2.8 * intensity, -2.8, 2.8),
    subjectX: clamp(-yaw * 8.4 * intensity, -8.4, 8.4),
    subjectY: clamp(-pitch * 5.6 * intensity, -5.6, 5.6),
    foregroundX: clamp(-yaw * 12.6 * intensity, -12.6, 12.6),
    foregroundY: clamp(-pitch * 8.1 * intensity, -8.1, 8.1),
    rotateXDeg: clamp(-pitch * 1.9 * intensity, -1.9, 1.9),
    rotateYDeg: clamp(yaw * 3.1 * intensity, -3.1, 3.1),
    rollDeg: clamp(-roll * 0.7 * intensity, -0.7, 0.7),
    scale: clamp(1 + relativeDepth * 0.038 * intensity, 0.968, 1.038),
    shadowX: clamp(yaw * 9 * intensity, -9, 9),
    intensity,
  };
}
