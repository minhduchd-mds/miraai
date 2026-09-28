import type { SpatialObjectPose } from './spatial-object';

export type SpatialJointKind = 'fixed' | 'hinge' | 'slider';
export type SpatialJointAxis = 'x' | 'y' | 'z';

export interface SpatialJointDefinition {
  id: string;
  kind: SpatialJointKind;
  parentObjectId: string;
  childObjectId: string;
  axis?: SpatialJointAxis;
  min?: number;
  max?: number;
  stiffness?: number;
}

export interface SpatialJointState extends SpatialJointDefinition {
  axis: SpatialJointAxis;
  min: number;
  max: number;
  stiffness: number;
  value: number;
}

export interface SpatialJointConstraintResult {
  jointId: string;
  kind: SpatialJointKind;
  value: number;
  localPose: SpatialObjectPose;
  constrained: boolean;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Number.isFinite(value) ? value : 0));
}

function normalizeRotation(value: number): number {
  let next = Number.isFinite(value) ? value : 0;
  while (next > 180) next -= 360;
  while (next < -180) next += 360;
  return next;
}

function clonePose(pose: SpatialObjectPose): SpatialObjectPose {
  return {
    position: { ...pose.position },
    scale: pose.scale,
    rotation: pose.rotation,
  };
}

function normalizeJoint(definition: SpatialJointDefinition): SpatialJointState {
  const kind = definition.kind;
  const axis = definition.axis || (kind === 'hinge' ? 'z' : 'x');
  const defaultMin = kind === 'hinge' ? -45 : kind === 'slider' ? -0.12 : 0;
  const defaultMax = kind === 'hinge' ? 45 : kind === 'slider' ? 0.12 : 0;
  const min = Number.isFinite(Number(definition.min)) ? Number(definition.min) : defaultMin;
  const max = Number.isFinite(Number(definition.max)) ? Number(definition.max) : defaultMax;
  return {
    ...definition,
    axis,
    min: Math.min(min, max),
    max: Math.max(min, max),
    stiffness: clamp(Number(definition.stiffness ?? 1), 0.05, 1),
    value: 0,
  };
}

/**
 * Session-only constraint state for spatial clusters.
 *
 * Values are interaction-space tuning units. Hinge values are degrees; slider
 * values use normalized interaction coordinates, not physical meters.
 */
export class SpatialJointRuntime {
  private joints = new Map<string, SpatialJointState>();

  setJoint(definition: SpatialJointDefinition): SpatialJointState {
    const joint = normalizeJoint(definition);
    this.joints.set(joint.id, joint);
    return { ...joint };
  }

  get(id: string): SpatialJointState | null {
    const joint = this.joints.get(id);
    return joint ? { ...joint } : null;
  }

  findForChild(childObjectId: string): SpatialJointState | null {
    const joint = Array.from(this.joints.values())
      .find((candidate) => candidate.childObjectId === childObjectId);
    return joint ? { ...joint } : null;
  }

  removeForChild(childObjectId: string): SpatialJointState | null {
    const joint = Array.from(this.joints.values())
      .find((candidate) => candidate.childObjectId === childObjectId);
    if (!joint) return null;
    this.joints.delete(joint.id);
    return { ...joint };
  }

  setValue(id: string, value: number): SpatialJointState | null {
    const joint = this.joints.get(id);
    if (!joint) return null;
    joint.value = clamp(Number(value || 0), joint.min, joint.max);
    return { ...joint };
  }

  constrainLocalPose(
    childObjectId: string,
    baseLocalPose: SpatialObjectPose,
    requestedValue?: number,
  ): SpatialJointConstraintResult | null {
    const joint = Array.from(this.joints.values())
      .find((candidate) => candidate.childObjectId === childObjectId);
    if (!joint) return null;

    if (Number.isFinite(Number(requestedValue))) {
      joint.value = clamp(Number(requestedValue), joint.min, joint.max);
    }

    const localPose = clonePose(baseLocalPose);
    if (joint.kind === 'fixed') {
      joint.value = 0;
      return {
        jointId: joint.id,
        kind: joint.kind,
        value: 0,
        localPose,
        constrained: true,
      };
    }

    if (joint.kind === 'hinge') {
      localPose.rotation = normalizeRotation(baseLocalPose.rotation + joint.value * joint.stiffness);
      return {
        jointId: joint.id,
        kind: joint.kind,
        value: joint.value,
        localPose,
        constrained: true,
      };
    }

    const delta = joint.value * joint.stiffness;
    localPose.position = { ...baseLocalPose.position };
    localPose.position[joint.axis] += delta;
    return {
      jointId: joint.id,
      kind: joint.kind,
      value: joint.value,
      localPose,
      constrained: true,
    };
  }

  snapshot(): SpatialJointState[] {
    return Array.from(this.joints.values()).map((joint) => ({ ...joint }));
  }

  reset(): void {
    this.joints.clear();
  }
}
