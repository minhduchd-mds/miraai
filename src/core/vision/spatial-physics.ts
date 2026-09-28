import type { SpatialObjectPoint, SpatialObjectPose } from './spatial-object';

export type SpatialPhysicsMode = 'idle' | 'grabbed' | 'inertia';

export interface SpatialVelocity3 {
  x: number;
  y: number;
  z: number;
}

export interface SpatialPhysicsState {
  objectId: string;
  mode: SpatialPhysicsMode;
  velocity: SpatialVelocity3;
  speed: number;
  settled: boolean;
  lastUpdateAt: number;
}

export interface SpatialReleaseDecision {
  objectId: string;
  mode: 'throw' | 'place';
  velocity: SpatialVelocity3;
  speed: number;
  placementStrength: number;
}

export interface SpatialPhysicsStep {
  pose: SpatialObjectPose;
  state: SpatialPhysicsState;
  collided: boolean;
}

interface Body {
  objectId: string;
  mode: SpatialPhysicsMode;
  velocity: SpatialVelocity3;
  lastPointer: SpatialObjectPoint | null;
  lastSampleAt: number;
  lastUpdateAt: number;
}

const THROW_SPEED_MIN = 0.72;
const PLACE_MAGNET_STRENGTH = 0.46;
const MAX_SPEED = 2.4;
const LINEAR_DAMPING = 4.6;
const SOFT_MARGIN_XY = 0.075;
const SOFT_MARGIN_Z = 0.1;
const BOUNDARY_STIFFNESS = 18;
const RESTITUTION = 0.28;
const SETTLE_SPEED = 0.035;
const MAX_STEP_S = 0.05;

const BOUNDS = {
  x: 0.48,
  y: 0.48,
  z: 0.7,
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Number.isFinite(value) ? value : 0));
}

function magnitude(value: SpatialVelocity3): number {
  return Math.hypot(value.x, value.y, value.z);
}

function cloneVelocity(value: SpatialVelocity3): SpatialVelocity3 {
  return { ...value };
}

function zeroVelocity(): SpatialVelocity3 {
  return { x: 0, y: 0, z: 0 };
}

function limitVelocity(value: SpatialVelocity3, max = MAX_SPEED): SpatialVelocity3 {
  const speed = magnitude(value);
  if (speed <= max || speed <= 1e-6) return cloneVelocity(value);
  const ratio = max / speed;
  return {
    x: value.x * ratio,
    y: value.y * ratio,
    z: value.z * ratio,
  };
}

function axisSoftForce(position: number, limit: number, margin: number): number {
  const distanceToEdge = limit - Math.abs(position);
  if (distanceToEdge >= margin) return 0;
  const penetration = clamp((margin - distanceToEdge) / margin, 0, 1);
  return -Math.sign(position || 1) * BOUNDARY_STIFFNESS * penetration * penetration;
}

function clampPose(pose: SpatialObjectPose): SpatialObjectPose {
  return {
    position: {
      x: clamp(pose.position.x, -BOUNDS.x, BOUNDS.x),
      y: clamp(pose.position.y, -BOUNDS.y, BOUNDS.y),
      z: clamp(pose.position.z, -BOUNDS.z, BOUNDS.z),
    },
    scale: pose.scale,
    rotation: pose.rotation,
  };
}

/**
 * Critically damped-like positional attraction used while the hand is still
 * controlling an object. It keeps magnetic snapping soft instead of teleporting
 * the object to a candidate anchor.
 */
export function applySpatialSpringConstraint(
  current: SpatialObjectPose,
  target: SpatialObjectPose,
  strength: number,
  dtSeconds: number,
): SpatialObjectPose {
  const normalizedStrength = clamp(strength, 0, 1);
  if (normalizedStrength <= 0) return clampPose(current);
  const dt = clamp(dtSeconds, 0, MAX_STEP_S);
  const stiffness = 9 + normalizedStrength * 17;
  const t = clamp(1 - Math.exp(-stiffness * dt), 0, 0.82);
  return clampPose({
    position: {
      x: current.position.x + (target.position.x - current.position.x) * t,
      y: current.position.y + (target.position.y - current.position.y) * t,
      z: current.position.z + (target.position.z - current.position.z) * t,
    },
    scale: current.scale,
    rotation: current.rotation,
  });
}

/**
 * Session-only hand/object physics.
 *
 * Velocities are normalized interaction-space units per second, not physical
 * meters per second. This deliberately models interaction feel, not real-world
 * mass or force. A future metric WebXR adapter can supply physical units while
 * preserving the release/inertia state machine.
 */
export class SpatialPhysicsRuntime {
  private bodies = new Map<string, Body>();

  beginGrab(objectId: string, pointer: SpatialObjectPoint, now = performance.now()): SpatialPhysicsState {
    const body: Body = {
      objectId,
      mode: 'grabbed',
      velocity: zeroVelocity(),
      lastPointer: { ...pointer },
      lastSampleAt: now,
      lastUpdateAt: now,
    };
    this.bodies.set(objectId, body);
    return this.snapshot(objectId);
  }

  sampleGrab(objectId: string, pointer: SpatialObjectPoint, now = performance.now()): SpatialPhysicsState {
    const body = this.ensureBody(objectId, now);
    if (body.mode !== 'grabbed' || !body.lastPointer) {
      return this.beginGrab(objectId, pointer, now);
    }

    const dt = clamp((now - body.lastSampleAt) / 1000, 0.008, 0.12);
    const raw = limitVelocity({
      x: (pointer.x - body.lastPointer.x) / dt,
      y: (pointer.y - body.lastPointer.y) / dt,
      z: (pointer.z - body.lastPointer.z) / dt,
    });
    const alpha = 0.38;
    body.velocity = limitVelocity({
      x: body.velocity.x + (raw.x - body.velocity.x) * alpha,
      y: body.velocity.y + (raw.y - body.velocity.y) * alpha,
      z: body.velocity.z + (raw.z - body.velocity.z) * alpha,
    });
    body.lastPointer = { ...pointer };
    body.lastSampleAt = now;
    body.lastUpdateAt = now;
    return this.snapshot(objectId);
  }

  release(
    objectId: string,
    placementStrength = 0,
    now = performance.now(),
  ): SpatialReleaseDecision {
    const body = this.ensureBody(objectId, now);
    const speed = magnitude(body.velocity);
    const strength = clamp(placementStrength, 0, 1);
    const shouldThrow = speed >= THROW_SPEED_MIN && strength < PLACE_MAGNET_STRENGTH;

    body.mode = shouldThrow ? 'inertia' : 'idle';
    body.velocity = shouldThrow ? limitVelocity(body.velocity, 1.85) : zeroVelocity();
    body.lastPointer = null;
    body.lastSampleAt = now;
    body.lastUpdateAt = now;

    return {
      objectId,
      mode: shouldThrow ? 'throw' : 'place',
      velocity: cloneVelocity(body.velocity),
      speed,
      placementStrength: strength,
    };
  }

  step(
    objectId: string,
    pose: SpatialObjectPose,
    now = performance.now(),
  ): SpatialPhysicsStep {
    const body = this.ensureBody(objectId, now);
    if (body.mode !== 'inertia') {
      return {
        pose: clampPose(pose),
        state: this.snapshot(objectId),
        collided: false,
      };
    }

    const dt = clamp((now - body.lastUpdateAt) / 1000, 0, MAX_STEP_S);
    body.lastUpdateAt = now;
    if (dt <= 0) {
      return { pose: clampPose(pose), state: this.snapshot(objectId), collided: false };
    }

    body.velocity.x += axisSoftForce(pose.position.x, BOUNDS.x, SOFT_MARGIN_XY) * dt;
    body.velocity.y += axisSoftForce(pose.position.y, BOUNDS.y, SOFT_MARGIN_XY) * dt;
    body.velocity.z += axisSoftForce(pose.position.z, BOUNDS.z, SOFT_MARGIN_Z) * dt;

    const damping = Math.exp(-LINEAR_DAMPING * dt);
    body.velocity = limitVelocity({
      x: body.velocity.x * damping,
      y: body.velocity.y * damping,
      z: body.velocity.z * damping,
    });

    const next = {
      x: pose.position.x + body.velocity.x * dt,
      y: pose.position.y + body.velocity.y * dt,
      z: pose.position.z + body.velocity.z * dt,
    };
    let collided = false;

    if (Math.abs(next.x) > BOUNDS.x) {
      next.x = clamp(next.x, -BOUNDS.x, BOUNDS.x);
      body.velocity.x = -body.velocity.x * RESTITUTION;
      collided = true;
    }
    if (Math.abs(next.y) > BOUNDS.y) {
      next.y = clamp(next.y, -BOUNDS.y, BOUNDS.y);
      body.velocity.y = -body.velocity.y * RESTITUTION;
      collided = true;
    }
    if (Math.abs(next.z) > BOUNDS.z) {
      next.z = clamp(next.z, -BOUNDS.z, BOUNDS.z);
      body.velocity.z = -body.velocity.z * RESTITUTION;
      collided = true;
    }

    if (!collided && magnitude(body.velocity) < SETTLE_SPEED) {
      body.velocity = zeroVelocity();
      body.mode = 'idle';
    }

    return {
      pose: {
        ...pose,
        position: next,
      },
      state: this.snapshot(objectId),
      collided,
    };
  }

  velocity(objectId: string): SpatialVelocity3 {
    return cloneVelocity(this.ensureBody(objectId, 0).velocity);
  }

  setVelocity(
    objectId: string,
    velocity: SpatialVelocity3,
    now = performance.now(),
    activate = true,
  ): SpatialPhysicsState {
    const body = this.ensureBody(objectId, now);
    body.velocity = limitVelocity(velocity, 1.85);
    body.mode = activate && magnitude(body.velocity) >= SETTLE_SPEED ? 'inertia' : 'idle';
    body.lastPointer = null;
    body.lastSampleAt = now;
    body.lastUpdateAt = now;
    return this.snapshot(objectId);
  }

  addVelocity(
    objectId: string,
    delta: SpatialVelocity3,
    now = performance.now(),
  ): SpatialPhysicsState {
    const body = this.ensureBody(objectId, now);
    body.velocity = limitVelocity({
      x: body.velocity.x + Number(delta.x || 0),
      y: body.velocity.y + Number(delta.y || 0),
      z: body.velocity.z + Number(delta.z || 0),
    }, 1.85);
    if (magnitude(body.velocity) >= SETTLE_SPEED) body.mode = 'inertia';
    body.lastUpdateAt = now;
    return this.snapshot(objectId);
  }

  stop(objectId: string, now = performance.now()): SpatialPhysicsState {
    const body = this.ensureBody(objectId, now);
    body.mode = 'idle';
    body.velocity = zeroVelocity();
    body.lastPointer = null;
    body.lastSampleAt = now;
    body.lastUpdateAt = now;
    return this.snapshot(objectId);
  }

  isActive(objectId: string): boolean {
    return this.bodies.get(objectId)?.mode === 'inertia';
  }

  snapshot(objectId: string): SpatialPhysicsState {
    const body = this.ensureBody(objectId, 0);
    const speed = magnitude(body.velocity);
    return {
      objectId,
      mode: body.mode,
      velocity: cloneVelocity(body.velocity),
      speed,
      settled: body.mode === 'idle' && speed < SETTLE_SPEED,
      lastUpdateAt: body.lastUpdateAt,
    };
  }

  reset(): void {
    this.bodies.clear();
  }

  private ensureBody(objectId: string, now: number): Body {
    let body = this.bodies.get(objectId);
    if (!body) {
      body = {
        objectId,
        mode: 'idle',
        velocity: zeroVelocity(),
        lastPointer: null,
        lastSampleAt: now,
        lastUpdateAt: now,
      };
      this.bodies.set(objectId, body);
    }
    return body;
  }
}
