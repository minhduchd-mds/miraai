import type { SpatialControlEvent } from '../core/vision/spatial-ui-control';
import type { SpatialObjectRuntime, SpatialObjectState } from '../core/vision/spatial-object';
import {
  applySpatialSpringConstraint,
  type SpatialPhysicsRuntime,
  type SpatialPhysicsState,
} from '../core/vision/spatial-physics';
import type { SpatialJointRuntime, SpatialJointState } from '../core/vision/spatial-joint';
import type { SpatialDepthAnchorTracker } from '../core/vision/spatial-ray';
import type {
  SpatialObjectAttachment,
  SpatialPlacementPreview,
  SpatialWorldRuntime,
} from '../core/vision/spatial-world';
import {
  collectSpatialWorldAnchors,
  spatialJointForAttachment,
  spatialObjectAvailable,
} from './spatial-ui-helpers';

type MutableBox<T> = { current: T };

type ObjectManipulationInput = {
  event: SpatialControlEvent;
  twoHandsActive: boolean;
  humanIntent: string;
  now: number;
  objectRuntime: SpatialObjectRuntime;
  worldRuntime: SpatialWorldRuntime;
  physicsRuntime: SpatialPhysicsRuntime;
  jointRuntime: SpatialJointRuntime;
  depthRuntime: SpatialDepthAnchorTracker;
  attachmentBeforeGrabRef: MutableBox<SpatialObjectAttachment | null>;
  jointBeforeGrabRef: MutableBox<SpatialJointState | null>;
  placementPreviewRef: MutableBox<SpatialPlacementPreview | null>;
  jointControlRef: MutableBox<string | null>;
  twoHandObjectSessionRef: MutableBox<unknown | null>;
  setPhysicsState: (state: SpatialPhysicsState) => void;
  setSpatialObjects: (objects: SpatialObjectState[]) => void;
  setPlacementPreview: (preview: SpatialPlacementPreview | null) => void;
  showFeedback: (message: string) => void;
};

export function handleSpatialObjectManipulation(input: ObjectManipulationInput): boolean {
  const {
    event,
    twoHandsActive,
    humanIntent,
    now,
    objectRuntime,
    worldRuntime,
    physicsRuntime,
    jointRuntime,
    depthRuntime,
    attachmentBeforeGrabRef,
    jointBeforeGrabRef,
    placementPreviewRef,
    jointControlRef,
    twoHandObjectSessionRef,
    setPhysicsState,
    setSpatialObjects,
    setPlacementPreview,
    showFeedback,
  } = input;

  if (event.targetKind !== 'object') return false;

  if (event.type === 'grab_start' && spatialObjectAvailable(event.targetId)) {
    const existingAttachment = worldRuntime.attachment(event.targetId);
    const existingJoint = jointRuntime.findForChild(event.targetId);

    if (twoHandsActive && existingAttachment && existingJoint) {
      jointControlRef.current = event.targetId;
      showFeedback(
        existingJoint.kind === 'hinge'
          ? 'Hai tay · điều khiển bản lề'
          : existingJoint.kind === 'slider'
            ? 'Hai tay · điều khiển thanh trượt'
            : 'Hai tay · điều khiển cả cụm',
      );
      return true;
    }

    attachmentBeforeGrabRef.current = worldRuntime.detachObject(event.targetId);
    jointBeforeGrabRef.current = jointRuntime.removeForChild(event.targetId);
    objectRuntime.beginGrab(event.targetId, event.point);
    depthRuntime.begin(event.point.z);
    setPhysicsState(physicsRuntime.beginGrab(event.targetId, event.point, now));
    placementPreviewRef.current = null;
    setPlacementPreview(null);
    setSpatialObjects(objectRuntime.snapshot());

    const clusterMembers = worldRuntime.clusterObjectIds(event.targetId);
    showFeedback(
      clusterMembers.length > 1
        ? `Pinch giữ · cầm cụm ${clusterMembers.length} vật thể`
        : 'Pinch giữ · cầm vật thể 3D',
    );
    return true;
  }

  if (event.type === 'grab_move' && jointControlRef.current === event.targetId) {
    return true;
  }

  if (event.type === 'grab_move' && !twoHandsActive) {
    const depth = depthRuntime.update(event.point.z);
    setPhysicsState(physicsRuntime.sampleGrab(event.targetId, event.point, now));
    const intentDepthDelta = humanIntent === 'push'
      ? 0.035
      : humanIntent === 'pull'
        ? -0.035
        : 0;
    const moved = objectRuntime.moveGrab(event.point, {
      depthDelta: (depth.ready && depth.confidence >= 0.56 ? depth.normalizedDelta : 0) + intentDepthDelta,
      xyGain: 1.05,
      depthGain: 0.52,
    });

    if (moved && (humanIntent === 'rotate_cw' || humanIntent === 'rotate_ccw')) {
      objectRuntime.applyTransform(event.targetId, {
        rotationDelta: humanIntent === 'rotate_cw' ? 3.5 : -3.5,
      });
    }

    if (moved) {
      let worldObjects = objectRuntime.snapshot();
      worldRuntime.setAnchors(collectSpatialWorldAnchors(worldObjects));

      for (const childId of worldRuntime.clusterObjectIds(event.targetId).slice(1)) {
        const resolvedChild = worldRuntime.resolveObjectPose(childId);
        if (resolvedChild) objectRuntime.setPose(childId, resolvedChild);
      }

      worldObjects = objectRuntime.snapshot();
      worldRuntime.setAnchors(collectSpatialWorldAnchors(worldObjects));
      const previewPlacement = worldRuntime.previewSnapObject(event.targetId, moved.pose);
      placementPreviewRef.current = previewPlacement;
      setPlacementPreview(previewPlacement);

      if (previewPlacement && previewPlacement.strength >= 0.08) {
        objectRuntime.setPose(
          event.targetId,
          applySpatialSpringConstraint(
            moved.pose,
            previewPlacement.targetPose,
            previewPlacement.strength,
            0.05,
          ),
        );
      }
    }

    setSpatialObjects(objectRuntime.snapshot());
    return true;
  }

  if (event.type === 'grab_end' && jointControlRef.current === event.targetId) {
    jointControlRef.current = null;
    showFeedback('Đã khóa vị trí khớp');
    return true;
  }

  if (event.type === 'grab_end') {
    const previewAtRelease = placementPreviewRef.current;
    const release = physicsRuntime.release(
      event.targetId,
      previewAtRelease?.strength || 0,
      now,
    );
    setPhysicsState(physicsRuntime.snapshot(event.targetId));
    const placed = objectRuntime.endGrab();
    depthRuntime.end();
    worldRuntime.setAnchors(collectSpatialWorldAnchors(objectRuntime.snapshot()));

    if (release.mode === 'throw') {
      worldRuntime.detachObject(event.targetId);
      jointRuntime.removeForChild(event.targetId);
      showFeedback('Ném · quán tính không gian');
    } else {
      const snapped = placed
        ? worldRuntime.snapObject(event.targetId, placed.pose, now)
        : null;
      if (snapped) {
        objectRuntime.setPose(event.targetId, snapped.worldPose);
        setPhysicsState(physicsRuntime.stop(event.targetId, now));

        const parentObjectId = worldRuntime.parentObjectId(event.targetId);
        const jointDefinition = spatialJointForAttachment(
          event.targetId,
          parentObjectId,
          snapped.anchorId,
        );
        if (jointDefinition) jointRuntime.setJoint(jointDefinition);
        else jointRuntime.removeForChild(event.targetId);

        showFeedback(`Đã neo · ${snapped.anchorLabel}`);
      } else {
        jointRuntime.removeForChild(event.targetId);
        setPhysicsState(physicsRuntime.stop(event.targetId, now));
        showFeedback('Đã đặt vật thể tự do');
      }
    }

    attachmentBeforeGrabRef.current = null;
    jointBeforeGrabRef.current = null;
    placementPreviewRef.current = null;
    setPlacementPreview(null);
    setSpatialObjects(objectRuntime.snapshot());
    return true;
  }

  if (event.type === 'cancel' && jointControlRef.current === event.targetId) {
    jointControlRef.current = null;
    twoHandObjectSessionRef.current = null;
    showFeedback('Đã hủy điều khiển khớp');
    return true;
  }

  if (event.type === 'cancel') {
    const restored = objectRuntime.cancelGrab();
    depthRuntime.reset();
    const previousAttachment = attachmentBeforeGrabRef.current;

    if (restored && previousAttachment) {
      worldRuntime.attachObject(
        event.targetId,
        previousAttachment.anchorId,
        restored.pose,
        previousAttachment.attachedAt,
      );
      if (jointBeforeGrabRef.current) {
        jointRuntime.setJoint(jointBeforeGrabRef.current);
      }
    }

    attachmentBeforeGrabRef.current = null;
    jointBeforeGrabRef.current = null;
    placementPreviewRef.current = null;
    setPlacementPreview(null);
    setPhysicsState(physicsRuntime.stop(event.targetId, now));
    setSpatialObjects(objectRuntime.snapshot());
    showFeedback('Đã hoàn tác vật thể');
    return true;
  }

  return false;
}
