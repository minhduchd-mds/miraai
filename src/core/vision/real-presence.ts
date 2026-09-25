export interface FaceSpatialPoint {
  x: number;
  y: number;
  z?: number;
}

export type PresenceProximity = 'near' | 'conversation' | 'far' | 'unknown';

export interface RealPresencePose {
  present: boolean;
  centerX: number;
  centerY: number;
  faceWidth: number;
  faceHeight: number;
  distanceM: number;
  proximity: PresenceProximity;
  confidence: number;
  sceneOffsetX: number;
  sceneOffsetY: number;
  sceneScale: number;
}

export const EMPTY_REAL_PRESENCE_POSE: RealPresencePose = {
  present: false,
  centerX: 0.5,
  centerY: 0.5,
  faceWidth: 0,
  faceHeight: 0,
  distanceM: 0,
  proximity: 'unknown',
  confidence: 0,
  sceneOffsetX: 0,
  sceneOffsetY: 0,
  sceneScale: 1,
};

const FACE_WIDTH_M = 0.155;
const HORIZONTAL_FOV_DEG = 62;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Number.isFinite(value) ? value : min));
}

function proximityFor(distanceM: number): PresenceProximity {
  if (!Number.isFinite(distanceM) || distanceM <= 0) return 'unknown';
  if (distanceM <= 0.55) return 'near';
  if (distanceM <= 1.15) return 'conversation';
  return 'far';
}

export function estimateFaceDistanceM(faceWidthNormalized: number): number {
  const width = clamp(faceWidthNormalized, 0.04, 0.8);
  const faceAngularWidth = width * (HORIZONTAL_FOV_DEG * Math.PI / 180);
  const distance = FACE_WIDTH_M / (2 * Math.tan(faceAngularWidth / 2));
  return clamp(distance, 0.28, 2.4);
}

/**
 * Builds a privacy-preserving spatial pose from landmarks only.
 * This is not identity recognition and does not persist camera frames.
 */
export function estimateRealPresencePose(points: FaceSpatialPoint[]): RealPresencePose {
  if (!Array.isArray(points) || points.length < 100) return { ...EMPTY_REAL_PRESENCE_POSE };

  let minX = 1;
  let minY = 1;
  let maxX = 0;
  let maxY = 0;
  let valid = 0;

  for (const point of points) {
    if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) continue;
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
    valid += 1;
  }

  if (valid < 100) return { ...EMPTY_REAL_PRESENCE_POSE };

  const faceWidth = clamp(maxX - minX, 0, 1);
  const faceHeight = clamp(maxY - minY, 0, 1);
  if (faceWidth < 0.045 || faceHeight < 0.055) return { ...EMPTY_REAL_PRESENCE_POSE };

  const centerX = clamp((minX + maxX) / 2, 0, 1);
  const centerY = clamp((minY + maxY) / 2, 0, 1);
  const distanceM = estimateFaceDistanceM(faceWidth);

  // Preview is mirrored, so convert the camera coordinate into visual space.
  const visualX = 1 - centerX;
  const lateral = clamp((visualX - 0.5) * 2, -1, 1);
  const vertical = clamp((centerY - 0.46) * 2.4, -1, 1);

  // Keep the person in the right-side "seat" zone of the current bedroom scene,
  // but let real head position subtly influence placement.
  const sceneOffsetX = clamp(lateral * 32, -32, 32);
  const sceneOffsetY = clamp(vertical * 22, -18, 26);
  const sceneScale = clamp(0.72 / distanceM, 0.72, 1.22);

  const sizeQuality = clamp((faceWidth - 0.055) / 0.16, 0, 1);
  const centerQuality = 1 - clamp(Math.hypot(centerX - 0.5, centerY - 0.48) / 0.72, 0, 1);
  const confidence = clamp(0.5 + sizeQuality * 0.32 + centerQuality * 0.18, 0, 1);

  return {
    present: true,
    centerX,
    centerY,
    faceWidth,
    faceHeight,
    distanceM,
    proximity: proximityFor(distanceM),
    confidence,
    sceneOffsetX,
    sceneOffsetY,
    sceneScale,
  };
}
