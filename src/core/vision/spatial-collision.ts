import type { SpatialObjectPose } from './spatial-object';

export interface SpatialCollisionBody {
  id: string;
  pose: SpatialObjectPose;
  radius: number;
  mass?: number;
  dynamic?: boolean;
}

export interface SpatialCollisionContact {
  aId: string;
  bId: string;
  normal: { x: number; y: number; z: number };
  penetration: number;
  relativeSpeed: number;
  impulse: number;
  stackCandidate: boolean;
}

export interface SpatialCollisionResolution {
  poses: Record<string, SpatialObjectPose>;
  velocityDeltas: Record<string, { x: number; y: number; z: number }>;
  contacts: SpatialCollisionContact[];
}

const COLLISION_RESTITUTION = 0.22;
const POSITION_SLOP = 0.002;
const POSITION_CORRECTION = 0.72;
const STACK_RELATIVE_SPEED_MAX = 0.22;
const STACK_LATERAL_FACTOR = 0.68;
const STACK_VERTICAL_FACTOR = 0.38;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Number.isFinite(value) ? value : 0));
}

function clonePose(pose: SpatialObjectPose): SpatialObjectPose {
  return {
    position: { ...pose.position },
    scale: pose.scale,
    rotation: pose.rotation,
  };
}

function zero() {
  return { x: 0, y: 0, z: 0 };
}

function magnitude(v: { x: number; y: number; z: number }): number {
  return Math.hypot(v.x, v.y, v.z);
}

/**
 * Conservative sphere-proxy collision solver for Mira spatial objects.
 *
 * Radii and masses are interaction-space tuning values, not physical measurements.
 * The solver separates overlaps and returns velocity deltas;
 * the owning physics runtime decides how to apply them.
 */
export function resolveSpatialObjectCollisions(
  bodies: SpatialCollisionBody[],
  velocities: Record<string, { x: number; y: number; z: number }> = {},
): SpatialCollisionResolution {
  const poses: Record<string, SpatialObjectPose> = {};
  const velocityDeltas: Record<string, { x: number; y: number; z: number }> = {};
  const contacts: SpatialCollisionContact[] = [];

  for (const body of bodies) {
    poses[body.id] = clonePose(body.pose);
    velocityDeltas[body.id] = zero();
  }

  for (let i = 0; i < bodies.length; i += 1) {
    for (let j = i + 1; j < bodies.length; j += 1) {
      const a = bodies[i];
      const b = bodies[j];
      const pa = poses[a.id].position;
      const pb = poses[b.id].position;
      const dx = pb.x - pa.x;
      const dy = pb.y - pa.y;
      const dz = pb.z - pa.z;
      const distance = Math.hypot(dx, dy, dz);
      const radiusA = clamp(Number(a.radius || 0.05) * Math.max(0.5, a.pose.scale), 0.018, 0.25);
      const radiusB = clamp(Number(b.radius || 0.05) * Math.max(0.5, b.pose.scale), 0.018, 0.25);
      const minDistance = radiusA + radiusB;
      if (distance >= minDistance) continue;

      const normal = distance > 1e-5
        ? { x: dx / distance, y: dy / distance, z: dz / distance }
        : { x: 1, y: 0, z: 0 };
      const penetration = Math.max(0, minDistance - distance);
      const invMassA = a.dynamic === false ? 0 : 1 / Math.max(0.1, Number(a.mass || 1));
      const invMassB = b.dynamic === false ? 0 : 1 / Math.max(0.1, Number(b.mass || 1));
      const invMassSum = invMassA + invMassB;
      if (invMassSum <= 0) continue;

      const correction = Math.max(0, penetration - POSITION_SLOP) * POSITION_CORRECTION / invMassSum;
      if (invMassA > 0) {
        pa.x -= normal.x * correction * invMassA;
        pa.y -= normal.y * correction * invMassA;
        pa.z -= normal.z * correction * invMassA;
      }
      if (invMassB > 0) {
        pb.x += normal.x * correction * invMassB;
        pb.y += normal.y * correction * invMassB;
        pb.z += normal.z * correction * invMassB;
      }

      const va = velocities[a.id] || zero();
      const vb = velocities[b.id] || zero();
      const rv = {
        x: vb.x - va.x,
        y: vb.y - va.y,
        z: vb.z - va.z,
      };
      const velocityAlongNormal = rv.x * normal.x + rv.y * normal.y + rv.z * normal.z;
      let impulse = 0;

      if (velocityAlongNormal < 0) {
        impulse = -(1 + COLLISION_RESTITUTION) * velocityAlongNormal / invMassSum;
        const ix = impulse * normal.x;
        const iy = impulse * normal.y;
        const iz = impulse * normal.z;
        if (invMassA > 0) {
          velocityDeltas[a.id].x -= ix * invMassA;
          velocityDeltas[a.id].y -= iy * invMassA;
          velocityDeltas[a.id].z -= iz * invMassA;
        }
        if (invMassB > 0) {
          velocityDeltas[b.id].x += ix * invMassB;
          velocityDeltas[b.id].y += iy * invMassB;
          velocityDeltas[b.id].z += iz * invMassB;
        }
      }

      const relativeSpeed = magnitude(rv);
      const lateralDistance = Math.hypot(dx, dz);
      const verticalDistance = Math.abs(dy);
      const stackCandidate =
        relativeSpeed <= STACK_RELATIVE_SPEED_MAX &&
        lateralDistance <= minDistance * STACK_LATERAL_FACTOR &&
        verticalDistance >= minDistance * STACK_VERTICAL_FACTOR;

      contacts.push({
        aId: a.id,
        bId: b.id,
        normal,
        penetration,
        relativeSpeed,
        impulse,
        stackCandidate,
      });
    }
  }

  return { poses, velocityDeltas, contacts };
}
