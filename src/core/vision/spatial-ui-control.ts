import type { GestureIntentState } from './gesture-intent';
import type { SpatialRay3D, SpatialRayHit } from './spatial-ray';

export type SpatialPointerSource = 'none' | 'face' | 'hand';
export type SpatialTargetKind = 'action' | 'window' | 'object';

export interface SpatialPoint3D {
  x: number;
  y: number;
  z: number;
  confidence: number;
  source: SpatialPointerSource;
}

export interface SpatialFaceSample {
  present: boolean;
  confidence: number;
  gazeX: number;
  gazeY: number;
  yaw: number;
  pitch: number;
  calibrationProgress: number;
}

export interface SpatialHandSample {
  present: boolean;
  confidence: number;
  x: number;
  y: number;
  z: number;
  pinching: boolean;
  direct: boolean;
  ray?: SpatialRay3D | null;
}

export interface SpatialTargetGeometry {
  id: string;
  label: string;
  kind: SpatialTargetKind;
  left: number;
  top: number;
  right: number;
  bottom: number;
  z?: number;
  depthRadius?: number;
  priority?: number;
}

export interface SpatialFocus {
  id: string;
  label: string;
  kind: SpatialTargetKind;
  since: number;
  ready: boolean;
  score: number;
}

export type SpatialControlEventType =
  | 'activate'
  | 'grab_start'
  | 'grab_move'
  | 'grab_end'
  | 'cancel';

export interface SpatialControlEvent {
  type: SpatialControlEventType;
  targetId: string;
  targetKind: SpatialTargetKind | null;
  source: SpatialPointerSource;
  point: SpatialPoint3D;
  at: number;
}

export interface SpatialControlFrame {
  pointer: SpatialPoint3D;
  focus: SpatialFocus | null;
  rayHit: SpatialRayHit | null;
  events: SpatialControlEvent[];
  grabbing: boolean;
  grabTargetId: string;
}

export interface SpatialControlInput {
  face: SpatialFaceSample;
  hand: SpatialHandSample;
  rayHit?: SpatialRayHit | null;
  gestureIntent: GestureIntentState;
  headGesture: string;
  targets: SpatialTargetGeometry[];
}

export const EMPTY_SPATIAL_POINT: SpatialPoint3D = {
  x: 0.5,
  y: 0.5,
  z: 0,
  confidence: 0,
  source: 'none',
};

export const EMPTY_SPATIAL_CONTROL_FRAME: SpatialControlFrame = {
  pointer: { ...EMPTY_SPATIAL_POINT },
  focus: null,
  rayHit: null,
  events: [],
  grabbing: false,
  grabTargetId: '',
};

const FACE_FOCUS_MS = 280;
const HAND_FOCUS_MS = 120;
const MIN_FACE_CONFIDENCE = 0.4;
const MIN_HAND_CONFIDENCE = 0.48;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Number.isFinite(value) ? value : 0));
}

function clamp01(value: number): number {
  return clamp(value, 0, 1);
}

function smooth(previous: number, next: number, alpha: number): number {
  return previous + (next - previous) * clamp01(alpha);
}

/**
 * Webcam approximation of a visionOS-style look target.
 *
 * Real visionOS eye targeting is system-level. Mira only has monocular webcam
 * blendshapes/head pose, so this intentionally fuses gaze + head pose and
 * exposes lower confidence until calibration has enough stable samples.
 */
export function faceSpatialPoint(sample: SpatialFaceSample): SpatialPoint3D {
  if (!sample.present || sample.confidence < MIN_FACE_CONFIDENCE) {
    return { ...EMPTY_SPATIAL_POINT };
  }

  const calibrationWeight = 0.5 + clamp01(sample.calibrationProgress) * 0.5;
  const horizontal = clamp(sample.gazeX * 0.72 + sample.yaw * 0.2, -0.48, 0.48);
  const vertical = clamp(-sample.gazeY * 0.72 + sample.pitch * 0.2, -0.48, 0.48);

  return {
    x: clamp(0.5 + horizontal, 0.025, 0.975),
    y: clamp(0.5 + vertical, 0.035, 0.965),
    z: 0,
    confidence: clamp01(sample.confidence * (0.58 + 0.42 * calibrationWeight)),
    source: 'face',
  };
}

export function handSpatialPoint(sample: SpatialHandSample): SpatialPoint3D {
  if (!sample.present || sample.confidence < MIN_HAND_CONFIDENCE) {
    return { ...EMPTY_SPATIAL_POINT };
  }
  return {
    x: clamp(sample.x, 0.02, 0.98),
    y: clamp(sample.y, 0.03, 0.97),
    z: clamp(sample.z, -0.45, 0.45),
    confidence: clamp01(sample.confidence),
    source: 'hand',
  };
}

function expandedContains(target: SpatialTargetGeometry, point: SpatialPoint3D, margin: number): boolean {
  return point.x >= target.left - margin &&
    point.x <= target.right + margin &&
    point.y >= target.top - margin &&
    point.y <= target.bottom + margin;
}

function targetScore(target: SpatialTargetGeometry, point: SpatialPoint3D): number {
  const cx = (target.left + target.right) / 2;
  const cy = (target.top + target.bottom) / 2;
  const width = Math.max(0.025, target.right - target.left);
  const height = Math.max(0.025, target.bottom - target.top);
  const dx = Math.abs(point.x - cx) / Math.max(0.06, width);
  const dy = Math.abs(point.y - cy) / Math.max(0.06, height);
  const distance = Math.hypot(dx, dy);
  const inside = expandedContains(target, point, 0);
  return (inside ? 2.2 : 1) - distance + Number(target.priority || 0);
}

function chooseTarget(
  targets: SpatialTargetGeometry[],
  point: SpatialPoint3D,
  current: SpatialFocus | null,
): SpatialTargetGeometry | null {
  if (point.source === 'none') return null;

  if (current) {
    const active = targets.find((target) => target.id === current.id);
    if (active && expandedContains(active, point, point.source === 'face' ? 0.055 : 0.035)) {
      return active;
    }
  }

  const margin = point.source === 'face' ? 0.035 : 0.02;
  const candidates = targets
    .filter((target) => expandedContains(target, point, margin))
    .map((target) => ({ target, score: targetScore(target, point) }))
    .sort((a, b) => b.score - a.score);

  return candidates[0]?.target || null;
}

/**
 * Spatial UI runtime:
 * - face/gaze chooses focus when available (indirect mode);
 * - hand pointer is the direct fallback;
 * - pinch commits the focused action or starts a window grab;
 * - nod is a face-only accessibility fallback for activation;
 * - shake cancels an active grab.
 *
 * No DOM access lives here. AppV2 supplies normalized target geometry.
 */
export class SpatialUIController {
  private pointer: SpatialPoint3D = { ...EMPTY_SPATIAL_POINT };
  private focus: SpatialFocus | null = null;
  private grabTargetId = '';
  private grabTargetKind: SpatialTargetKind | null = null;
  private previousHeadGesture = 'none';
  private lastActivationAt = -Infinity;
  private grabReleaseSince: number | null = null;
  private focusSource: SpatialPointerSource = 'none';

  update(input: SpatialControlInput, now = performance.now()): SpatialControlFrame {
    const facePoint = faceSpatialPoint(input.face);
    const handPoint = handSpatialPoint(input.hand);

    // A stale ray must never retarget the UI after hand tracking drops.
    const rayHit = input.hand.direct && handPoint.source === 'hand' && input.hand.present
      ? input.rayHit || null : null;

    // visionOS-style indirect input: look chooses target, pinch commits.
    // Direct hand pointing takes over only when explicitly stable or face focus is unavailable.
    const nextRaw = input.face.present && facePoint.confidence >= MIN_FACE_CONFIDENCE && !input.hand.direct
      ? facePoint
      : handPoint.source !== 'none'
        ? handPoint
        : facePoint;

    if (nextRaw.source !== this.focusSource) {
      // Re-arm focus after a face/hand source switch: stale dwell cannot activate.
      this.focus = null;
      this.focusSource = nextRaw.source;
    }
    if (nextRaw.source === 'none') {
      this.pointer = { ...EMPTY_SPATIAL_POINT };
      this.focus = null;
    } else {
      const sourceChanged = this.pointer.source !== nextRaw.source;
      const alpha = sourceChanged ? 1 : nextRaw.source === 'hand' ? 0.42 : 0.22;
      this.pointer = {
        x: smooth(this.pointer.x, nextRaw.x, alpha),
        y: smooth(this.pointer.y, nextRaw.y, alpha),
        z: smooth(this.pointer.z, nextRaw.z, nextRaw.source === 'hand' ? 0.34 : 0.18),
        confidence: smooth(this.pointer.confidence, nextRaw.confidence, 0.36),
        source: nextRaw.source,
      };

      const target = rayHit
        ? input.targets.find((item) => item.id === rayHit.targetId) || null
        : chooseTarget(input.targets, this.pointer, this.focus);
      if (!target) {
        this.focus = null;
      } else if (!this.focus || this.focus.id !== target.id) {
        this.focus = {
          id: target.id,
          label: target.label,
          kind: target.kind,
          since: now,
          ready: false,
          score: targetScore(target, this.pointer),
        };
      } else {
        const readyMs = this.pointer.source === 'face' ? FACE_FOCUS_MS : HAND_FOCUS_MS;
        this.focus = {
          ...this.focus,
          label: target.label,
          kind: target.kind,
          ready: now - this.focus.since >= readyMs,
          score: targetScore(target, this.pointer),
        };
      }
    }

    const events: SpatialControlEvent[] = [];
    const focus = this.focus;
    const trackedHand = handPoint.source === 'hand' && input.hand.present;
    const canCommit = Boolean(focus?.ready && now - this.lastActivationAt >= 360);
    const grabTargetVisible = !this.grabTargetId || input.targets.some((target) => target.id === this.grabTargetId);
    if (this.grabTargetId && (!trackedHand || !input.hand.pinching)) {
      this.grabReleaseSince ??= now;
    } else {
      this.grabReleaseSince = null;
    }
    const trackingLost = this.grabReleaseSince !== null && now - this.grabReleaseSince >= 180;
    const shouldCancelGrab = Boolean(this.grabTargetId) &&
      (!grabTargetVisible || trackingLost) && input.gestureIntent.intent !== 'pinch_up';
    if (shouldCancelGrab) {
      events.push({
        type: 'cancel',
        targetId: this.grabTargetId,
        targetKind: this.grabTargetKind,
        source: 'hand',
        point: { ...this.pointer },
        at: now,
      });
      this.grabTargetId = '';
      this.grabTargetKind = null;
      this.grabReleaseSince = null;
    }

    if (input.headGesture === 'shake' && this.previousHeadGesture !== 'shake' && this.grabTargetId) {
      events.push({
        type: 'cancel',
        targetId: this.grabTargetId,
        targetKind: this.grabTargetKind,
        source: 'face',
        point: { ...this.pointer },
        at: now,
      });
      this.grabTargetId = '';
      this.grabTargetKind = null;
    }

    const nodEdge = input.headGesture === 'nod' && this.previousHeadGesture !== 'nod';
    if (nodEdge && canCommit && focus?.kind === 'action' && this.pointer.source === 'face') {
      events.push({
        type: 'activate',
        targetId: focus.id,
        targetKind: focus.kind,
        source: 'face',
        point: { ...this.pointer },
        at: now,
      });
      this.lastActivationAt = now;
    }

    if (
      input.gestureIntent.intent === 'pinch_down' &&
      input.gestureIntent.confidence >= 0.62 &&
      input.hand.pinching && trackedHand && canCommit && focus &&
      !shouldCancelGrab
    ) {
      if ((focus.kind === 'window' || focus.kind === 'object') && input.hand.present) {
        this.grabTargetId = focus.id;
        this.grabTargetKind = focus.kind;
        this.grabReleaseSince = null;
        events.push({
          type: 'grab_start',
          targetId: focus.id,
          targetKind: focus.kind,
          source: 'hand',
          point: handPoint.source === 'hand' ? handPoint : { ...this.pointer },
          at: now,
        });
      } else if (focus.kind === 'action') {
        events.push({
          type: 'activate',
          targetId: focus.id,
          targetKind: focus.kind,
          source: 'hand',
          point: { ...this.pointer },
          at: now,
        });
      }
      this.lastActivationAt = now;
    }

    if (this.grabTargetId && trackedHand && input.hand.pinching) {
      events.push({
        type: 'grab_move',
        targetId: this.grabTargetId,
        targetKind: this.grabTargetKind,
        source: 'hand',
        point: handPoint.source === 'hand' ? handPoint : { ...this.pointer },
        at: now,
      });
    }

    if (this.grabTargetId && input.gestureIntent.intent === 'pinch_up') {
      events.push({
        type: 'grab_end',
        targetId: this.grabTargetId,
        targetKind: this.grabTargetKind,
        source: 'hand',
        point: handPoint.source === 'hand' ? handPoint : { ...this.pointer },
        at: now,
      });
      this.grabTargetId = '';
      this.grabTargetKind = null;
      this.grabReleaseSince = null;
    }

    this.previousHeadGesture = input.headGesture || 'none';

    return {
      pointer: { ...this.pointer },
      focus: this.focus ? { ...this.focus } : null,
      rayHit: rayHit ? { ...rayHit, point: { ...rayHit.point } } : null,
      events,
      grabbing: Boolean(this.grabTargetId),
      grabTargetId: this.grabTargetId,
    };
  }

  reset(): SpatialControlFrame {
    this.pointer = { ...EMPTY_SPATIAL_POINT };
    this.focus = null;
    this.grabTargetId = '';
    this.grabTargetKind = null;
    this.previousHeadGesture = 'none';
    this.lastActivationAt = -Infinity;
    this.grabReleaseSince = null;
    this.focusSource = 'none';
    return {
      ...EMPTY_SPATIAL_CONTROL_FRAME,
      pointer: { ...EMPTY_SPATIAL_POINT },
      rayHit: null,
    };
  }
}
