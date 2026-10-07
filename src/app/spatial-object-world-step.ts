import type { SpatialObjectRuntime, SpatialObjectState } from '../core/vision/spatial-object';
import type { SpatialPhysicsRuntime, SpatialPhysicsState } from '../core/vision/spatial-physics';
import { resolveSpatialObjectCollisions } from '../core/vision/spatial-collision';
import type { SpatialJointRuntime } from '../core/vision/spatial-joint';
import type { SpatialWorldRuntime } from '../core/vision/spatial-world';
import {
  collectSpatialWorldAnchors,
  spatialJointForAttachment,
} from './spatial-ui-helpers';

type MutableBox<T> = { current: T };

type SpatialObjectWorldStepInput = {
  now: number;
  objectRuntime: SpatialObjectRuntime;
  worldRuntime: SpatialWorldRuntime;
  physicsRuntime: SpatialPhysicsRuntime;
  jointRuntime: SpatialJointRuntime;
  collisionFeedbackAtRef: MutableBox<number>;
  setPhysicsState: (state: SpatialPhysicsState) => void;
  setSpatialObjects: (objects: SpatialObjectState[]) => void;
  showFeedback: (message: string) => void;
};

export function stepSpatialObjectWorld(input: SpatialObjectWorldStepInput): boolean {
  const {
    now,
    objectRuntime,
    worldRuntime,
    physicsRuntime,
    jointRuntime,
    collisionFeedbackAtRef,
    setPhysicsState,
    setSpatialObjects,
    showFeedback,
  } = input;

  let changed = false;

  for (const object of objectRuntime.snapshot()) {
    if (!object.grabbed && physicsRuntime.isActive(object.id)) {
      const inertiaStep = physicsRuntime.step(object.id, object.pose, now);
      objectRuntime.setPose(object.id, inertiaStep.pose);
      setPhysicsState(inertiaStep.state);
      changed = true;
    }
  }

  let objects = objectRuntime.snapshot();
  worldRuntime.setAnchors(collectSpatialWorldAnchors(objects));

  for (const object of objects) {
    const attachment = worldRuntime.attachment(object.id);
    if (!attachment && !object.grabbed && physicsRuntime.isActive(object.id)) {
      const inertiaPreview = worldRuntime.previewSnapObject(object.id, object.pose);
      if (
        inertiaPreview &&
        inertiaPreview.strength >= 0.78 &&
        physicsRuntime.snapshot(object.id).speed <= 0.34
      ) {
        const snapped = worldRuntime.snapObject(object.id, object.pose, now);
        if (snapped) {
          objectRuntime.setPose(object.id, snapped.worldPose);
          setPhysicsState(physicsRuntime.stop(object.id, now));

          const parentObjectId = worldRuntime.parentObjectId(object.id);
          const jointDefinition = spatialJointForAttachment(
            object.id,
            parentObjectId,
            snapped.anchorId,
          );
          if (jointDefinition) jointRuntime.setJoint(jointDefinition);
          else jointRuntime.removeForChild(object.id);

          changed = true;
          showFeedback(`Đã bắt neo · ${snapped.anchorLabel}`);
        }
      }
    }
  }

  objects = objectRuntime.snapshot();
  worldRuntime.setAnchors(collectSpatialWorldAnchors(objects));

  for (const joint of jointRuntime.snapshot()) {
    if (!worldRuntime.attachment(joint.childObjectId)) {
      jointRuntime.removeForChild(joint.childObjectId);
    }
  }

  for (const object of objects) {
    const attachment = worldRuntime.attachment(object.id);
    if (!attachment || object.grabbed) continue;

    const resolvedPose = worldRuntime.resolveObjectPose(object.id);
    if (!resolvedPose) continue;

    const delta = Math.hypot(
      resolvedPose.position.x - object.pose.position.x,
      resolvedPose.position.y - object.pose.position.y,
      resolvedPose.position.z - object.pose.position.z,
    );
    if (
      delta > 0.001 ||
      Math.abs(resolvedPose.scale - object.pose.scale) > 0.001 ||
      Math.abs(resolvedPose.rotation - object.pose.rotation) > 0.1
    ) {
      objectRuntime.setPose(object.id, resolvedPose);
      changed = true;
    }
  }

  objects = objectRuntime.snapshot();
  const collision = resolveSpatialObjectCollisions(
    objects.map((object) => ({
      id: object.id,
      pose: object.pose,
      radius: object.collisionRadius,
      mass: object.mass,
      dynamic: !object.grabbed && !worldRuntime.attachment(object.id),
      clusterId: worldRuntime.clusterRootObjectId(object.id),
    })),
    Object.fromEntries(objects.map((object) => [
      object.id,
      physicsRuntime.velocity(object.id),
    ])),
  );

  if (collision.contacts.length) {
    for (const object of objects) {
      if (!object.grabbed && !worldRuntime.attachment(object.id)) {
        objectRuntime.setPose(object.id, collision.poses[object.id]);
      }
      const impulse = collision.velocityDeltas[object.id];
      if (impulse && Math.hypot(impulse.x, impulse.y, impulse.z) > 0.012) {
        setPhysicsState(physicsRuntime.addVelocity(object.id, impulse, now));
      }
    }

    worldRuntime.setAnchors(
      collectSpatialWorldAnchors(objectRuntime.snapshot()),
    );

    for (const contact of collision.contacts) {
      const a = objectRuntime.get(contact.aId);
      const b = objectRuntime.get(contact.bId);
      if (!a || !b) continue;

      const aAttached = Boolean(worldRuntime.attachment(a.id));
      const bAttached = Boolean(worldRuntime.attachment(b.id));

      if (
        contact.stackCandidate &&
        !a.grabbed &&
        !b.grabbed &&
        !aAttached &&
        !bAttached
      ) {
        const child = a.pose.position.y <= b.pose.position.y ? a : b;
        const parent = child.id === a.id ? b : a;
        const attachment = worldRuntime.attachObject(
          child.id,
          `stack.${parent.id}`,
          child.pose,
          now,
        );
        if (attachment) {
          jointRuntime.setJoint({
            id: `joint.${child.id}`,
            kind: 'fixed',
            parentObjectId: parent.id,
            childObjectId: child.id,
            stiffness: 1,
          });
          const resolved = worldRuntime.resolveObjectPose(child.id);
          if (resolved) objectRuntime.setPose(child.id, resolved);
          setPhysicsState(physicsRuntime.stop(child.id, now));

          if (now - collisionFeedbackAtRef.current >= 650) {
            collisionFeedbackAtRef.current = now;
            showFeedback(`Đã xếp · ${child.label} trên ${parent.label}`);
          }
          changed = true;
          continue;
        }
      }

      if (
        contact.impulse > 0.01 &&
        now - collisionFeedbackAtRef.current >= 650
      ) {
        collisionFeedbackAtRef.current = now;
        showFeedback('Va chạm · truyền lực');
      }
    }
    changed = true;
  }

  if (changed) setSpatialObjects(objectRuntime.snapshot());
  return changed;
}
