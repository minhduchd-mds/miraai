export type VisionQualityTier = 'high' | 'balanced' | 'battery';

export interface VisionPerformanceState {
  engine: 'holistic' | 'legacy';
  delegate: 'GPU' | 'CPU' | 'unknown';
  tier: VisionQualityTier;
  inferenceMs: number;
  intervalMs: number;
  fps: number;
  landmarkCount: number;
  processedFrames: number;
  droppedFrames: number;
}

export const EMPTY_VISION_PERFORMANCE: VisionPerformanceState = {
  engine: 'legacy',
  delegate: 'unknown',
  tier: 'balanced',
  inferenceMs: 0,
  intervalMs: 60,
  fps: 0,
  landmarkCount: 0,
  processedFrames: 0,
  droppedFrames: 0,
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Number.isFinite(value) ? value : min));
}

export function detectVisionTier(): VisionQualityTier {
  if (typeof navigator === 'undefined') return 'balanced';
  const mobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
  const memory = Number((navigator as any).deviceMemory || 0);
  const cores = Number(navigator.hardwareConcurrency || 0);
  if (mobile || (memory > 0 && memory <= 4) || (cores > 0 && cores <= 4)) return 'battery';
  if ((memory >= 8 || memory === 0) && (cores >= 8 || cores === 0)) return 'high';
  return 'balanced';
}

export function baseIntervalForTier(tier: VisionQualityTier): number {
  if (tier === 'high') return 38;
  if (tier === 'battery') return 82;
  return 55;
}

/**
 * Adaptive cadence controller: one heavy holistic model should not monopolize the UI thread.
 * The governor backs off quickly on slow inference and recovers slowly when headroom returns.
 */
export class VisionPerformanceGovernor {
  readonly state: VisionPerformanceState;
  private lastProcessedAt = 0;
  private fpsEma = 0;

  constructor(
    engine: VisionPerformanceState['engine'] = 'holistic',
    delegate: VisionPerformanceState['delegate'] = 'unknown',
    tier: VisionQualityTier = detectVisionTier(),
  ) {
    this.state = {
      ...EMPTY_VISION_PERFORMANCE,
      engine,
      delegate,
      tier,
      intervalMs: baseIntervalForTier(tier),
    };
  }

  shouldProcess(now: number, hidden = false): boolean {
    const interval = hidden ? Math.max(220, this.state.intervalMs) : this.state.intervalMs;
    if (this.lastProcessedAt && now - this.lastProcessedAt < interval) {
      this.state.droppedFrames += 1;
      return false;
    }
    return true;
  }

  noteFrame(now: number, inferenceMs: number, landmarkCount: number): void {
    const previousAt = this.lastProcessedAt;
    this.lastProcessedAt = now;
    const firstProcessedFrame = this.state.processedFrames === 0;
    this.state.processedFrames += 1;
    const measuredInferenceMs = Math.max(0, inferenceMs);
    this.state.inferenceMs = firstProcessedFrame
      ? measuredInferenceMs
      : this.state.inferenceMs + (measuredInferenceMs - this.state.inferenceMs) * 0.22;
    this.state.landmarkCount = Math.max(0, Math.round(landmarkCount));

    if (previousAt > 0 && now > previousAt) {
      const instantFps = 1000 / (now - previousAt);
      this.fpsEma = this.fpsEma ? this.fpsEma * 0.78 + instantFps * 0.22 : instantFps;
      this.state.fps = clamp(this.fpsEma, 0, 60);
    }

    const base = baseIntervalForTier(this.state.tier);
    const loadTarget = Math.max(base, this.state.inferenceMs * 1.28 + 7);
    if (loadTarget > this.state.intervalMs) {
      this.state.intervalMs += (loadTarget - this.state.intervalMs) * 0.34;
    } else {
      this.state.intervalMs += (loadTarget - this.state.intervalMs) * 0.06;
    }
    this.state.intervalMs = clamp(this.state.intervalMs, base, this.state.tier === 'battery' ? 150 : 120);
  }

  setDelegate(delegate: VisionPerformanceState['delegate']): void {
    this.state.delegate = delegate;
  }

  snapshot(): VisionPerformanceState {
    return { ...this.state };
  }
}
