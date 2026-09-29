export interface XRMetricManipulationPose {
  objectId: string;
  handDepthM: number;
  environmentDepthM: number | null;
  clearanceM: number;
  depthDeltaM: number;
  normalizedDepthDelta: number;
  visualScaleRatio: number;
  constrainedToSurface: boolean;
  occluded: boolean;
}

interface GrabSession {
  objectId: string;
  startHandDepthM: number;
  startEnvironmentDepthM: number | null;
  clearanceM: number;
  baseScale: number;
  last: XRMetricManipulationPose;
}

const DEFAULT_CLEARANCE_M = 0.03;
const DEPTH_TO_NORMALIZED = 0.82;
const MIN_VISUAL_SCALE = 0.72;
const MAX_VISUAL_SCALE = 1.42;
const SURFACE_SNAP_M = 0.045;
const OCCLUSION_EPSILON_M = 0.018;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Number.isFinite(value) ? value : 0));
}

function finiteDepth(value: number | null | undefined): number | null {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
}

function clonePose(pose: XRMetricManipulationPose): XRMetricManipulationPose {
  return { ...pose };
}

/**
 * Session-only bridge between metric XR hand depth and Mira's normalized DOM
 * spatial object model. Metric values stay metric here; only the returned
 * normalizedDepthDelta crosses into SpatialObjectRuntime.
 */
export class SpatialXRMetricManipulationRuntime {
  private grab: GrabSession | null = null;

  begin(
    objectId: string,
    handDepthM: number,
    baseScale: number,
    environmentDepthM?: number | null,
    clearanceM = DEFAULT_CLEARANCE_M,
  ): XRMetricManipulationPose | null {
    const handDepth = finiteDepth(handDepthM);
    if (!objectId || handDepth == null) return null;
    const environmentDepth = finiteDepth(environmentDepthM);
    const safeClearance = clamp(Number(clearanceM || DEFAULT_CLEARANCE_M), 0.01, 0.12);
    const initial: XRMetricManipulationPose = {
      objectId,
      handDepthM: handDepth,
      environmentDepthM: environmentDepth,
      clearanceM: safeClearance,
      depthDeltaM: 0,
      normalizedDepthDelta: 0,
      visualScaleRatio: 1,
      constrainedToSurface: false,
      occluded: false,
    };
    this.grab = {
      objectId,
      startHandDepthM: handDepth,
      startEnvironmentDepthM: environmentDepth,
      clearanceM: safeClearance,
      baseScale: clamp(Number(baseScale || 1), 0.2, 4),
      last: initial,
    };
    return clonePose(initial);
  }

  update(
    objectId: string,
    handDepthM: number,
    environmentDepthM?: number | null,
    environmentConfidence = 1,
  ): XRMetricManipulationPose | null {
    if (!this.grab || this.grab.objectId !== objectId) return null;
    const handDepth = finiteDepth(handDepthM);
    if (handDepth == null) return clonePose(this.grab.last);

    const environmentDepth = finiteDepth(environmentDepthM);
    const confidence = clamp(Number(environmentConfidence || 0), 0, 1);
    let effectiveDepth = handDepth;
    let constrainedToSurface = false;
    let occluded = false;

    if (environmentDepth != null && confidence >= 0.4) {
      const maximumFrontDepth = Math.max(0.05, environmentDepth - this.grab.clearanceM);
      if (handDepth > maximumFrontDepth) {
        effectiveDepth = maximumFrontDepth;
        constrainedToSurface = true;
      }
      occluded = handDepth > environmentDepth + OCCLUSION_EPSILON_M;

      const surfaceGap = maximumFrontDepth - handDepth;
      if (Math.abs(surfaceGap) <= SURFACE_SNAP_M) {
        const strength = 1 - Math.abs(surfaceGap) / SURFACE_SNAP_M;
        effectiveDepth = handDepth + surfaceGap * strength * strength;
        constrainedToSurface = strength >= 0.45;
      }
    }

    const depthDeltaM = effectiveDepth - this.grab.startHandDepthM;
    const normalizedDepthDelta = clamp(depthDeltaM * DEPTH_TO_NORMALIZED, -0.58, 0.58);
    const visualScaleRatio = clamp(
      this.grab.startHandDepthM / Math.max(0.08, effectiveDepth),
      MIN_VISUAL_SCALE,
      MAX_VISUAL_SCALE,
    );

    this.grab.last = {
      objectId,
      handDepthM: handDepth,
      environmentDepthM: environmentDepth,
      clearanceM: this.grab.clearanceM,
      depthDeltaM,
      normalizedDepthDelta,
      visualScaleRatio,
      constrainedToSurface,
      occluded,
    };
    return clonePose(this.grab.last);
  }

  snapshot(): XRMetricManipulationPose | null {
    return this.grab ? clonePose(this.grab.last) : null;
  }

  end(objectId?: string): XRMetricManipulationPose | null {
    if (!this.grab || (objectId && this.grab.objectId !== objectId)) return null;
    const result = clonePose(this.grab.last);
    this.grab = null;
    return result;
  }

  cancel(): void {
    this.grab = null;
  }
}
