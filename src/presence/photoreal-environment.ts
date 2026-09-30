import type { EnvironmentLabel } from '../core/vision/environment-model';
import type { PhotorealVisualQuality } from './photoreal-depth';

export type PhotorealPerformanceTier = 'full' | 'reduced' | 'minimal';

export interface PhotorealEnvironmentInput {
  label: EnvironmentLabel;
  confidence: number;
  attention: number;
  cameraIntensity: number;
  quality: PhotorealVisualQuality;
  performanceTier: PhotorealPerformanceTier;
}

export interface PhotorealEnvironmentFrame {
  warm: number;
  cool: number;
  practicalLight: number;
  windowGlow: number;
  reflection: number;
  haze: number;
  shadow: number;
  dust: number;
  vignette: number;
  cityBokeh: number;
  lightRays: number;
  bedBounce: number;
  edgeOcclusion: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Number.isFinite(value) ? value : 0));
}

function clamp01(value: number): number {
  return clamp(value, 0, 1);
}

const ENVIRONMENT_TONE: Record<EnvironmentLabel, { warm: number; cool: number; practical: number; window: number }> = {
  workspace: { warm: 0.18, cool: 0.34, practical: 0.38, window: 0.3 },
  rest_area: { warm: 0.42, cool: 0.16, practical: 0.55, window: 0.34 },
  living_area: { warm: 0.34, cool: 0.2, practical: 0.48, window: 0.32 },
  dining_area: { warm: 0.38, cool: 0.18, practical: 0.52, window: 0.28 },
  person_nearby: { warm: 0.28, cool: 0.22, practical: 0.4, window: 0.3 },
  mixed: { warm: 0.28, cool: 0.26, practical: 0.42, window: 0.32 },
  unknown: { warm: 0.28, cool: 0.22, practical: 0.44, window: 0.32 },
};

/**
 * Maps the already-inferred camera environment into subtle scene-lighting cues.
 * This is presentation-only and does not claim that the rendered bedroom is the
 * user's physical room.
 */
export function computePhotorealEnvironmentFrame(
  input: PhotorealEnvironmentInput,
): PhotorealEnvironmentFrame {
  const confidence = clamp01(input.confidence);
  const attention = clamp01(input.attention);
  const cameraIntensity = clamp01(input.cameraIntensity);
  const qualityGain = {
    lite: 0.28,
    balanced: 0.62,
    high: 0.82,
    ultra: 1,
  }[input.quality];
  const performanceGain = {
    full: 1,
    reduced: 0.66,
    minimal: 0.32,
  }[input.performanceTier];
  const gain = qualityGain * performanceGain;
  const tone = ENVIRONMENT_TONE[input.label] || ENVIRONMENT_TONE.unknown;
  const evidence = 0.28 + confidence * 0.72;

  return {
    warm: clamp01(tone.warm * evidence * gain),
    cool: clamp01(tone.cool * evidence * gain),
    practicalLight: clamp01((tone.practical + attention * 0.08) * evidence * gain),
    windowGlow: clamp01((tone.window + cameraIntensity * 0.04) * evidence * gain),
    reflection: clamp01((0.24 + attention * 0.08 + cameraIntensity * 0.06) * gain),
    haze: clamp01((0.18 + (1 - confidence) * 0.08) * gain),
    shadow: clamp01((0.42 + cameraIntensity * 0.08) * gain),
    dust: clamp01((0.08 + attention * 0.04) * gain),
    vignette: clamp01((0.22 + (1 - attention) * 0.08) * gain),
    cityBokeh: clamp01((0.18 + tone.window * 0.42 + cameraIntensity * 0.05) * evidence * gain),
    lightRays: clamp01((0.14 + tone.cool * 0.18 + attention * 0.05) * evidence * gain),
    bedBounce: clamp01((0.2 + tone.warm * 0.36 + cameraIntensity * 0.05) * evidence * gain),
    edgeOcclusion: clamp01((0.26 + cameraIntensity * 0.06) * gain),
  };
}

/**
 * Lightweight frame-time governor for visual effects.
 * It never changes perception or interaction quality; it only scales decorative
 * environment rendering after sustained slow/fast frame windows.
 */
export class PhotorealPerformanceGovernor {
  private tier: PhotorealPerformanceTier = 'full';
  private samples: number[] = [];
  private lastTierChangeAt = 0;

  update(frameMs: number, now = performance.now()): PhotorealPerformanceTier {
    const sample = clamp(frameMs, 4, 80);
    this.samples.push(sample);
    if (this.samples.length > 45) this.samples.shift();
    if (this.samples.length < 24) return this.tier;

    const sorted = [...this.samples].sort((a, b) => a - b);
    const p80 = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.8))];
    const mean = this.samples.reduce((sum, value) => sum + value, 0) / this.samples.length;
    const cooldown = now - this.lastTierChangeAt >= 2_000;
    if (!cooldown) return this.tier;

    if (this.tier === 'full' && (p80 > 22 || mean > 19)) {
      this.tier = 'reduced';
      this.lastTierChangeAt = now;
    } else if (this.tier === 'reduced' && (p80 > 28 || mean > 24)) {
      this.tier = 'minimal';
      this.lastTierChangeAt = now;
    } else if (this.tier === 'minimal' && p80 < 19 && mean < 17.5) {
      this.tier = 'reduced';
      this.lastTierChangeAt = now;
    } else if (this.tier === 'reduced' && p80 < 17.8 && mean < 16.8) {
      this.tier = 'full';
      this.lastTierChangeAt = now;
    }

    return this.tier;
  }

  snapshot(): PhotorealPerformanceTier {
    return this.tier;
  }

  reset(): void {
    this.tier = 'full';
    this.samples = [];
    this.lastTierChangeAt = 0;
  }
}


export interface PhotorealEnvironmentControllerInput {
  label: EnvironmentLabel;
  confidence: number;
  attention: number;
  cameraIntensity: number;
  quality: PhotorealVisualQuality;
  reducedMotion: boolean;
}

/**
 * Lazy environment presenter. Keeps frame-governor state, interpolation and DOM
 * custom-property writes out of the initial application chunk.
 */
export class PhotorealEnvironmentController {
  private governor = new PhotorealPerformanceGovernor();
  private current: PhotorealEnvironmentFrame = {
    warm: 0,
    cool: 0,
    practicalLight: 0,
    windowGlow: 0,
    reflection: 0,
    haze: 0,
    shadow: 0,
    dust: 0,
    vignette: 0,
    cityBokeh: 0,
    lightRays: 0,
    bedBounce: 0,
    edgeOcclusion: 0,
  };
  private tier: PhotorealPerformanceTier = 'full';
  private previousFrameAt = 0;

  update(
    input: PhotorealEnvironmentControllerInput,
    node: HTMLElement,
    now = performance.now(),
  ): PhotorealPerformanceTier {
    const frameMs = this.previousFrameAt > 0
      ? clamp(now - this.previousFrameAt, 4, 80)
      : 16.7;
    this.previousFrameAt = now;

    const nextTier = input.reducedMotion
      ? 'minimal'
      : this.governor.update(frameMs, now);
    if (nextTier !== this.tier || node.dataset.performanceTier !== nextTier) {
      this.tier = nextTier;
      node.dataset.performanceTier = nextTier;
    }

    const target = input.reducedMotion
      ? {
          warm: 0, cool: 0, practicalLight: 0, windowGlow: 0, reflection: 0,
          haze: 0, shadow: 0, dust: 0, vignette: 0,
          cityBokeh: 0, lightRays: 0, bedBounce: 0, edgeOcclusion: 0,
        }
      : computePhotorealEnvironmentFrame({
          label: input.label,
          confidence: input.confidence,
          attention: input.attention,
          cameraIntensity: input.cameraIntensity,
          quality: input.quality,
          performanceTier: this.tier,
        });

    const smoothing = input.reducedMotion ? 1 : 0.055;
    for (const key of Object.keys(this.current) as Array<keyof PhotorealEnvironmentFrame>) {
      this.current[key] += (target[key] - this.current[key]) * smoothing;
    }

    node.style.setProperty('--pm-env-warm', this.current.warm.toFixed(3));
    node.style.setProperty('--pm-env-cool', this.current.cool.toFixed(3));
    node.style.setProperty('--pm-env-practical', this.current.practicalLight.toFixed(3));
    node.style.setProperty('--pm-env-window', this.current.windowGlow.toFixed(3));
    node.style.setProperty('--pm-env-reflection', this.current.reflection.toFixed(3));
    node.style.setProperty('--pm-env-haze', this.current.haze.toFixed(3));
    node.style.setProperty('--pm-env-shadow', this.current.shadow.toFixed(3));
    node.style.setProperty('--pm-env-dust', this.current.dust.toFixed(3));
    node.style.setProperty('--pm-env-vignette', this.current.vignette.toFixed(3));
    node.style.setProperty('--pm-env-city-bokeh', this.current.cityBokeh.toFixed(3));
    node.style.setProperty('--pm-env-light-rays', this.current.lightRays.toFixed(3));
    node.style.setProperty('--pm-env-bed-bounce', this.current.bedBounce.toFixed(3));
    node.style.setProperty('--pm-env-edge-occlusion', this.current.edgeOcclusion.toFixed(3));
    return this.tier;
  }

  reset(): void {
    this.governor.reset();
    this.previousFrameAt = 0;
    this.tier = 'full';
    for (const key of Object.keys(this.current) as Array<keyof PhotorealEnvironmentFrame>) {
      this.current[key] = 0;
    }
  }
}
