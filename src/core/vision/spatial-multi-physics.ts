import type { SpatialObjectPose } from './spatial-object';
import type { SpatialVelocity3 } from './spatial-physics';

export interface SpatialCollisionBody {
  id: string;
  pose: SpatialObjectPose;
  velocity: SpatialVelocity3;
  radius: number;
  mass?: number;
  dynamic?: boolean;
}

export type SpatialPairCollisionKind = 'none' | 'push' | 'stack_candidate';

export interface SpatialPairCollision {
  aId: string;
  bId: string;
  kind: SpatialPairCollisionKind;
  collided: boolean;
  penetration: number;
  normal: { x: number; y: number; z: number };
  aPose: SpatialObjectPose;
  bPose: SpatialObjectPose;
  aImpulse: SpatialVelocity3;
  bImpulse: SpatialVelocity3;
  relativeSpeed: number;
}

const COLLISION_RESTITUTION = 0.22;
const POSITION_SLOP = 0.002;
const POSITION_CORRECTION = 0.78;
const STACK_RELATIVE_SPEED_MAX = 0.22;
const STACK_LATERAL_FACTOR = 0.62;
const MIN_RADIUS = 0.018;

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

function dot(a: SpatialVelocity3, b: SpatialVelocity3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

function magnitude(v: SpatialVelocity3): number {
  return Math.hypot(v.x, v.y, v.z);
}

function zero(): SpatialVelocity3 {
  return { x: 0, y: 0, z: 0 };
}

function normalize(x: number, y: number, z: number) {
  const length = Math.hypot(x, y, z);
  if (length < 1e-6) return { x: 0, y: -1, z: 0 };
  return { x: x / length, y: y / length, z: z / length };
}

function radiusOf(body: SpatialCollisionBody): number {
  return Math.max(MIN_RADIUS, Number(body.radius || 0.04) * clamp(body.pose.scale || 1, 0.4, 2.2));
}

function inverseMass(body: SpatialCollisionBody): number {
  if (body.dynamic === false) return 0;
  return 1 / Math.max(0.1, Number(body.mass || 1));
}

function boundedPose(pose: SpatialObjectPose): SpatialObjectPose {
  return {
    ...clonePose(pose),
    position: {
      x: clamp(pose.position.x, -0.48, 0.48),
      y: clamp(pose.position.y, -0.48, 0.48),
      z: clamp(pose.position.z, -0.7, 0.7),
    },
  };
}

/**
 * Pairwise soft sphere collision in Mira interaction space.
 *
 * Radii, masses and velocities are interaction tuning values, not physical SI
 * units. The resolver is deterministic and session-only so it can later be
 * replaced by a metric XR physics adapter without changing object/world APIs.
 */
export function resolveSpatialPairCollision(
  a: SpatialCollisionBody,
  b: SpatialCollisionBody,
): SpatialPairCollision {
  const aRadius = radiusOf(a);
  const bRadius = radiusOf(b);
  const dx = b.pose.position.x - a.pose.position.x;
  const dy = b.pose.position.y - a.pose.position.y;
  const dz = b.pose.position.z - a.pose.position.z;
  const distance = Math.hypot(dx, dy, dz);
  const combinedRadius = aRadius + bRadius;
  const penetration = combinedRadius - distance;

  if (penetration <= 0) {
    return {
      aId: a.id,
      bId: b.id,
      kind: 'none',
      collided: false,
      penetration: 0,
      normal: normalize(dx, dy, dz),
      aPose: clonePose(a.pose),
      bPose: clonePose(b.pose),
      aImpulse: zero(),
      bImpulse: zero(),
      relativeSpeed: magnitude({
        x: b.velocity.x - a.velocity.x,
        y: b.velocity.y - a.velocity.y,
        z: b.velocity.z - a.velocity.z,
      }),
    };
  }

  const normal = normalize(dx, dy, dz);
  const invA = inverseMass(a);
  const invB = inverseMass(b);
  const invTotal = invA + invB;
  const correction = Math.max(0, penetration - POSITION_SLOP) * POSITION_CORRECTION;
  const aShare = invTotal > 0 ? invA / invTotal : 0;
  const bShare = invTotal > 0 ? invB / invTotal : 0;

  const aPose = clonePose(a.pose);
  const bPose = clonePose(b.pose);
  aPose.position.x -= normal.x * correction * aShare;
  aPose.position.y -= normal.y * correction * aShare;
  aPose.position.z -= normal.z * correction * aShare;
  bPose.position.x += normal.x * correction * bShare;
  bPose.position.y += normal.y * correction * bShare;
  bPose.position.z += normal.z * correction * bShare;

  const relativeVelocity = {
    x: b.velocity.x - a.velocity.x,
    y: b.velocity.y - a.velocity.y,
    z: b.velocity.z - a.velocity.z,
  };
  const velocityAlongNormal = dot(relativeVelocity, normal);
  let aImpulse = zero();
  let bImpulse = zero();

  if (velocityAlongNormal < 0 && invTotal > 0) {
    const impulseMagnitude = -(1 + COLLISION_RESTITUTION) * velocityAlongNormal / invTotal;
    const impulse = {
      x: normal.x * impulseMagnitude,
      y: normal.y * impulseMagnitude,
      z: normal.z * impulseMagnitude,
    };
    aImpulse = {
      x: -impulse.x * invA,
      y: -impulse.y * invA,
      z: -impulse.z * invA,
    };
    bImpulse = {
      x: impulse.x * invB,
      y: impulse.y * invB,
      z: impulse.z * invB,
    };
  }

  const relativeSpeed = magnitude(relativeVelocity);
  const lateralDistance = Math.hypot(dx, dz);
  const verticalSeparation = Math.abs(dy);
  const stackCandidate =
    relativeSpeed <= STACK_RELATIVE_SPEED_MAX &&
    lateralDistance <= combinedRadius * STACK_LATERAL_FACTOR &&
    verticalSeparation >= combinedRadius * 0.42;

  return {
    aId: a.id,
    bId: b.id,
    kind: stackCandidate ? 'stack_candidate' : 'push',
    collided: true,
    penetration,
    normal,
    aPose: boundedPose(aPose),
    bPose: boundedPose(bPose),
    aImpulse,
    bImpulse,
    relativeSpeed,
  };
}

export interface SpatialMultiCollisionFrame {
  poses: Map<string, SpatialObjectPose>;
  collisions: SpatialPairCollision[];
}

/**
 * Resolves each object pair once per frame. It intentionally handles a small
 * interaction set, not a full rigid-body simulation.
 */
export class SpatialMultiPhysicsRuntime {
  resolve(bodies: SpatialCollisionBody[]): SpatialMultiCollisionFrame {
    const working = new Map<string, SpatialCollisionBody>();
    for (const body of bodies) {
      working.set(body.id, {
        ...body,
        pose: clonePose(body.pose),
        velocity: { ...body.velocity },
      });
    }

    const collisions: SpatialPairCollision[] = [];
    const ids = Array.from(working.keys());
    for (let i = 0; i < ids.length; i += 1) {
      for (let j = i + 1; j < ids.length; j += 1) {
        const a = working.get(ids[i])!;
        const b = working.get(ids[j])!;
        const result = resolveSpatialPairCollision(a, b);
        if (!result.collided) continue;
        collisions.push(result);
        a.pose = result.aPose;
        b.pose = result.bPose;
        a.velocity = {
          x: a.velocity.x + result.aImpulse.x,
          y: a.velocity.y + result.aImpulse.y,
          z: a.velocity.z + result.aImpulse.z,
        };
        b.velocity = {
          x: b.velocity.x + result.bImpulse.x,
          y: b.velocity.y + result.bImpulse.y,
          z: b.velocity.z + result.bImpulse.z,
        };
      }
    }

    return {
      poses: new Map(Array.from(working.entries()).map(([id, body]) => [id, clonePose(body.pose)])),
      collisions,
    };
  }
}
