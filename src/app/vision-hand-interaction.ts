import type { SpatialTargetGeometry } from '../core/vision/spatial-ui-control';
import {
  spatialAnchorFromRect,
  type SpatialDirectTouchTracker,
} from '../core/vision/spatial-anchor';
import {
  hitTestSpatialRay,
  type SpatialRay3D,
} from '../core/vision/spatial-ray';
import type { SpatialHandKinematicsState } from '../core/vision/spatial-hand-kinematics';
import type { SpatialHandContactRuntime } from '../core/vision/spatial-hand-contact';
import type { SpatialHandIntentRuntime } from '../core/vision/spatial-hand-intent';

type VisionHandInteractionInput = {
  spatialTargets: SpatialTargetGeometry[];
  handActive: boolean;
  screenKinematics: SpatialHandKinematicsState;
  handConfidence: number;
  primaryPointerX: number;
  primaryPointerY: number;
  primaryPointerZ: number;
  primaryPinching: boolean;
  pointingHand: boolean;
  handRay: SpatialRay3D | null;
  contactRuntime: SpatialHandContactRuntime;
  intentRuntime: SpatialHandIntentRuntime;
  touchRuntime: SpatialDirectTouchTracker;
  now: number;
};

export function updateVisionHandInteraction(input: VisionHandInteractionInput) {
  const spatialAnchors = input.spatialTargets.map((target) => spatialAnchorFromRect({
    ...target,
    depthRadius: Math.max(
      Number(target.depthRadius || 0),
      target.kind === 'window' ? 0.1 : 0.12,
    ),
  }));

  const humanContact = input.contactRuntime.update(
    input.screenKinematics,
    spatialAnchors.map((anchor) => ({
      id: anchor.id,
      label: anchor.label,
      kind: anchor.kind,
      center: { ...anchor.center },
      halfExtents: { ...anchor.halfExtents },
      priority: anchor.priority,
    })),
    input.now,
  );

  const humanIntent = input.intentRuntime.update(
    input.screenKinematics,
    humanContact,
    input.now,
  );

  const directTouch = input.touchRuntime.update({
    active: input.handActive,
    confidence: input.handConfidence,
    point: {
      x: input.primaryPointerX,
      y: input.primaryPointerY,
      z: input.primaryPointerZ,
    },
    pinching: input.primaryPinching,
    anchors: spatialAnchors,
  }, input.now);

  const directHand =
    input.pointingHand ||
    directTouch.ready ||
    humanContact.phase === 'contact' ||
    humanContact.phase === 'press' ||
    humanContact.phase === 'grab';

  const spatialRayTargets = input.spatialTargets
    .filter((target) => Number.isFinite(target.z))
    .map((target) => ({
      id: target.id,
      label: target.label,
      left: target.left,
      top: target.top,
      right: target.right,
      bottom: target.bottom,
      z: Number(target.z || 0),
      depthRadius: Number(target.depthRadius || 0),
      priority: target.priority,
    }));

  const rayHitFromContact = directTouch.ready && directTouch.hit
    ? {
        targetId: directTouch.hit.targetId,
        label: directTouch.hit.label,
        point: { ...directTouch.hit.point },
        distance: 0,
        confidence: directTouch.hit.confidence,
      }
    : null;

  const rayHit = directHand
    ? rayHitFromContact || hitTestSpatialRay(input.handRay, spatialRayTargets)
    : null;

  return {
    spatialAnchors,
    humanContact,
    humanIntent,
    directTouch,
    directHand,
    rayHit,
  };
}
