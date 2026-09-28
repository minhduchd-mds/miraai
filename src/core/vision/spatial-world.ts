export interface SpatialWorldPoint {
  x: number;
  y: number;
  z: number;
}

export interface SpatialWorldPose {
  position: SpatialWorldPoint;
  scale: number;
  rotation: number;
}

export type SpatialWorldAnchorKind = 'workspace' | 'surface' | 'dock';

export interface SpatialWorldAnchor {
  id: string;
  label: string;
  kind: SpatialWorldAnchorKind;
  parentId?: string | null;
  pose: SpatialWorldPose;
  snapRadius: number;
  enabled?: boolean;
  priority?: number;
}

export interface SpatialObjectAttachment {
  objectId: string;
  anchorId: string;
  localPose: SpatialWorldPose;
  attachedAt: number;
}

export interface SpatialSnapResult {
  objectId: string;
  anchorId: string;
  anchorLabel: string;
  distance: number;
  worldPose: SpatialWorldPose;
  attachment: SpatialObjectAttachment;
}

const MAX_PARENT_DEPTH = 8;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Number.isFinite(value) ? value : 0));
}

function clonePose(pose: SpatialWorldPose): SpatialWorldPose {
  return {
    position: { ...pose.position },
    scale: pose.scale,
    rotation: pose.rotation,
  };
}

function normalizeRotation(value: number): number {
  let next = Number.isFinite(value) ? value : 0;
  while (next > 180) next -= 360;
  while (next < -180) next += 360;
  return next;
}

function normalizePose(pose: SpatialWorldPose): SpatialWorldPose {
  return {
    position: {
      x: clamp(Number(pose.position.x || 0), -1.5, 1.5),
      y: clamp(Number(pose.position.y || 0), -1.5, 1.5),
      z: clamp(Number(pose.position.z || 0), -1.5, 1.5),
    },
    scale: clamp(Number(pose.scale || 1), 0.1, 5),
    rotation: normalizeRotation(Number(pose.rotation || 0)),
  };
}

function rotate2D(point: SpatialWorldPoint, degrees: number): SpatialWorldPoint {
  const radians = degrees * Math.PI / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  return {
    x: point.x * cos - point.y * sin,
    y: point.x * sin + point.y * cos,
    z: point.z,
  };
}

function composePose(parent: SpatialWorldPose, local: SpatialWorldPose): SpatialWorldPose {
  const scaled = {
    x: local.position.x * parent.scale,
    y: local.position.y * parent.scale,
    z: local.position.z * parent.scale,
  };
  const rotated = rotate2D(scaled, parent.rotation);
  return normalizePose({
    position: {
      x: parent.position.x + rotated.x,
      y: parent.position.y + rotated.y,
      z: parent.position.z + rotated.z,
    },
    scale: parent.scale * local.scale,
    rotation: parent.rotation + local.rotation,
  });
}

function inverseComposePose(parent: SpatialWorldPose, world: SpatialWorldPose): SpatialWorldPose {
  const delta = {
    x: world.position.x - parent.position.x,
    y: world.position.y - parent.position.y,
    z: world.position.z - parent.position.z,
  };
  const rotated = rotate2D(delta, -parent.rotation);
  const scale = Math.max(0.0001, parent.scale);
  return normalizePose({
    position: {
      x: rotated.x / scale,
      y: rotated.y / scale,
      z: rotated.z / scale,
    },
    scale: world.scale / scale,
    rotation: world.rotation - parent.rotation,
  });
}

function distance3(a: SpatialWorldPoint, b: SpatialWorldPoint): number {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

/**
 * Session-only world-coordinate and parent/child anchor graph.
 *
 * Coordinates are interaction-space values today, not physical meters.
 * The graph is intentionally sensor-agnostic so WebXR/device world poses can
 * replace the camera-relative adapter without changing snap/attachment rules.
 */
export class SpatialWorldRuntime {
  private anchors = new Map<string, SpatialWorldAnchor>();
  private attachments = new Map<string, SpatialObjectAttachment>();

  setAnchors(anchors: SpatialWorldAnchor[]): void {
    const next = new Map<string, SpatialWorldAnchor>();
    for (const anchor of anchors) {
      if (!anchor.id) continue;
      next.set(anchor.id, {
        ...anchor,
        parentId: anchor.parentId || null,
        pose: normalizePose(anchor.pose),
        snapRadius: clamp(Number(anchor.snapRadius || 0.12), 0.025, 0.8),
        enabled: anchor.enabled !== false,
        priority: Number(anchor.priority || 0),
      });
    }
    this.anchors = next;

    for (const [objectId, attachment] of this.attachments) {
      if (!this.anchors.has(attachment.anchorId)) this.attachments.delete(objectId);
    }
  }

  upsertAnchor(anchor: SpatialWorldAnchor): void {
    if (!anchor.id) return;
    this.anchors.set(anchor.id, {
      ...anchor,
      parentId: anchor.parentId || null,
      pose: normalizePose(anchor.pose),
      snapRadius: clamp(Number(anchor.snapRadius || 0.12), 0.025, 0.8),
      enabled: anchor.enabled !== false,
      priority: Number(anchor.priority || 0),
    });
  }

  resolveAnchorPose(id: string): SpatialWorldPose | null {
    return this.resolveAnchorPoseInternal(id, new Set<string>(), 0);
  }

  snapObject(
    objectId: string,
    objectPose: SpatialWorldPose,
    now = performance.now(),
  ): SpatialSnapResult | null {
    const worldObjectPose = normalizePose(objectPose);
    const candidates = Array.from(this.anchors.values())
      .filter((anchor) => anchor.enabled !== false)
      .map((anchor) => {
        const worldAnchorPose = this.resolveAnchorPose(anchor.id);
        if (!worldAnchorPose) return null;
        const distance = distance3(worldObjectPose.position, worldAnchorPose.position);
        if (distance > anchor.snapRadius) return null;
        const score = distance - Number(anchor.priority || 0) * 0.02;
        return { anchor, worldAnchorPose, distance, score };
      })
      .filter(Boolean)
      .sort((a: any, b: any) => a.score - b.score) as Array<{
        anchor: SpatialWorldAnchor;
        worldAnchorPose: SpatialWorldPose;
        distance: number;
        score: number;
      }>;

    const best = candidates[0];
    if (!best) {
      this.attachments.delete(objectId);
      return null;
    }

    // Snap position to the anchor origin while preserving object scale/rotation
    // as a local child transform.
    const snappedWorldPose = normalizePose({
      position: { ...best.worldAnchorPose.position },
      scale: worldObjectPose.scale,
      rotation: worldObjectPose.rotation,
    });
    const localPose = inverseComposePose(best.worldAnchorPose, snappedWorldPose);
    const attachment: SpatialObjectAttachment = {
      objectId,
      anchorId: best.anchor.id,
      localPose,
      attachedAt: now,
    };
    this.attachments.set(objectId, attachment);

    return {
      objectId,
      anchorId: best.anchor.id,
      anchorLabel: best.anchor.label,
      distance: best.distance,
      worldPose: clonePose(snappedWorldPose),
      attachment: {
        ...attachment,
        localPose: clonePose(attachment.localPose),
      },
    };
  }

  attachObject(
    objectId: string,
    anchorId: string,
    worldPose: SpatialWorldPose,
    now = performance.now(),
  ): SpatialObjectAttachment | null {
    const anchorPose = this.resolveAnchorPose(anchorId);
    if (!anchorPose) return null;
    const attachment: SpatialObjectAttachment = {
      objectId,
      anchorId,
      localPose: inverseComposePose(anchorPose, normalizePose(worldPose)),
      attachedAt: now,
    };
    this.attachments.set(objectId, attachment);
    return {
      ...attachment,
      localPose: clonePose(attachment.localPose),
    };
  }

  detachObject(objectId: string): SpatialObjectAttachment | null {
    const attachment = this.attachments.get(objectId);
    if (!attachment) return null;
    this.attachments.delete(objectId);
    return {
      ...attachment,
      localPose: clonePose(attachment.localPose),
    };
  }

  resolveObjectPose(objectId: string): SpatialWorldPose | null {
    const attachment = this.attachments.get(objectId);
    if (!attachment) return null;
    const parent = this.resolveAnchorPose(attachment.anchorId);
    if (!parent) return null;
    return composePose(parent, attachment.localPose);
  }

  attachment(objectId: string): SpatialObjectAttachment | null {
    const attachment = this.attachments.get(objectId);
    return attachment
      ? { ...attachment, localPose: clonePose(attachment.localPose) }
      : null;
  }

  reset(): void {
    this.anchors.clear();
    this.attachments.clear();
  }

  private resolveAnchorPoseInternal(
    id: string,
    visited: Set<string>,
    depth: number,
  ): SpatialWorldPose | null {
    if (depth > MAX_PARENT_DEPTH || visited.has(id)) return null;
    const anchor = this.anchors.get(id);
    if (!anchor || anchor.enabled === false) return null;

    if (!anchor.parentId) return clonePose(anchor.pose);

    const nextVisited = new Set(visited);
    nextVisited.add(id);
    const parent = this.resolveAnchorPoseInternal(anchor.parentId, nextVisited, depth + 1);
    if (!parent) return null;
    return composePose(parent, anchor.pose);
  }
}
