import type { PhotorealVisualQuality } from './photoreal-depth';
import type { PhotorealCameraSpatialFrame } from './photoreal-camera-depth';

export type PhotorealPerformanceTier = 'full' | 'reduced' | 'minimal';

export interface PhotorealDepthWarpControl {
  active: boolean;
  viewX: number;
  viewY: number;
  strength: number;
  fpsCap: number;
}

export interface PhotorealViewRefinementControl {
  active: boolean;
  viewX: number;
  viewY: number;
  warpStrength: number;
  relightStrength: number;
  occlusionStrength: number;
  fpsCap: number;
}

export interface PhotorealWarpSafetyInput {
  edgeStrength: number;
  depthMismatch: number;
  sourceEdgeDistance: number;
  stability: number;
}

/**
 * Continuous authored depth field used by the single-pass scene shader.
 *
 * The values are relative presentation depth only. They are not metric depth,
 * not inferred geometry and are specific to the canonical bedroom composition.
 */
export const PHOTOREAL_DEPTH_FIELD_GLSL = `
float ellipseMask(vec2 uv, vec2 center, vec2 radius, float softness) {
  vec2 p = (uv - center) / max(radius, vec2(0.0001));
  float d = dot(p, p);
  return 1.0 - smoothstep(1.0 - softness, 1.0 + softness, d);
}

float authoredDepth(vec2 uv) {
  float depth = 0.22;

  float windowMask = ellipseMask(uv, vec2(0.80, 0.73), vec2(0.30, 0.30), 0.34);
  depth = mix(depth, 0.14, windowMask * 0.82);

  float pillowMask = ellipseMask(uv, vec2(0.18, 0.62), vec2(0.24, 0.25), 0.36);
  depth = max(depth, pillowMask * 0.38);

  float subjectMask = ellipseMask(uv, vec2(0.50, 0.53), vec2(0.31, 0.40), 0.30);
  depth = max(depth, subjectMask * 0.68);

  float bedDepth = smoothstep(0.38, 0.80, 1.0 - uv.y) * 0.78;
  depth = max(depth, bedDepth);

  float foregroundDepth = smoothstep(0.64, 0.98, 1.0 - uv.y) * 0.94;
  depth = max(depth, foregroundDepth);

  return clamp(depth, 0.12, 0.94);
}
`;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Number.isFinite(value) ? value : 0));
}

export function computePhotorealDepthWarpControl(
  frame: Pick<PhotorealCameraSpatialFrame, 'rotateXDeg' | 'rotateYDeg' | 'intensity'>,
  quality: PhotorealVisualQuality,
  performanceTier: PhotorealPerformanceTier,
  reducedMotion: boolean,
): PhotorealDepthWarpControl {
  const active = !reducedMotion
    && quality === 'ultra'
    && performanceTier === 'full'
    && frame.intensity >= 0.18;

  if (!active) {
    return { active: false, viewX: 0, viewY: 0, strength: 0, fpsCap: 0 };
  }

  const viewX = clamp(frame.rotateYDeg / 3.1, -1, 1);
  const viewY = clamp(-frame.rotateXDeg / 1.9, -1, 1);
  const strength = clamp(frame.intensity, 0, 1);

  return {
    active: true,
    viewX,
    viewY,
    strength,
    fpsCap: 30,
  };
}

/**
 * v28 view refinement layers micro-relighting and edge occlusion on top of the
 * v27 warp. It is still presentation-only and uses the same authored depth
 * field; no normals, geometry or physical light sources are inferred.
 */
export function computePhotorealViewRefinementControl(
  frame: Pick<PhotorealCameraSpatialFrame, 'rotateXDeg' | 'rotateYDeg' | 'intensity'>,
  quality: PhotorealVisualQuality,
  performanceTier: PhotorealPerformanceTier,
  reducedMotion: boolean,
): PhotorealViewRefinementControl {
  const base = computePhotorealDepthWarpControl(
    frame,
    quality,
    performanceTier,
    reducedMotion,
  );

  const fullQuality = !reducedMotion
    && performanceTier === 'full'
    && (quality === 'high' || quality === 'ultra')
    && frame.intensity >= 0.18;

  if (!fullQuality) {
    return {
      active: false,
      viewX: 0,
      viewY: 0,
      warpStrength: 0,
      relightStrength: 0,
      occlusionStrength: 0,
      fpsCap: 0,
    };
  }

  const viewX = clamp(frame.rotateYDeg / 3.1, -1, 1);
  const viewY = clamp(-frame.rotateXDeg / 1.9, -1, 1);
  const intensity = clamp(frame.intensity, 0, 1);
  const ultra = quality === 'ultra';

  return {
    active: true,
    viewX,
    viewY,
    warpStrength: base.active ? base.strength : 0,
    relightStrength: clamp(intensity * (ultra ? 0.22 : 0.12), 0, 0.22),
    occlusionStrength: clamp(intensity * (ultra ? 0.18 : 0.1), 0, 0.18),
    fpsCap: ultra ? 30 : 24,
  };
}


/**
 * Mirrors the v30 shader safety envelope for deterministic tests and tuning.
 *
 * This never invents hidden pixels. It only reduces warp where a static source
 * is likely to stretch or ghost: strong depth boundaries, depth mismatch,
 * source-image edges, or unstable camera motion.
 */
export function computePhotorealWarpSafetyEnvelope(
  input: PhotorealWarpSafetyInput,
): number {
  const edgeStrength = clamp(input.edgeStrength, 0, 1);
  const depthMismatch = clamp(input.depthMismatch, 0, 1);
  const sourceEdgeDistance = clamp(input.sourceEdgeDistance, 0, 0.5);
  const stability = clamp(input.stability, 0, 1);

  const depthBoundaryGuard = 1 - edgeStrength * 0.52;
  const continuityGuard = 1 - clamp((depthMismatch - 0.06) / 0.2, 0, 1) * 0.72;
  const sourceEdgeGuard = clamp((sourceEdgeDistance - 0.004) / 0.028, 0, 1);
  const temporalGuard = 0.42 + stability * 0.58;

  return clamp(
    depthBoundaryGuard * continuityGuard * sourceEdgeGuard * temporalGuard,
    0,
    1,
  );
}
