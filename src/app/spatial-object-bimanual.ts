import type { SpatialObjectPose, SpatialObjectRuntime, SpatialObjectState } from '../core/vision/spatial-object';
import type { SpatialPhysicsRuntime, SpatialPhysicsState } from '../core/vision/spatial-physics';
import type { SpatialJointRuntime } from '../core/vision/spatial-joint';
import type { SpatialSelectionRuntime } from '../core/vision/spatial-layout';
import {
  applySpatialGroupTransform,
  beginSpatialGroupTransform,
  type SpatialGroupTransformSession,
} from '../core/vision/spatial-group';
import type { SpatialWorldRuntime } from '../core/vision/spatial-world';
import { measureTwoHands, rotationFromAngles, scaleFromDistance } from '../presence/spatial-math';
import {
  clampSpatial,
  collectSpatialWorldAnchors,
  spatialObjectAvailable,
} from './spatial-ui-helpers';

type MutableBox<T> = { current: T };

type BimanualHand = {
  pointerX?: number;
  pointerY?: number;
  x?: number;
  y?: number;
};

export type SpatialGroupTransformState = {
  key: string;
  since: number;
  active: boolean;
  startDistance: number;
  startAngle: number;
  startCenter: { x: number; y: number };
  session: SpatialGroupTransformSession;
};

export type TwoHandObjectSession = {
  id: string;
  since: number;
  active: boolean;
  startDistance: number;
  startAngle: number;
  baseScale: number;
  baseRotation: number;
  transformObjectId?: string;
  jointId?: string;
  jointKind?: 'fixed' | 'hinge' | 'slider';
  baseJointValue?: number;
  startCenterX?: number;
  baseAttachmentLocalPose?: SpatialObjectPose;
};

type SpatialObjectBimanualInput = {
  pinchedHands: BimanualHand[];
  focusObjectId: string;
  now: number;
  objectRuntime: SpatialObjectRuntime;
  worldRuntime: SpatialWorldRuntime;
  physicsRuntime: SpatialPhysicsRuntime;
  jointRuntime: SpatialJointRuntime;
  selectionRuntime: SpatialSelectionRuntime;
  groupTransformRef: MutableBox<SpatialGroupTransformState | null>;
  objectSessionRef: MutableBox<TwoHandObjectSession | null>;
  jointControlRef: MutableBox<string | null>;
  setPhysicsState: (state: SpatialPhysicsState) => void;
  setSpatialObjects: (objects: SpatialObjectState[]) => void;
  showFeedback: (message: string) => void;
};

export function updateSpatialObjectBimanual(input: SpatialObjectBimanualInput): boolean {
  const {
    pinchedHands,
    focusObjectId,
    now,
    objectRuntime,
    worldRuntime,
    physicsRuntime,
    jointRuntime,
    selectionRuntime,
    groupTransformRef,
    objectSessionRef,
    jointControlRef,
    setPhysicsState,
    setSpatialObjects,
    showFeedback,
  } = input;

  if (
    pinchedHands.length < 2 ||
    !focusObjectId ||
    !spatialObjectAvailable(focusObjectId)
  ) {
    groupTransformRef.current = null;
    jointControlRef.current = null;
    objectSessionRef.current = null;
    return false;
  }

  const a = pinchedHands[0];
  const b = pinchedHands[1];
  const geometry = measureTwoHands(
    {
      x: clampSpatial(Number(a?.pointerX ?? a?.x ?? 0.5), 0, 1),
      y: clampSpatial(Number(a?.pointerY ?? a?.y ?? 0.5), 0, 1),
    },
    {
      x: clampSpatial(Number(b?.pointerX ?? b?.x ?? 0.5), 0, 1),
      y: clampSpatial(Number(b?.pointerY ?? b?.y ?? 0.5), 0, 1),
    },
  );

  if (geometry.distance < 0.08) {
    groupTransformRef.current = null;
    objectSessionRef.current = null;
    jointControlRef.current = null;
    return false;
  }

  const targetRoot = worldRuntime.clusterRootObjectId(focusObjectId);
  const selectedRoots = selectionRuntime.snapshot();
  const groupMode = selectedRoots.length > 1 && selectedRoots.includes(targetRoot);

  if (groupMode) {
    objectSessionRef.current = null;
    jointControlRef.current = null;
    const key = [...selectedRoots].sort().join('|');
    let groupSession = groupTransformRef.current;

    if (!groupSession || groupSession.key !== key) {
      for (const rootId of selectedRoots) {
        worldRuntime.detachObject(rootId);
        jointRuntime.removeForChild(rootId);
        setPhysicsState(physicsRuntime.stop(rootId, now));
      }
      worldRuntime.setAnchors(collectSpatialWorldAnchors(objectRuntime.snapshot()));

      const runtimeSession = beginSpatialGroupTransform(
        objectRuntime.snapshot(),
        selectedRoots,
      );
      if (runtimeSession) {
        groupTransformRef.current = {
          key,
          since: now,
          active: false,
          startDistance: geometry.distance,
          startAngle: geometry.angleDeg,
          startCenter: { ...geometry.center },
          session: runtimeSession,
        };
      }
      return true;
    }

    if (!groupSession.active && now - groupSession.since >= 240 && geometry.distance >= 0.08) {
      groupSession.active = true;
      showFeedback(`Hai tay · điều khiển ${selectedRoots.length} cụm`);
      return true;
    }

    if (groupSession.active) {
      const poses = applySpatialGroupTransform(groupSession.session, {
        translateX: (geometry.center.x - groupSession.startCenter.x) * 1.08,
        translateY: (geometry.center.y - groupSession.startCenter.y) * 1.08,
        scaleRatio: groupSession.startDistance > 0.001
          ? geometry.distance / groupSession.startDistance
          : 1,
        rotationDelta: rotationFromAngles(
          0,
          groupSession.startAngle,
          geometry.angleDeg,
          -45,
          45,
        ),
      });

      for (const [id, pose] of Object.entries(poses)) {
        objectRuntime.setPose(id, pose);
      }

      worldRuntime.setAnchors(collectSpatialWorldAnchors(objectRuntime.snapshot()));
      for (const rootId of selectedRoots) {
        for (const childId of worldRuntime.clusterObjectIds(rootId).slice(1)) {
          const resolvedChild = worldRuntime.resolveObjectPose(childId);
          if (resolvedChild) objectRuntime.setPose(childId, resolvedChild);
        }
      }
      setSpatialObjects(objectRuntime.snapshot());
    }
    return true;
  }

  groupTransformRef.current = null;
  const attachment = worldRuntime.attachment(focusObjectId);
  const joint = jointRuntime.findForChild(focusObjectId);
  let objectSession = objectSessionRef.current;

  if (!objectSession || objectSession.id !== focusObjectId) {
    const transformObjectId = joint?.kind === 'fixed' && attachment
      ? worldRuntime.clusterRootObjectId(focusObjectId)
      : focusObjectId;
    const base = objectRuntime.get(transformObjectId);
    if (base) {
      objectSessionRef.current = {
        id: focusObjectId,
        transformObjectId,
        since: now,
        active: false,
        startDistance: geometry.distance,
        startAngle: geometry.angleDeg,
        startCenterX: geometry.center.x,
        baseScale: base.pose.scale,
        baseRotation: base.pose.rotation,
        jointId: joint?.id,
        jointKind: joint?.kind,
        baseJointValue: joint?.value || 0,
        baseAttachmentLocalPose: attachment?.localPose,
      };
    }
    return true;
  }

  if (!objectSession.active && now - objectSession.since >= 240 && geometry.distance >= 0.08) {
    objectSession.active = true;
    showFeedback(
      objectSession.jointKind === 'hinge'
        ? 'Hai tay · xoay bản lề'
        : objectSession.jointKind === 'slider'
          ? 'Hai tay · trượt theo ray'
          : worldRuntime.clusterObjectIds(
              objectSession.transformObjectId || objectSession.id,
            ).length > 1
            ? 'Hai tay · scale / rotate cả cụm'
            : 'Hai tay · scale / rotate vật thể',
    );
    return true;
  }

  if (!objectSession.active) return true;

  const liveJoint = objectSession.jointId
    ? jointRuntime.get(objectSession.jointId)
    : null;

  if (
    liveJoint &&
    objectSession.baseAttachmentLocalPose &&
    (liveJoint.kind === 'hinge' || liveJoint.kind === 'slider')
  ) {
    const requestedValue = liveJoint.kind === 'hinge'
      ? rotationFromAngles(
          objectSession.baseJointValue || 0,
          objectSession.startAngle,
          geometry.angleDeg,
          liveJoint.min,
          liveJoint.max,
        )
      : (objectSession.baseJointValue || 0) +
        (geometry.center.x - (objectSession.startCenterX || 0)) * 0.72;

    const constrained = jointRuntime.constrainLocalPose(
      objectSession.id,
      objectSession.baseAttachmentLocalPose,
      requestedValue,
    );
    if (constrained) {
      worldRuntime.updateAttachmentLocalPose(
        objectSession.id,
        constrained.localPose,
      );
      const resolved = worldRuntime.resolveObjectPose(objectSession.id);
      if (resolved) objectRuntime.setPose(objectSession.id, resolved);
      setSpatialObjects(objectRuntime.snapshot());
    }
    return true;
  }

  const transformId = objectSession.transformObjectId || objectSession.id;
  const scale = scaleFromDistance(
    objectSession.baseScale,
    objectSession.startDistance,
    geometry.distance,
    0.72,
    1.65,
  );
  const rotation = rotationFromAngles(
    objectSession.baseRotation,
    objectSession.startAngle,
    geometry.angleDeg,
    -45,
    45,
  );
  objectRuntime.applyTransform(transformId, { scale, rotation });

  worldRuntime.setAnchors(collectSpatialWorldAnchors(objectRuntime.snapshot()));
  for (const childId of worldRuntime.clusterObjectIds(transformId).slice(1)) {
    const resolvedChild = worldRuntime.resolveObjectPose(childId);
    if (resolvedChild) objectRuntime.setPose(childId, resolvedChild);
  }
  setSpatialObjects(objectRuntime.snapshot());
  return true;
}
