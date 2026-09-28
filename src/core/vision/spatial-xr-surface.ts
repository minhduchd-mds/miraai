export interface XRDepthSample {
  x: number;
  y: number;
  depthM: number;
  valid: boolean;
}

export interface XRDepthViewSample {
  eye: string;
  width: number;
  height: number;
  samples: XRDepthSample[];
}

export interface XRDepthFrameSample {
  available: boolean;
  usage: string;
  dataFormat: string;
  views: XRDepthViewSample[];
  frameAt: number;
}

export interface XRSurfaceProbe {
  x: number;
  y: number;
  handDepthM: number;
  environmentDepthM: number;
  gapM: number;
  confidence: number;
  nearSurface: boolean;
  touchingSurface: boolean;
  behindSurface: boolean;
  occluded: boolean;
}

export interface XRSurfacePatch {
  id: string;
  centerX: number;
  centerY: number;
  depthM: number;
  normalX: number;
  normalY: number;
  normalZ: number;
  confidence: number;
  support: number;
}

const EMPTY_DEPTH: XRDepthFrameSample = {
  available: false,
  usage: '',
  dataFormat: '',
  views: [],
  frameAt: 0,
};

const NEAR_SURFACE_M = 0.08;
const TOUCH_SURFACE_M = 0.028;
const OCCLUSION_EPSILON_M = 0.018;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Number.isFinite(value) ? value : 0));
}

function clamp01(value: number): number {
  return clamp(value, 0, 1);
}

function finiteDepth(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function cloneDepth(input: XRDepthFrameSample): XRDepthFrameSample {
  return {
    ...input,
    views: input.views.map((view) => ({
      ...view,
      samples: view.samples.map((sample) => ({ ...sample })),
    })),
  };
}

export function nearestXRDepth(
  depth: XRDepthFrameSample,
  x: number,
  y: number,
): { depthM: number; confidence: number } | null {
  const valid = depth.views
    .flatMap((view) => view.samples)
    .filter((sample) => sample.valid && sample.depthM > 0);
  if (!valid.length) return null;

  const px = clamp01(x);
  const py = clamp01(y);
  const ranked = valid
    .map((sample) => ({
      sample,
      distance: Math.hypot(sample.x - px, sample.y - py),
    }))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 4);

  let weightSum = 0;
  let depthSum = 0;
  for (const item of ranked) {
    const weight = 1 / Math.max(0.02, item.distance);
    weightSum += weight;
    depthSum += item.sample.depthM * weight;
  }
  if (weightSum <= 0) return null;

  const nearestDistance = ranked[0]?.distance ?? 1;
  return {
    depthM: depthSum / weightSum,
    confidence: clamp01(1 - nearestDistance / 0.32),
  };
}

/**
 * Compares a projected XR hand/object point against the real environment depth.
 * WebXR depth values are distance from the camera plane, not ray length.
 */
export function probeXRSurface(
  depth: XRDepthFrameSample,
  x: number,
  y: number,
  cameraPlaneDepthM: number,
): XRSurfaceProbe | null {
  const environment = nearestXRDepth(depth, x, y);
  const handDepthM = finiteDepth(cameraPlaneDepthM);
  if (!environment || handDepthM <= 0) return null;

  const gapM = environment.depthM - handDepthM;
  const absoluteGap = Math.abs(gapM);
  const behindSurface = gapM < -OCCLUSION_EPSILON_M;

  return {
    x: clamp01(x),
    y: clamp01(y),
    handDepthM,
    environmentDepthM: environment.depthM,
    gapM,
    confidence: environment.confidence,
    nearSurface: gapM >= -OCCLUSION_EPSILON_M && absoluteGap <= NEAR_SURFACE_M,
    touchingSurface: gapM >= -OCCLUSION_EPSILON_M && absoluteGap <= TOUCH_SURFACE_M,
    behindSurface,
    occluded: behindSurface,
  };
}

/**
 * Builds small surface patches from the sparse depth sample lattice.
 * Normals are screen/depth gradients for interaction and occlusion only; they
 * are not a full room mesh or semantic plane reconstruction.
 */
export function reconstructXRSurfacePatches(
  depth: XRDepthFrameSample,
  maxPatches = 25,
): XRSurfacePatch[] {
  const samples = depth.views
    .flatMap((view) => view.samples)
    .filter((sample) => sample.valid && sample.depthM > 0);
  if (samples.length < 3) return [];

  const unique = new Map<string, XRDepthSample>();
  for (const sample of samples) {
    const key = `${sample.x.toFixed(3)}:${sample.y.toFixed(3)}`;
    if (!unique.has(key)) unique.set(key, sample);
  }
  const points = [...unique.values()];

  return points.slice(0, Math.max(1, maxPatches)).map((center, index) => {
    const neighbors = points
      .filter((sample) => sample !== center)
      .map((sample) => ({
        sample,
        distance: Math.hypot(sample.x - center.x, sample.y - center.y),
      }))
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 4);

    let dx = 0;
    let dy = 0;
    let wx = 0;
    let wy = 0;
    for (const neighbor of neighbors) {
      const sx = neighbor.sample.x - center.x;
      const sy = neighbor.sample.y - center.y;
      const dz = neighbor.sample.depthM - center.depthM;
      if (Math.abs(sx) > 1e-4) {
        const weight = 1 / Math.max(0.02, Math.abs(sx));
        dx += (dz / sx) * weight;
        wx += weight;
      }
      if (Math.abs(sy) > 1e-4) {
        const weight = 1 / Math.max(0.02, Math.abs(sy));
        dy += (dz / sy) * weight;
        wy += weight;
      }
    }
    const gx = wx > 0 ? dx / wx : 0;
    const gy = wy > 0 ? dy / wy : 0;
    const length = Math.hypot(gx, gy, 1);
    const support = neighbors.length;

    return {
      id: `depth.patch.${index}`,
      centerX: center.x,
      centerY: center.y,
      depthM: center.depthM,
      normalX: -gx / length,
      normalY: -gy / length,
      normalZ: 1 / length,
      confidence: clamp01((support / 4) * 0.6 + 0.4),
      support,
    };
  });
}

export class SpatialXRSurfaceRuntime {
  private depth: XRDepthFrameSample = cloneDepth(EMPTY_DEPTH);
  private patches: XRSurfacePatch[] = [];

  update(depth: XRDepthFrameSample): XRSurfacePatch[] {
    this.depth = cloneDepth(depth);
    this.patches = reconstructXRSurfacePatches(this.depth);
    return this.snapshotPatches();
  }

  probe(x: number, y: number, cameraPlaneDepthM: number): XRSurfaceProbe | null {
    return probeXRSurface(this.depth, x, y, cameraPlaneDepthM);
  }

  snapshotDepth(): XRDepthFrameSample {
    return cloneDepth(this.depth);
  }

  snapshotPatches(): XRSurfacePatch[] {
    return this.patches.map((patch) => ({ ...patch }));
  }

  reset(): void {
    this.depth = cloneDepth(EMPTY_DEPTH);
    this.patches = [];
  }
}
