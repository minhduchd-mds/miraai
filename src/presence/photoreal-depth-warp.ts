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