import type { SpatialHandKinematicsState, SpatialHandPoint } from './spatial-hand-kinematics';

export type SpatialFingerName = 'thumb' | 'index' | 'middle' | 'ring' | 'pinky';
export type SpatialContactPhase = 'away' | 'approach' | 'hover' | 'contact' | 'press' | 'grab';

export interface SpatialHandContactVolume {
  id: string;
  label: string;
  kind: 'action' | 'window' | 'object';
  center: { x: number; y: number; z: number };
  halfExtents: { x: number; y: number; z: number };
  priority?: number;
}

export interface SpatialFingerContact {
  finger: SpatialFingerName;
  targetId: string;
  targetLabel: string;
  phase: SpatialContactPhase;
  point: SpatialHandPoint;
  distance: number;
  penetration: number;
  pressure: number;
  confidence: number;
  since: number;
}

export interface SpatialHandContactState {
  active: boolean;
  primaryTargetId: string;
  primaryTargetLabel: string;
  phase: SpatialContactPhase;
  contacts: SpatialFingerContact[];
  pressure: number;
  contactCount: number;
  grabCandidate: boolean;
  at: number;
}

interface FingerHistory {
  targetId: string;
  phase: SpatialContactPhase;
  since: number;
  lastSeenAt: number;
}

const HOVER_SCALE = 2.25;
const CONTACT_DWELL_MS = 58;
const PRESS_DWELL_MS = 92;
const CONTACT_RELEASE_GRACE_MS = 82;
const MIN_CONFIDENCE = 0.5;
const PRESS_APPROACH_SPEED = 0.16;

export const EMPTY_HAND_CONTACT: SpatialHandContactState = {
  active: false,
  primaryTargetId: '',
  primaryTargetLabel: '',
  phase: 'away',
  contacts: [],
  pressure: 0,
  contactCount: 0,
  grabCandidate: false,
  at: 0,
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Number.isFinite(value) ? value : 0));
}

function clamp01(value: number): number {
  return clamp(value, 0, 1);
}

function outsideDistance(point: SpatialHandPoint, volume: SpatialHandContactVolume): number {
  const dx = Math.max(0, Math.abs(point.x - volume.center.x) - volume.halfExtents.x);
  const dy = Math.max(0, Math.abs(point.y - volume.center.y) - volume.halfExtents.y);
  const dz = Math.max(0, Math.abs(point.z - volume.center.z) - volume.halfExtents.z);
  return Math.hypot(dx, dy, dz);
}

function penetrationDepth(point: SpatialHandPoint, volume: SpatialHandContactVolume): number {
  const px = volume.halfExtents.x - Math.abs(point.x - volume.center.x);
  const py = volume.halfExtents.y - Math.abs(point.y - volume.center.y);
  const pz = volume.halfExtents.z - Math.abs(point.z - volume.center.z);
  return Math.min(px, py, pz);
}

function fingerPoint(hand: SpatialHandKinematicsState, finger: SpatialFingerName): SpatialHandPoint {
  return hand[finger].tip;
}

function fingerVelocity(hand: SpatialHandKinematicsState, finger: SpatialFingerName): SpatialHandPoint {
  return hand[finger].velocity;
}

function targetScore(
  point: SpatialHandPoint,
  volume: SpatialHandContactVolume,
  radius: number,
): number {
  const distance = outsideDistance(point, volume);
  const cx = point.x - volume.center.x;
  const cy = point.y - volume.center.y;
  const normalizedCenterDistance = Math.hypot(
    cx / Math.max(0.02, volume.halfExtents.x),
    cy / Math.max(0.02, volume.halfExtents.y),
  );
  return (distance <= radius ? 2.4 : 1) -
    distance / Math.max(0.01, radius * HOVER_SCALE) -
    normalizedCenterDistance * 0.08 +
    Number(volume.priority || 0);
}

function dominantPhase(contacts: SpatialFingerContact[]): SpatialContactPhase {
  const rank: Record<SpatialContactPhase, number> = {
    away: 0,
    approach: 1,
    hover: 2,
    contact: 3,
    press: 4,
    grab: 5,
  };
  return contacts.reduce<SpatialContactPhase>(
    (best, contact) => rank[contact.phase] > rank[best] ? contact.phase : best,
    'away',
  );
}

/**
 * Multi-finger collision/contact proxy for normalized interaction space.
 *
 * Pressure is a visual/interaction proxy derived from penetration, approach
 * velocity and dwell. It is not physical force or proof of real-world touch.
 */
export class SpatialHandContactRuntime {
  private history = new Map<SpatialFingerName, FingerHistory>();

  update(
    hand: SpatialHandKinematicsState,
    volumes: SpatialHandContactVolume[],
    now = performance.now(),
  ): SpatialHandContactState {
    if (!hand.present || hand.confidence < MIN_CONFIDENCE || !volumes.length) {
      this.prune(now, true);
      return { ...EMPTY_HAND_CONTACT, at: now };
    }

    const fingerNames: SpatialFingerName[] = ['index', 'middle', 'thumb', 'ring', 'pinky'];
    const contacts: SpatialFingerContact[] = [];
    const radius = clamp(hand.contactRadius, 0.012, 0.04);

    for (const finger of fingerNames) {
      const point = fingerPoint(hand, finger);
      const velocity = fingerVelocity(hand, finger);
      const candidates = volumes
        .map((volume) => ({
          volume,
          distance: outsideDistance(point, volume),
          score: targetScore(point, volume, radius),
        }))
        .filter((candidate) => candidate.distance <= radius * HOVER_SCALE)
        .sort((a, b) => b.score - a.score);
      const best = candidates[0];
      const previous = this.history.get(finger);

      if (!best) {
        if (previous && now - previous.lastSeenAt <= CONTACT_RELEASE_GRACE_MS) {
          continue;
        }
        this.history.delete(finger);
        continue;
      }

      const sameTarget = previous?.targetId === best.volume.id;
      const since = sameTarget ? previous!.since : now;
      const dwell = Math.max(0, now - since);
      const penetration = Math.max(0, penetrationDepth(point, best.volume) + radius);
      const inside = best.distance <= radius;
      const near = best.distance <= radius * HOVER_SCALE;
      const approachSpeed = Math.max(0, Math.abs(velocity.z));
      const lateralSpeed = Math.hypot(velocity.x, velocity.y);

      let phase: SpatialContactPhase = 'approach';
      if (near) phase = 'hover';
      if (inside && dwell >= CONTACT_DWELL_MS) phase = 'contact';

      const pressure = clamp01(
        penetration / Math.max(0.008, radius * 1.4) * 0.58 +
        approachSpeed / 0.7 * 0.24 +
        clamp01((dwell - CONTACT_DWELL_MS) / 180) * 0.18,
      );

      if (
        phase === 'contact' &&
        dwell >= PRESS_DWELL_MS &&
        (pressure >= 0.42 || approachSpeed >= PRESS_APPROACH_SPEED)
      ) {
        phase = 'press';
      }

      // A human-like grab proxy needs both index/thumb proximity and stable target contact.
      const grabFinger = finger === 'index' || finger === 'thumb';
      if (
        grabFinger &&
        hand.pinching &&
        inside &&
        dwell >= CONTACT_DWELL_MS &&
        hand.pinchConfidence >= 0.34
      ) {
        phase = 'grab';
      }

      const confidence = clamp01(
        hand.confidence * 0.52 +
        hand.palmFacingConfidence * 0.16 +
        hand.stability * 0.12 +
        (1 - Math.min(1, lateralSpeed / 1.8)) * 0.1 +
        (inside ? 0.1 : 0),
      );

      contacts.push({
        finger,
        targetId: best.volume.id,
        targetLabel: best.volume.label,
        phase,
        point: { ...point },
        distance: best.distance,
        penetration,
        pressure,
        confidence,
        since,
      });
      this.history.set(finger, {
        targetId: best.volume.id,
        phase,
        since,
        lastSeenAt: now,
      });
    }

    this.prune(now, false);

    const grouped = new Map<string, SpatialFingerContact[]>();
    for (const contact of contacts) {
      const list = grouped.get(contact.targetId) || [];
      list.push(contact);
      grouped.set(contact.targetId, list);
    }

    const primary = [...grouped.entries()]
      .map(([targetId, list]) => ({
        targetId,
        list,
        score: list.reduce((sum, contact) =>
          sum + contact.confidence + contact.pressure * 0.45 +
          (contact.phase === 'grab' ? 0.7 : contact.phase === 'press' ? 0.35 : 0), 0),
      }))
      .sort((a, b) => b.score - a.score)[0];

    if (!primary) return { ...EMPTY_HAND_CONTACT, at: now };

    const primaryContacts = primary.list;
    const targetLabel = primaryContacts[0]?.targetLabel || '';
    const phase = dominantPhase(primaryContacts);
    const pressure = primaryContacts.reduce((max, contact) => Math.max(max, contact.pressure), 0);
    const indexOnTarget = primaryContacts.some((contact) => contact.finger === 'index' && contact.phase === 'grab');
    const thumbOnTarget = primaryContacts.some((contact) => contact.finger === 'thumb' && contact.phase === 'grab');

    return {
      active: true,
      primaryTargetId: primary.targetId,
      primaryTargetLabel: targetLabel,
      phase: indexOnTarget && thumbOnTarget ? 'grab' : phase,
      contacts,
      pressure,
      contactCount: primaryContacts.length,
      grabCandidate: indexOnTarget && thumbOnTarget,
      at: now,
    };
  }

  reset(): SpatialHandContactState {
    this.history.clear();
    return { ...EMPTY_HAND_CONTACT };
  }

  private prune(now: number, all: boolean): void {
    if (all) {
      this.history.clear();
      return;
    }
    for (const [finger, value] of this.history) {
      if (now - value.lastSeenAt > CONTACT_RELEASE_GRACE_MS) this.history.delete(finger);
    }
  }
}
