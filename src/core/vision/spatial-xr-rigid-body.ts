import type { SpatialHandContactState, SpatialFingerName } from './spatial-hand-contact';
import type { SpatialHandKinematicsState, SpatialHandPoint } from './spatial-hand-kinematics';
import type { XRBimanualTransform } from './spatial-xr-bimanual';

export interface XRRigidLinearVelocity {
  x: number;
  y: number;
  z: number;
}

export interface XRRigidAngularVelocity {
  yawDegPerSec: number;
  pitchDegPerSec: number;
  rollDegPerSec: number;
  scalePerSec: number;
}

export interface XRRigidRelease {
  objectId: string;
  throwing: boolean;
  linearVelocity: XRRigidLinearVelocity;
  angularVelocity: XRRigidAngularVelocity;
  linearSpeed: number;
  angularSpeed: number;
}

export interface XRRigidPresentationStep {
  objectId: string;
  active: boolean;
  transform: XRBimanualTransform;
  angularSpeed: number;
}

export interface XRHandCollisionImpulse {
  targetId: string;
  impulse: XRRigidLinearVelocity;
  intensity: number;
  contactCount: number;
}

type RigidMode = 'idle' | 'grabbed' | 'inertia';

interface RigidBody {
  objectId: string;
  mode: RigidMode;
  transform: XRBimanualTransform;
  previousTransform: XRBimanualTransform;
  linearVelocity: XRRigidLinearVelocity;
  angularVelocity: XRRigidAngularVelocity;
  lastSampleAt: number;
  lastUpdateAt: number;
}

interface CollisionHistory {
  phase: string;
  lastImpulseAt: number;
}

const MIN_DT = 0.008;
const MAX_SAMPLE_DT = 0.12;
const MAX_STEP_DT = 0.05;
const METRIC_XY_TO_NORMALIZED = 1.35;
const METRIC_Z_TO_NORMALIZED = 0.82;
const MAX_LINEAR_SPEED = 1.65;
const MAX_ANGULAR_SPEED = 420;
const MAX_SCALE_SPEED = 1.8;
const LINEAR_THROW_MIN = 0.24;
const ANGULAR_THROW_MIN = 32;
const ANGULAR_DAMPING = 5.4;
const SCALE_DAMPING = 6.4;
const ANGULAR_SETTLE = 2.8;
const SCALE_SETTLE = 0.012;
const COLLISION_COOLDOWN_MS = 170;
const MIN_COLLISION_INTENSITY = 0.12;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Number.isFinite(value) ? value : 0));
}

function magnitude3(value: XRRigidLinearVelocity): number {
  return Math.hypot(value.x, value.y, value.z);
}

function cloneLinear(value: XRRigidLinearVelocity): XRRigidLinearVelocity {
  return { ...value };
}

function cloneAngular(value: XRRigidAngularVelocity): XRRigidAngularVelocity {
  return { ...value };
}

function zeroLinear(): XRRigidLinearVelocity {
  return { x: 0, y: 0, z: 0 };
}

function zeroAngular(): XRRigidAngularVelocity {
  return { yawDegPerSec: 0, pitchDegPerSec: 0, rollDegPerSec: 0, scalePerSec: 0 };
}

function cloneTransform(value: XRBimanualTransform): XRBimanualTransform {
  return {
    ...value,
    metricCenterDelta: { ...value.metricCenterDelta },
  };
}

function wrapDegrees(value: number): number {
  let next = Number.isFinite(value) ? value : 0;
  while (next > 180) next -= 360;
  while (next < -180) next += 360;
  return next;
}

function limitLinear(value: XRRigidLinearVelocity, max = MAX_LINEAR_SPEED): XRRigidLinearVelocity {
  const speed = magnitude3(value);
  if (speed <= max || speed <= 1e-6) return cloneLinear(value);
  const scale = max / speed;
  return { x: value.x * scale, y: value.y * scale, z: value.z * scale };
}

function sanitizeTransform(objectId: string, value: XRBimanualTransform): XRBimanualTransform {
  return {
    objectId,
    active: Boolean(value.active),
    scaleRatio: clamp(Number(value.scaleRatio || 1), 0.58, 1.72),
    yawDeg: clamp(Number(value.yawDeg || 0), -72, 72),
    pitchDeg: clamp(Number(value.pitchDeg || 0), -58, 58),
    rollDeg: clamp(Number(value.rollDeg || 0), -95, 95),
    metricCenterDelta: {
      x: Number.isFinite(Number(value.metricCenterDelta?.x)) ? Number(value.metricCenterDelta.x) : 0,
      y: Number.isFinite(Number(value.metricCenterDelta?.y)) ? Number(value.metricCenterDelta.y) : 0,
      z: Number.isFinite(Number(value.metricCenterDelta?.z)) ? Number(value.metricCenterDelta.z) : 0,
    },
  };
}

function angularSpeed(value: XRRigidAngularVelocity): number {
  return Math.hypot(value.yawDegPerSec, value.pitchDegPerSec, value.rollDegPerSec);
}

function fingerVelocity(
  hand: SpatialHandKinematicsState,
  finger: SpatialFingerName,
): SpatialHandPoint {
  return hand[finger]?.velocity || { x: 0, y: 0, z: 0 };
}

/**
 * Metric XR two-hand rigid interaction estimator.
 *
 * This layer derives release velocity and bounded angular inertia from the
 * temporal bimanual transform. Metric hand translation stays metric inside the
 * estimator; only a normalized interaction-space release velocity crosses into
 * SpatialPhysicsRuntime. It models interaction feel, not measured force,
 * physical mass or a complete rigid-body reconstruction.
 */
export class SpatialXRRigidBodyRuntime {
  private bodies = new Map<string, RigidBody>();

  begin(objectId: string, transform: XRBimanualTransform, now = performance.now()): XRRigidPresentationStep {
    const safe = sanitizeTransform(objectId, transform);
    const body: RigidBody = {
      objectId,
      mode: 'grabbed',
      transform: cloneTransform(safe),
      previousTransform: cloneTransform(safe),
      linearVelocity: zeroLinear(),
      angularVelocity: zeroAngular(),
      lastSampleAt: now,
      lastUpdateAt: now,
    };
    this.bodies.set(objectId, body);
    return this.presentation(body);
  }

  sample(
    objectId: string,
    transform: XRBimanualTransform,
    now = performance.now(),
  ): XRRigidPresentationStep {
    let body = this.bodies.get(objectId);
    if (!body || body.mode !== 'grabbed') {
      return this.begin(objectId, transform, now);
    }

    const next = sanitizeTransform(objectId, transform);
    const dt = clamp((now - body.lastSampleAt) / 1000, MIN_DT, MAX_SAMPLE_DT);
    const previous = body.previousTransform;
    const metricDx = (next.metricCenterDelta.x - previous.metricCenterDelta.x) / dt;
    const metricDy = (next.metricCenterDelta.y - previous.metricCenterDelta.y) / dt;
    const metricDz = (next.metricCenterDelta.z - previous.metricCenterDelta.z) / dt;
    const rawLinear = limitLinear({
      x: metricDx * METRIC_XY_TO_NORMALIZED,
      y: -metricDy * METRIC_XY_TO_NORMALIZED,
      z: -metricDz * METRIC_Z_TO_NORMALIZED,
    });

    const rawAngular: XRRigidAngularVelocity = {
      yawDegPerSec: clamp(wrapDegrees(next.yawDeg - previous.yawDeg) / dt, -MAX_ANGULAR_SPEED, MAX_ANGULAR_SPEED),
      pitchDegPerSec: clamp(wrapDegrees(next.pitchDeg - previous.pitchDeg) / dt, -MAX_ANGULAR_SPEED, MAX_ANGULAR_SPEED),
      rollDegPerSec: clamp(wrapDegrees(next.rollDeg - previous.rollDeg) / dt, -MAX_ANGULAR_SPEED, MAX_ANGULAR_SPEED),
      scalePerSec: clamp((next.scaleRatio - previous.scaleRatio) / dt, -MAX_SCALE_SPEED, MAX_SCALE_SPEED),
    };

    const alpha = 0.34;
    body.linearVelocity = limitLinear({
      x: body.linearVelocity.x + (rawLinear.x - body.linearVelocity.x) * alpha,
      y: body.linearVelocity.y + (rawLinear.y - body.linearVelocity.y) * alpha,
      z: body.linearVelocity.z + (rawLinear.z - body.linearVelocity.z) * alpha,
    });
    body.angularVelocity = {
      yawDegPerSec: body.angularVelocity.yawDegPerSec + (rawAngular.yawDegPerSec - body.angularVelocity.yawDegPerSec) * alpha,
      pitchDegPerSec: body.angularVelocity.pitchDegPerSec + (rawAngular.pitchDegPerSec - body.angularVelocity.pitchDegPerSec) * alpha,
      rollDegPerSec: body.angularVelocity.rollDegPerSec + (rawAngular.rollDegPerSec - body.angularVelocity.rollDegPerSec) * alpha,
      scalePerSec: body.angularVelocity.scalePerSec + (rawAngular.scalePerSec - body.angularVelocity.scalePerSec) * alpha,
    };
    body.previousTransform = cloneTransform(next);
    body.transform = cloneTransform(next);
    body.lastSampleAt = now;
    body.lastUpdateAt = now;
    return this.presentation(body);
  }

  release(objectId: string, now = performance.now()): XRRigidRelease | null {
    const body = this.bodies.get(objectId);
    if (!body) return null;

    const linearSpeed = magnitude3(body.linearVelocity);
    const spinSpeed = angularSpeed(body.angularVelocity);
    const throwing = linearSpeed >= LINEAR_THROW_MIN || spinSpeed >= ANGULAR_THROW_MIN;
    body.mode = throwing ? 'inertia' : 'idle';
    body.transform.active = false;
    body.lastSampleAt = now;
    body.lastUpdateAt = now;

    if (!throwing) {
      body.linearVelocity = zeroLinear();
      body.angularVelocity = zeroAngular();
    }

    return {
      objectId,
      throwing,
      linearVelocity: cloneLinear(body.linearVelocity),
      angularVelocity: cloneAngular(body.angularVelocity),
      linearSpeed,
      angularSpeed: spinSpeed,
    };
  }

  step(objectId: string, now = performance.now()): XRRigidPresentationStep | null {
    const body = this.bodies.get(objectId);
    if (!body) return null;
    if (body.mode !== 'inertia') return this.presentation(body);

    const dt = clamp((now - body.lastUpdateAt) / 1000, 0, MAX_STEP_DT);
    body.lastUpdateAt = now;
    if (dt <= 0) return this.presentation(body);

    const angularDamping = Math.exp(-ANGULAR_DAMPING * dt);
    const scaleDamping = Math.exp(-SCALE_DAMPING * dt);
    body.angularVelocity = {
      yawDegPerSec: body.angularVelocity.yawDegPerSec * angularDamping,
      pitchDegPerSec: body.angularVelocity.pitchDegPerSec * angularDamping,
      rollDegPerSec: body.angularVelocity.rollDegPerSec * angularDamping,
      scalePerSec: body.angularVelocity.scalePerSec * scaleDamping,
    };

    body.transform = sanitizeTransform(objectId, {
      ...body.transform,
      active: false,
      scaleRatio: body.transform.scaleRatio + body.angularVelocity.scalePerSec * dt,
      yawDeg: body.transform.yawDeg + body.angularVelocity.yawDegPerSec * dt,
      pitchDeg: body.transform.pitchDeg + body.angularVelocity.pitchDegPerSec * dt,
      rollDeg: body.transform.rollDeg + body.angularVelocity.rollDegPerSec * dt,
    });

    if (
      angularSpeed(body.angularVelocity) < ANGULAR_SETTLE &&
      Math.abs(body.angularVelocity.scalePerSec) < SCALE_SETTLE
    ) {
      body.mode = 'idle';
      body.angularVelocity = zeroAngular();
    }
    return this.presentation(body);
  }

  stepAll(now = performance.now()): XRRigidPresentationStep[] {
    const result: XRRigidPresentationStep[] = [];
    for (const body of this.bodies.values()) {
      if (body.mode !== 'inertia') continue;
      const step = this.step(body.objectId, now);
      if (step) result.push(step);
    }
    return result;
  }

  stop(objectId: string): XRRigidPresentationStep | null {
    const body = this.bodies.get(objectId);
    if (!body) return null;
    body.mode = 'idle';
    body.linearVelocity = zeroLinear();
    body.angularVelocity = zeroAngular();
    body.transform.active = false;
    return this.presentation(body);
  }

  isActive(objectId: string): boolean {
    return this.bodies.get(objectId)?.mode === 'inertia';
  }

  reset(): void {
    this.bodies.clear();
  }

  private presentation(body: RigidBody): XRRigidPresentationStep {
    return {
      objectId: body.objectId,
      active: body.mode === 'inertia',
      transform: cloneTransform(body.transform),
      angularSpeed: angularSpeed(body.angularVelocity),
    };
  }
}

/**
 * Edge-triggered hand/object contact impulse proxy for XR.
 *
 * The contact pipeline already owns dwell, penetration and confidence gates.
 * This runtime only converts a stable non-grab contact plus fingertip motion
 * into a bounded interaction impulse. The output is not physical force.
 */
export class SpatialXRHandCollisionRuntime {
  private history = new Map<string, CollisionHistory>();

  update(
    hand: SpatialHandKinematicsState,
    contact: SpatialHandContactState,
    now = performance.now(),
  ): XRHandCollisionImpulse | null {
    if (
      !hand.present ||
      hand.confidence < 0.5 ||
      hand.pinching ||
      !contact.active ||
      !contact.primaryTargetId ||
      (contact.phase !== 'contact' && contact.phase !== 'press')
    ) {
      return null;
    }

    const targetId = contact.primaryTargetId;
    const previous = this.history.get(targetId);
    const edge = !previous || previous.phase !== contact.phase;
    if (!edge && previous && now - previous.lastImpulseAt < COLLISION_COOLDOWN_MS) return null;

    const relevant = contact.contacts.filter((item) =>
      item.targetId === targetId &&
      (item.phase === 'contact' || item.phase === 'press' || item.phase === 'grab'),
    );
    if (!relevant.length) return null;

    let weighted = { x: 0, y: 0, z: 0 };
    let totalWeight = 0;
    for (const item of relevant) {
      const velocity = fingerVelocity(hand, item.finger);
      const weight = Math.max(0.12, Number(item.pressure || 0), Number(item.confidence || 0) * 0.35);
      weighted.x += velocity.x * weight;
      weighted.y += velocity.y * weight;
      weighted.z += velocity.z * weight;
      totalWeight += weight;
    }
    if (totalWeight <= 0) return null;

    weighted = {
      x: weighted.x / totalWeight,
      y: weighted.y / totalWeight,
      z: weighted.z / totalWeight,
    };
    const motion = Math.hypot(weighted.x, weighted.y, weighted.z);
    const intensity = clamp(
      Number(contact.pressure || 0) * 0.58 +
      clamp(motion / 1.8, 0, 1) * 0.32 +
      clamp(contact.contactCount / 5, 0, 1) * 0.1,
      0,
      1,
    );
    if (intensity < MIN_COLLISION_INTENSITY || motion < 0.045) return null;

    const impulse = limitLinear({
      x: weighted.x * intensity * 0.16,
      y: weighted.y * intensity * 0.16,
      z: weighted.z * intensity * 0.1,
    }, 0.62);

    this.history.set(targetId, {
      phase: contact.phase,
      lastImpulseAt: now,
    });
    return {
      targetId,
      impulse,
      intensity,
      contactCount: contact.contactCount,
    };
  }

  reset(): void {
    this.history.clear();
  }
}
