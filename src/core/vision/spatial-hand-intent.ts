import type { SpatialHandKinematicsState } from './spatial-hand-kinematics';
import type { SpatialHandContactState } from './spatial-hand-contact';

export type SpatialHandIntent =
  | 'none'
  | 'point'
  | 'hover'
  | 'touch'
  | 'press'
  | 'grab'
  | 'drag'
  | 'release'
  | 'push'
  | 'pull'
  | 'swipe_left'
  | 'swipe_right'
  | 'swipe_up'
  | 'swipe_down'
  | 'rotate_cw'
  | 'rotate_ccw';

export interface SpatialHandIntentState {
  intent: SpatialHandIntent;
  confidence: number;
  stableMs: number;
  handedness: string;
  targetId: string;
  at: number;
}

interface History {
  candidate: SpatialHandIntent;
  candidateSince: number;
  previousPinching: boolean;
  previousPalmAngle: number;
  lastEmitAt: number;
}

const MIN_STABLE_MS = 70;
const SWIPE_SPEED = 1.05;
const PUSH_SPEED = 0.42;
const ROTATE_SPEED = 1.15;
const EMIT_COOLDOWN_MS = 90;

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

function palmAngle(hand: SpatialHandKinematicsState): number {
  return Math.atan2(hand.palmNormal.y, hand.palmNormal.x);
}

function candidateIntent(
  hand: SpatialHandKinematicsState,
  contact: SpatialHandContactState,
  previousPinching: boolean,
  previousPalmAngle: number,
  dtSeconds: number,
): { intent: SpatialHandIntent; confidence: number } {
  if (!hand.present) return { intent: 'none', confidence: 0 };

  if (previousPinching && !hand.pinching) {
    return { intent: 'release', confidence: Math.max(0.7, hand.confidence) };
  }

  if (contact.active) {
    if (contact.phase === 'grab' || contact.grabCandidate) {
      return {
        intent: hand.speed > 0.08 ? 'drag' : 'grab',
        confidence: clamp01(0.56 + contact.pressure * 0.22 + hand.pinchConfidence * 0.22),
      };
    }
    if (contact.phase === 'press') {
      return { intent: 'press', confidence: clamp01(0.6 + contact.pressure * 0.4) };
    }
    if (contact.phase === 'contact') {
      return { intent: 'touch', confidence: clamp01(0.58 + hand.stability * 0.22 + contact.pressure * 0.2) };
    }
    if (contact.phase === 'hover' || contact.phase === 'approach') {
      return { intent: 'hover', confidence: clamp01(0.48 + hand.pointingConfidence * 0.3 + hand.stability * 0.22) };
    }
  }

  const vx = hand.index.velocity.x;
  const vy = hand.index.velocity.y;
  const vz = hand.index.velocity.z;
  const absX = Math.abs(vx);
  const absY = Math.abs(vy);

  if (hand.pinching && hand.pinchConfidence >= 0.34) {
    if (Math.abs(vz) >= PUSH_SPEED && absX < 0.72 && absY < 0.72) {
      return {
        intent: vz > 0 ? 'push' : 'pull',
        confidence: clamp01(Math.abs(vz) / 1.2 * 0.62 + hand.pinchConfidence * 0.38),
      };
    }
  }

  if (!hand.pinching && hand.pointingConfidence >= 0.58) {
    if (absX >= SWIPE_SPEED && absX > absY * 1.25) {
      return {
        intent: vx > 0 ? 'swipe_right' : 'swipe_left',
        confidence: clamp01(absX / 2.4),
      };
    }
    if (absY >= SWIPE_SPEED && absY > absX * 1.25) {
      return {
        intent: vy > 0 ? 'swipe_down' : 'swipe_up',
        confidence: clamp01(absY / 2.4),
      };
    }
  }

  if (dtSeconds > 0 && hand.palmFacingConfidence >= 0.45 && hand.stability <= 0.75) {
    const angle = palmAngle(hand);
    let delta = angle - previousPalmAngle;
    while (delta > Math.PI) delta -= Math.PI * 2;
    while (delta < -Math.PI) delta += Math.PI * 2;
    const angularVelocity = delta / dtSeconds;
    if (Math.abs(angularVelocity) >= ROTATE_SPEED) {
      return {
        intent: angularVelocity > 0 ? 'rotate_cw' : 'rotate_ccw',
        confidence: clamp01(Math.abs(angularVelocity) / 3.2 * hand.palmFacingConfidence),
      };
    }
  }

  if (hand.pointingConfidence >= 0.58) {
    return {
      intent: 'point',
      confidence: clamp01(hand.pointingConfidence * 0.72 + hand.stability * 0.28),
    };
  }

  return { intent: 'none', confidence: 0 };
}

/**
 * Temporal interaction intent above raw hand gestures.
 * It recognizes motion semantics but does not itself trigger UI actions.
 */
export class SpatialHandIntentRuntime {
  private history = new Map<string, History>();
  private lastAt = new Map<string, number>();

  update(
    hand: SpatialHandKinematicsState,
    contact: SpatialHandContactState,
    now = performance.now(),
  ): SpatialHandIntentState {
    const handedness = hand.handedness || 'unknown';
    const previous = this.history.get(handedness) || {
      candidate: 'none' as SpatialHandIntent,
      candidateSince: now,
      previousPinching: false,
      previousPalmAngle: palmAngle(hand),
      lastEmitAt: -Infinity,
    };
    const previousAt = this.lastAt.get(handedness) || now;
    const dt = Math.max(0, Math.min(0.12, (now - previousAt) / 1000));
    this.lastAt.set(handedness, now);

    const next = candidateIntent(
      hand,
      contact,
      previous.previousPinching,
      previous.previousPalmAngle,
      dt,
    );

    if (next.intent !== previous.candidate) {
      previous.candidate = next.intent;
      previous.candidateSince = now;
    }

    const stableMs = Math.max(0, now - previous.candidateSince);
    const immediate = next.intent === 'release' ||
      next.intent.startsWith('swipe_') ||
      next.intent === 'push' ||
      next.intent === 'pull';
    const stable = immediate || stableMs >= MIN_STABLE_MS;
    const cooldownReady = now - previous.lastEmitAt >= EMIT_COOLDOWN_MS;
    const intent = stable && cooldownReady ? next.intent : 'none';

    if (intent !== 'none') previous.lastEmitAt = now;
    previous.previousPinching = hand.pinching;
    previous.previousPalmAngle = palmAngle(hand);
    this.history.set(handedness, previous);

    return {
      intent,
      confidence: intent === 'none' ? 0 : next.confidence,
      stableMs,
      handedness,
      targetId: contact.primaryTargetId,
      at: now,
    };
  }

  reset(): void {
    this.history.clear();
    this.lastAt.clear();
  }
}
