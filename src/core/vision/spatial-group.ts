import type { SpatialObjectPose, SpatialObjectState } from './spatial-object';

export interface SpatialGroupTransformSession {
  ids: string[];
  center: { x: number; y: number; z: number };
  basePoses: Record<string, SpatialObjectPose>;
}

export interface SpatialGroupTransformInput {
  translateX?: number;
  translateY?: number;
  translateZ?: number;
  scaleRatio?: number;
  rotationDelta?: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Number.isFinite(value) ? value : 0));
}

function normalizeRotation(value: number): number {
  let next = Number.isFinite(value) ? value : 0;
  while (next > 180) next -= 360;
  while (next < -180) next += 360;
  return next;
}

function rotate2D(x: number, y: number, degrees: number): { x: number; y: number } {
  const radians = degrees * Math.PI / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  return {
    x: x * cos - y * sin,
    y: x * sin + y * cos,
  };
}

export function beginSpatialGroupTransform(
  objects: SpatialObjectState[],
  ids: string[],
): SpatialGroupTransformSession | null {
  const unique = Array.from(new Set(ids));
  const members = unique
    .map((id) => objects.find((object) => object.id === id))
    .filter(Boolean) as SpatialObjectState[];
  if (!members.length) return null;

  const center = members.reduce((acc, object) => ({
    x: acc.x + object.pose.position.x / members.length,
    y: acc.y + object.pose.position.y / members.length,
    z: acc.z + object.pose.position.z / members.length,
  }), { x: 0, y: 0, z: 0 });

  const basePoses = Object.fromEntries(members.map((object) => [
    object.id,
    {
      position: { ...object.pose.position },
      scale: object.pose.scale,
      rotation: object.pose.rotation,
    },
  ]));

  return {
    ids: members.map((object) => object.id),
    center,
    basePoses,
  };
}

/**
 * Applies one transform around the group centroid. Coordinates remain bounded
 * normalized interaction-space values rather than physical world units.
 */
export function applySpatialGroupTransform(
  session: SpatialGroupTransformSession,
  input: SpatialGroupTransformInput,
): Record<string, SpatialObjectPose> {
  const scaleRatio = clamp(Number(input.scaleRatio ?? 1), 0.65, 1.55);
  const rotationDelta = clamp(Number(input.rotationDelta ?? 0), -55, 55);
  const tx = clamp(Number(input.translateX ?? 0), -0.6, 0.6);
  const ty = clamp(Number(input.translateY ?? 0), -0.6, 0.6);
  const tz = clamp(Number(input.translateZ ?? 0), -0.8, 0.8);

  return Object.fromEntries(session.ids.map((id) => {
    const base = session.basePoses[id];
    const localX = (base.position.x - session.center.x) * scaleRatio;
    const localY = (base.position.y - session.center.y) * scaleRatio;
    const rotated = rotate2D(localX, localY, rotationDelta);
    return [id, {
      position: {
        x: clamp(session.center.x + rotated.x + tx, -0.48, 0.48),
        y: clamp(session.center.y + rotated.y + ty, -0.48, 0.48),
        z: clamp(session.center.z + (base.position.z - session.center.z) * scaleRatio + tz, -0.7, 0.7),
      },
      scale: clamp(base.scale * scaleRatio, 0.25, 4),
      rotation: normalizeRotation(base.rotation + rotationDelta),
    }];
  }));
}
