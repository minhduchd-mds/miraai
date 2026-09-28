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

export type SpatialWorldAnchorKind = 'workspace' | 'surface' | 'dock' | 'object';

export interface SpatialSurfaceConstraint {
  axis: 'xy' | 'xz' | 'yz';
  halfExtents: SpatialWorldPoint;
  offset?: number;
}

export interface SpatialWorldAnchor {
  id: string;
  label: string;
  kind: SpatialWorldAnchorKind;
  parentId?: string | null;
  pose: SpatialWorldPose;
  snapRadius: number;
  enabled?: boolean;
  priority?: number;
  constraint?: SpatialSurfaceConstraint | null;
  ownerObjectId?: string | null;
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

export interface SpatialPlacementPreview {
  objectId: string;
  anchorId: string;
  anchorLabel: string;
  anchorKind: SpatialWorldAnchorKind;
  distance: number;
  strength: number;
  worldPose: SpatialWorldPose;
  constrained: boolean;
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

function nearestConstrainedPoint(
  anchorPose: SpatialWorldPose,
  point: SpatialWorldPoint,
  constraint: SpatialSurfaceConstraint | null | undefined,
): { point: SpatialWorldPoint; constrained: boolean } {
  if (!constraint) return { point: { ...anchorPose.position }, constrained: false };

  const inverseRotation = -anchorPose.rotation;
  const deltaWorld = {
    x: point.x - anchorPose.position.x,
    y: point.y - anchorPose.position.y,
    z: point.z - anchorPose.position.z,
  };
  const local = rotate2D(deltaWorld, inverseRotation);
  const scale = Math.max(0.0001, anchorPose.scale);
  local.x /= scale;
  local.y /= scale;
  local.z /= scale;

  const half = constraint.halfExtents;
  const offset = Number(constraint.offset || 0);
  if (constraint.axis === 'xy') {
    local.x = clamp(local.x, -Math.abs(half.x), Math.abs(half.x));
    local.y = clamp(local.y, -Math.abs(half.y), Math.abs(half.y));
    local.z = offset;
  } else if (constraint.axis === 'xz') {
    local.x = clamp(local.x, -Math.abs(half.x), Math.abs(half.x));
    local.y = offset;
    local.z = clamp(local.z, -Math.abs(half.z), Math.abs(half.z));
  } else {
    local.x = offset;
    local.y = clamp(local.y, -Math.abs(half.y), Math.abs(half.y));
    local.z = clamp(local.z, -Math.abs(half.z), Math.abs(half.z));
  }

  const scaled = {
    x: local.x * scale,
    y: local.y * scale,
    z: local.z * scale,
  };
  const rotated = rotate2D(scaled, anchorPose.rotation);
  return {
    point: {
      x: anchorPose.position.x + rotated.x,
      y: anchorPose.position.y + rotated.y,
      z: anchorPose.position.z + rotated.z,
    },
    constrained: true,
  };
}

function magneticStrength(distance: number, radius: number): number {
  if (radius <= 0 || distance >= radius) return 0;
  const proximity = 1 - distance / radius;
  return clamp(proximity * proximity * (3 - 2 * proximity), 0, 1);
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
        constraint: anchor.constraint
          ? {
              ...anchor.constraint,
              halfExtents: { ...anchor.constraint.halfExtents },
              offset: Number(anchor.constraint.offset || 0),
            }
          : null,
        ownerObjectId: anchor.ownerObjectId || null,
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
      constraint: anchor.constraint
        ? {
            ...anchor.constraint,
            halfExtents: { ...anchor.constraint.halfExtents },
            offset: Number(anchor.constraint.offset || 0),
          }
        : null,
      ownerObjectId: anchor.ownerObjectId || null,
    });
  }

  resolveAnchorPose(id: string): SpatialWorldPose | null {
    return this.resolveAnchorPoseInternal(id, new Set<string>(), 0);
  }

  upsertObjectAnchor(
    objectId: string,
    label: string,
    pose: SpatialWorldPose,
    snapRadius = 0.14,
    parentId: string | null = 'workspace.root',
  ): void {
    const id = `object.${objectId}`;
    this.upsertAnchor({
      id,
      label,
      kind: 'object',
      parentId,
      pose: normalizePose(pose),
      snapRadius,
      priority: 0.45,
      ownerObjectId: objectId,
    });
  }

  previewSnapObject(
    objectId: string,
    objectPose: SpatialWorldPose,
  ): SpatialPlacementPreview | null {
    const worldObjectPose = normalizePose(objectPose);
    const candidates = this.snapCandidates(objectId, worldObjectPose);
    const best = candidates[0];
    if (!best) return null;

    const strength = magneticStrength(best.distance, best.anchor.snapRadius);
    return {
      objectId,
      anchorId: best.anchor.id,
      anchorLabel: best.anchor.label,
      anchorKind: best.anchor.kind,
      distance: best.distance,
      strength,
      worldPose: normalizePose({
        position: {
          x: worldObjectPose.position.x + (best.point.x - worldObjectPose.position.x) * strength,
          y: worldObjectPose.position.y + (best.point.y - worldObjectPose.position.y) * strength,
          z: worldObjectPose.position.z + (best.point.z - worldObjectPose.position.z) * strength,
        },
        scale: worldObjectPose.scale,
        rotation: worldObjectPose.rotation,
      }),
      constrained: best.constrained,
    };
  }

  snapObject(
    objectId: string,
    objectPose: SpatialWorldPose,
    now = performance.now(),
  ): SpatialSnapResult | null {
    const worldObjectPose = normalizePose(objectPose);
    const candidates = this.snapCandidates(objectId, worldObjectPose);
    const best = candidates[0];
    if (!best) {
      this.attachments.delete(objectId);
      return null;
    }

    // Snap position to the anchor origin while preserving object scale/rotation
    // as a local child transform.
    const snappedWorldPose = normalizePose({
      position: { ...best.point },
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

  private snapCandidates(objectId: string, worldObjectPose: SpatialWorldPose) {
    return Array.from(this.anchors.values())
      .filter((anchor) =>
        anchor.enabled !== false &&
        anchor.ownerObjectId !== objectId
      )
      .map((anchor) => {
        const worldAnchorPose = this.resolveAnchorPose(anchor.id);
        if (!worldAnchorPose) return null;
        const constrained = nearestConstrainedPoint(
          worldAnchorPose,
          worldObjectPose.position,
          anchor.constraint,
        );
        const distance = distance3(worldObjectPose.position, constrained.point);
        if (distance > anchor.snapRadius) return null;
        const score = distance - Number(anchor.priority || 0) * 0.02;
        return {
          anchor,
          worldAnchorPose,
          point: constrained.point,
          constrained: constrained.constrained,
          distance,
          score,
        };
      })
      .filter(Boolean)
      .sort((a: any, b: any) => a.score - b.score) as Array<{
        anchor: SpatialWorldAnchor;
        worldAnchorPose: SpatialWorldPose;
        point: SpatialWorldPoint;
        constrained: boolean;
        distance: number;
        score: number;
      }>;
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
