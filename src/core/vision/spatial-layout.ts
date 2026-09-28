import type { SpatialObjectState } from './spatial-object';
import type { SpatialObjectAttachment } from './spatial-world';
import type { SpatialJointState } from './spatial-joint';

export interface SpatialSessionLayoutSnapshot {
  version: 1;
  objects: SpatialObjectState[];
  attachments: SpatialObjectAttachment[];
  joints: SpatialJointState[];
  selectedClusterRoots: string[];
  capturedAt: number;
}

const MAX_LAYOUT_OBJECTS = 32;
const MAX_LAYOUT_ATTACHMENTS = 32;
const MAX_LAYOUT_JOINTS = 32;
const MAX_SELECTED_CLUSTERS = 16;

function clonePose<T extends { position: { x: number; y: number; z: number }; scale: number; rotation: number }>(pose: T): T {
  return {
    ...pose,
    position: { ...pose.position },
  };
}

function cloneSnapshot(snapshot: SpatialSessionLayoutSnapshot): SpatialSessionLayoutSnapshot {
  return {
    version: 1,
    objects: snapshot.objects.map((object) => ({
      ...object,
      pose: clonePose(object.pose),
    })),
    attachments: snapshot.attachments.map((attachment) => ({
      ...attachment,
      localPose: clonePose(attachment.localPose),
    })),
    joints: snapshot.joints.map((joint) => ({ ...joint })),
    selectedClusterRoots: [...snapshot.selectedClusterRoots],
    capturedAt: snapshot.capturedAt,
  };
}

/**
 * RAM-only layout checkpoint. The module singleton survives React surface
 * remounts within the same page session but never writes to browser storage.
 */
export class SpatialSessionLayoutRuntime {
  private current: SpatialSessionLayoutSnapshot | null = null;

  capture(input: {
    objects: SpatialObjectState[];
    attachments: SpatialObjectAttachment[];
    joints: SpatialJointState[];
    selectedClusterRoots: string[];
  }, now = performance.now()): SpatialSessionLayoutSnapshot {
    const objectIds = new Set(input.objects.map((object) => object.id));
    const objects = input.objects.slice(0, MAX_LAYOUT_OBJECTS).map((object) => ({
      ...object,
      grabbed: false,
      pose: clonePose(object.pose),
    }));
    const attachments = input.attachments
      .filter((attachment) => objectIds.has(attachment.objectId))
      .slice(0, MAX_LAYOUT_ATTACHMENTS)
      .map((attachment) => ({
        ...attachment,
        localPose: clonePose(attachment.localPose),
      }));
    const joints = input.joints
      .filter((joint) =>
        objectIds.has(joint.childObjectId) &&
        objectIds.has(joint.parentObjectId)
      )
      .slice(0, MAX_LAYOUT_JOINTS)
      .map((joint) => ({ ...joint }));
    const selectedClusterRoots = Array.from(new Set(input.selectedClusterRoots))
      .filter((id) => objectIds.has(id))
      .slice(0, MAX_SELECTED_CLUSTERS);

    this.current = {
      version: 1,
      objects,
      attachments,
      joints,
      selectedClusterRoots,
      capturedAt: now,
    };
    return cloneSnapshot(this.current);
  }

  restore(): SpatialSessionLayoutSnapshot | null {
    return this.current ? cloneSnapshot(this.current) : null;
  }

  clear(): void {
    this.current = null;
  }
}

export class SpatialSelectionRuntime {
  private selected = new Set<string>();

  toggle(clusterRootId: string): string[] {
    if (!clusterRootId) return this.snapshot();
    if (this.selected.has(clusterRootId)) this.selected.delete(clusterRootId);
    else if (this.selected.size < MAX_SELECTED_CLUSTERS) this.selected.add(clusterRootId);
    return this.snapshot();
  }

  replace(ids: string[]): string[] {
    this.selected = new Set(ids.filter(Boolean).slice(0, MAX_SELECTED_CLUSTERS));
    return this.snapshot();
  }

  clear(): string[] {
    this.selected.clear();
    return [];
  }

  has(id: string): boolean {
    return this.selected.has(id);
  }

  snapshot(): string[] {
    return Array.from(this.selected);
  }
}

let singleton: SpatialSessionLayoutRuntime | null = null;

export function spatialSessionLayoutRuntime(): SpatialSessionLayoutRuntime {
  if (!singleton) singleton = new SpatialSessionLayoutRuntime();
  return singleton;
}
