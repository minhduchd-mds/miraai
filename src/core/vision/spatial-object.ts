export interface SpatialObjectPoint {
  x: number;
  y: number;
  z: number;
}

export interface SpatialObjectPose {
  position: SpatialObjectPoint;
  scale: number;
  rotation: number;
}

export interface SpatialObjectDefinition {
  id: string;
  label: string;
  pose?: Partial<SpatialObjectPose> & { position?: Partial<SpatialObjectPoint> };
  minScale?: number;
  maxScale?: number;
  collisionRadius?: number;
  mass?: number;
}

export interface SpatialObjectState {
  id: string;
  label: string;
  pose: SpatialObjectPose;
  minScale: number;
  maxScale: number;
  collisionRadius: number;
  mass: number;
  grabbed: boolean;
}

interface GrabSession {
  id: string;
  pointerStart: SpatialObjectPoint;
  poseStart: SpatialObjectPose;
}

const DEFAULT_POSE: SpatialObjectPose = {
  position: { x: 0, y: 0, z: 0 },
  scale: 1,
  rotation: 0,
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Number.isFinite(value) ? value : 0));
}

function clonePose(pose: SpatialObjectPose): SpatialObjectPose {
  return {
    position: { ...pose.position },
    scale: pose.scale,
    rotation: pose.rotation,
  };
}

function normalizeRotation(value: number): number {
  let next = value;
  while (next > 180) next -= 360;
  while (next < -180) next += 360;
  return next;
}

function normalizeDefinition(definition: SpatialObjectDefinition): SpatialObjectState {
  const minScale = clamp(Number(definition.minScale ?? 0.72), 0.25, 3);
  const maxScale = clamp(Number(definition.maxScale ?? 1.65), minScale, 4);
  const position = {
    x: clamp(Number(definition.pose?.position?.x ?? 0), -0.48, 0.48),
    y: clamp(Number(definition.pose?.position?.y ?? 0), -0.48, 0.48),
    z: clamp(Number(definition.pose?.position?.z ?? 0), -0.7, 0.7),
  };
  return {
    id: definition.id,
    label: definition.label,
    pose: {
      position,
      scale: clamp(Number(definition.pose?.scale ?? 1), minScale, maxScale),
      rotation: normalizeRotation(Number(definition.pose?.rotation ?? 0)),
    },
    minScale,
    maxScale,
    collisionRadius: clamp(Number(definition.collisionRadius ?? 0.055), 0.018, 0.2),
    mass: clamp(Number(definition.mass ?? 1), 0.15, 8),
    grabbed: false,
  };
}

/**
 * Session-only spatial object manipulation model.
 *
 * Coordinates are normalized interaction-space values, not physical meters.
 * A future WebXR/device adapter can map world-space poses into the same object
 * contract without changing grab/transform semantics.
 */
export class SpatialObjectRuntime {
  private readonly initial: SpatialObjectState[];
  private objects = new Map<string, SpatialObjectState>();
  private grab: GrabSession | null = null;

  constructor(definitions: SpatialObjectDefinition[]) {
    this.initial = definitions.map(normalizeDefinition);
    this.reset();
  }

  snapshot(): SpatialObjectState[] {
    return Array.from(this.objects.values()).map((object) => ({
      ...object,
      pose: clonePose(object.pose),
    }));
  }

  get(id: string): SpatialObjectState | null {
    const object = this.objects.get(id);
    return object ? { ...object, pose: clonePose(object.pose) } : null;
  }

  beginGrab(id: string, pointer: SpatialObjectPoint): SpatialObjectState | null {
    const object = this.objects.get(id);
    if (!object) return null;
    this.clearGrabFlag();

    this.grab = {
      id,
      pointerStart: { ...pointer },
      poseStart: clonePose(object.pose),
    };
    object.grabbed = true;
    return this.get(id);
  }

  moveGrab(
    pointer: SpatialObjectPoint,
    options: { depthDelta?: number; xyGain?: number; depthGain?: number } = {},
  ): SpatialObjectState | null {
    if (!this.grab) return null;
    const object = this.objects.get(this.grab.id);
    if (!object) return null;

    const xyGain = clamp(Number(options.xyGain ?? 1.15), 0.2, 3);
    const depthGain = clamp(Number(options.depthGain ?? 0.55), 0, 2);
    const dx = (pointer.x - this.grab.pointerStart.x) * xyGain;
    const dy = (pointer.y - this.grab.pointerStart.y) * xyGain;
    const explicitDepth = Number(options.depthDelta);
    const dz = Number.isFinite(explicitDepth)
      ? explicitDepth * depthGain
      : (pointer.z - this.grab.pointerStart.z) * depthGain;

    object.pose.position = {
      x: clamp(this.grab.poseStart.position.x + dx, -0.48, 0.48),
      y: clamp(this.grab.poseStart.position.y + dy, -0.48, 0.48),
      z: clamp(this.grab.poseStart.position.z + dz, -0.7, 0.7),
    };
    return this.get(object.id);
  }

  setPose(id: string, pose: SpatialObjectPose): SpatialObjectState | null {
    const object = this.objects.get(id);
    if (!object) return null;
    object.pose = {
      position: {
        x: clamp(Number(pose.position.x || 0), -0.48, 0.48),
        y: clamp(Number(pose.position.y || 0), -0.48, 0.48),
        z: clamp(Number(pose.position.z || 0), -0.7, 0.7),
      },
      scale: clamp(Number(pose.scale || 1), object.minScale, object.maxScale),
      rotation: normalizeRotation(Number(pose.rotation || 0)),
    };
    return this.get(id);
  }

  applyTransform(
    id: string,
    input: { scale?: number; scaleRatio?: number; rotation?: number; rotationDelta?: number },
  ): SpatialObjectState | null {
    const object = this.objects.get(id);
    if (!object) return null;

    const baseScale = Number.isFinite(Number(input.scale))
      ? Number(input.scale)
      : object.pose.scale;
    const scaleRatio = Number.isFinite(Number(input.scaleRatio))
      ? Number(input.scaleRatio)
      : 1;
    const nextScale = clamp(baseScale * scaleRatio, object.minScale, object.maxScale);

    const baseRotation = Number.isFinite(Number(input.rotation))
      ? Number(input.rotation)
      : object.pose.rotation;
    const rotationDelta = Number.isFinite(Number(input.rotationDelta))
      ? Number(input.rotationDelta)
      : 0;

    object.pose.scale = nextScale;
    object.pose.rotation = normalizeRotation(baseRotation + rotationDelta);
    return this.get(id);
  }

  endGrab(): SpatialObjectState | null {
    if (!this.grab) return null;
    const id = this.grab.id;
    const object = this.objects.get(id);
    if (object) object.grabbed = false;
    this.grab = null;
    return this.get(id);
  }

  cancelGrab(): SpatialObjectState | null {
    if (!this.grab) return null;
    const session = this.grab;
    const object = this.objects.get(session.id);
    if (object) {
      object.pose = clonePose(session.poseStart);
      object.grabbed = false;
    }
    this.grab = null;
    return this.get(session.id);
  }

  reset(): SpatialObjectState[] {
    this.objects = new Map(
      this.initial.map((object) => [
        object.id,
        {
          ...object,
          pose: clonePose(object.pose),
          grabbed: false,
        },
      ]),
    );
    this.grab = null;
    return this.snapshot();
  }

  private clearGrabFlag(): void {
    for (const object of this.objects.values()) object.grabbed = false;
  }
}
