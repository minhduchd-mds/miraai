export interface GazeHeadSample {
  facePresent: boolean;
  confidence: number;
  gazeX: number;
  gazeY: number;
  yaw: number;
  pitch: number;
  motion?: number;
}

export interface GazeHeadCalibration {
  samples: number;
  ready: boolean;
  progress: number;
  gazeXCenter: number;
  gazeYCenter: number;
  yawCenter: number;
  pitchCenter: number;
  gazeXSpread: number;
  gazeYSpread: number;
  yawSpread: number;
  pitchSpread: number;
}

export interface CalibratedGazeHead {
  gazeX: number;
  gazeY: number;
  yaw: number;
  pitch: number;
  calibration: GazeHeadCalibration;
}

const STORAGE_KEY = 'mira.vision.gaze-head-calibration.v1';
const READY_SAMPLES = 90;
const MAX_SAMPLES = 20_000;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Number.isFinite(value) ? value : 0));
}

function emptyCalibration(): GazeHeadCalibration {
  return {
    samples: 0,
    ready: false,
    progress: 0,
    gazeXCenter: 0,
    gazeYCenter: 0,
    yawCenter: 0,
    pitchCenter: 0,
    gazeXSpread: 0.12,
    gazeYSpread: 0.12,
    yawSpread: 0.14,
    pitchSpread: 0.12,
  };
}

function loadCalibration(): GazeHeadCalibration {
  try {
    if (typeof localStorage === 'undefined') return emptyCalibration();
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null') as Partial<GazeHeadCalibration> | null;
    if (!parsed || !Number.isFinite(parsed.samples)) return emptyCalibration();
    const samples = clamp(Number(parsed.samples || 0), 0, MAX_SAMPLES);
    return {
      samples,
      ready: samples >= READY_SAMPLES,
      progress: clamp(samples / READY_SAMPLES, 0, 1),
      gazeXCenter: clamp(Number(parsed.gazeXCenter || 0), -0.45, 0.45),
      gazeYCenter: clamp(Number(parsed.gazeYCenter || 0), -0.45, 0.45),
      yawCenter: clamp(Number(parsed.yawCenter || 0), -0.55, 0.55),
      pitchCenter: clamp(Number(parsed.pitchCenter || 0), -0.45, 0.45),
      gazeXSpread: clamp(Number(parsed.gazeXSpread || 0.12), 0.03, 0.5),
      gazeYSpread: clamp(Number(parsed.gazeYSpread || 0.12), 0.03, 0.5),
      yawSpread: clamp(Number(parsed.yawSpread || 0.14), 0.04, 0.65),
      pitchSpread: clamp(Number(parsed.pitchSpread || 0.12), 0.04, 0.55),
    };
  } catch {
    return emptyCalibration();
  }
}

function persistCalibration(profile: GazeHeadCalibration): void {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
  } catch {
    /* calibration is best effort and remains local */
  }
}

function updateMeanAndSpread(
  center: number,
  spread: number,
  value: number,
  rate: number,
): { center: number; spread: number } {
  const delta = value - center;
  const nextCenter = center + delta * rate;
  const absoluteDeviation = Math.abs(value - nextCenter);
  const nextSpread = spread + (absoluteDeviation - spread) * Math.min(0.08, Math.max(0.01, rate * 2));
  return { center: nextCenter, spread: nextSpread };
}

/**
 * Learns the user's normal camera-facing gaze/head center from stable frames.
 * It stores only aggregate numeric offsets locally — never images or identity embeddings.
 */
export class GazeHeadCalibrator {
  private profile = loadCalibration();
  private writes = 0;

  observe(sample: GazeHeadSample): GazeHeadCalibration {
    const stable =
      sample.facePresent &&
      sample.confidence >= 0.55 &&
      Number(sample.motion || 0) <= 0.22 &&
      Math.abs(sample.gazeX) <= 0.48 &&
      Math.abs(sample.gazeY) <= 0.48 &&
      Math.abs(sample.yaw) <= 0.58 &&
      Math.abs(sample.pitch) <= 0.48;

    if (!stable) return this.snapshot();

    const nextSamples = Math.min(MAX_SAMPLES, this.profile.samples + 1);
    const rate = nextSamples <= READY_SAMPLES ? 1 / nextSamples : 0.0025;

    const gx = updateMeanAndSpread(this.profile.gazeXCenter, this.profile.gazeXSpread, sample.gazeX, rate);
    const gy = updateMeanAndSpread(this.profile.gazeYCenter, this.profile.gazeYSpread, sample.gazeY, rate);
    const yaw = updateMeanAndSpread(this.profile.yawCenter, this.profile.yawSpread, sample.yaw, rate);
    const pitch = updateMeanAndSpread(this.profile.pitchCenter, this.profile.pitchSpread, sample.pitch, rate);

    this.profile = {
      samples: nextSamples,
      ready: nextSamples >= READY_SAMPLES,
      progress: clamp(nextSamples / READY_SAMPLES, 0, 1),
      gazeXCenter: clamp(gx.center, -0.45, 0.45),
      gazeYCenter: clamp(gy.center, -0.45, 0.45),
      yawCenter: clamp(yaw.center, -0.55, 0.55),
      pitchCenter: clamp(pitch.center, -0.45, 0.45),
      gazeXSpread: clamp(gx.spread, 0.03, 0.5),
      gazeYSpread: clamp(gy.spread, 0.03, 0.5),
      yawSpread: clamp(yaw.spread, 0.04, 0.65),
      pitchSpread: clamp(pitch.spread, 0.04, 0.55),
    };

    this.writes += 1;
    if (this.writes >= 30) {
      this.writes = 0;
      persistCalibration(this.profile);
    }
    return this.snapshot();
  }

  apply(sample: Pick<GazeHeadSample, 'gazeX' | 'gazeY' | 'yaw' | 'pitch'>): CalibratedGazeHead {
    const readyWeight = this.profile.ready ? 1 : this.profile.progress * 0.65;
    return {
      gazeX: clamp(sample.gazeX - this.profile.gazeXCenter * readyWeight, -1, 1),
      gazeY: clamp(sample.gazeY - this.profile.gazeYCenter * readyWeight, -1, 1),
      yaw: clamp(sample.yaw - this.profile.yawCenter * readyWeight, -1.2, 1.2),
      pitch: clamp(sample.pitch - this.profile.pitchCenter * readyWeight, -1, 1),
      calibration: this.snapshot(),
    };
  }

  snapshot(): GazeHeadCalibration {
    return { ...this.profile };
  }

  reset(): GazeHeadCalibration {
    this.profile = emptyCalibration();
    this.writes = 0;
    try {
      if (typeof localStorage !== 'undefined') localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* noop */
    }
    return this.snapshot();
  }
}
