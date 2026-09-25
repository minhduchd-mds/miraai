export interface RGBSample {
  t: number;
  r: number;
  g: number;
  b: number;
  motion?: number;
  illumination?: number;
}

export interface PulseEstimate {
  bpm: number;
  quality: number;
  spectralProminence: number;
  sampleSpanSec: number;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

function mean(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
}

function std(values: number[]): number {
  const m = mean(values);
  return Math.sqrt(mean(values.map((value) => (value - m) ** 2)));
}

/**
 * Browser-friendly CHROM-style pulse trend estimator.
 * Output is experimental and must not be used for diagnosis or clinical decisions.
 */
export function estimatePulseFromSamples(samples: RGBSample[]): PulseEstimate {
  if (samples.length < 72) return { bpm: 0, quality: 0, spectralProminence: 0, sampleSpanSec: 0 };
  const spanSec = Math.max(0, (samples[samples.length - 1].t - samples[0].t) / 1000);
  if (spanSec < 6.5) return { bpm: 0, quality: 0, spectralProminence: 0, sampleSpanSec: spanSec };

  const rs = samples.map((s) => Math.max(1, s.r));
  const gs = samples.map((s) => Math.max(1, s.g));
  const bs = samples.map((s) => Math.max(1, s.b));
  const mr = mean(rs), mg = mean(gs), mb = mean(bs);

  const x: number[] = [];
  const y: number[] = [];
  for (let i = 0; i < samples.length; i += 1) {
    const rn = rs[i] / mr - 1;
    const gn = gs[i] / mg - 1;
    const bn = bs[i] / mb - 1;
    x.push(3 * rn - 2 * gn);
    y.push(1.5 * rn + gn - 1.5 * bn);
  }

  const alpha = std(x) / Math.max(1e-6, std(y));
  const signal = x.map((value, i) => value - alpha * y[i]);
  const signalMean = mean(signal);
  for (let i = 0; i < signal.length; i += 1) {
    const window = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / Math.max(1, signal.length - 1));
    signal[i] = (signal[i] - signalMean) * window;
  }

  const amplitudes: Array<{ bpm: number; amplitude: number }> = [];
  const t0 = samples[0].t / 1000;
  for (let bpm = 45; bpm <= 180; bpm += 1) {
    const hz = bpm / 60;
    let re = 0;
    let im = 0;
    for (let i = 0; i < signal.length; i += 1) {
      const phase = 2 * Math.PI * hz * (samples[i].t / 1000 - t0);
      re += signal[i] * Math.cos(phase);
      im -= signal[i] * Math.sin(phase);
    }
    amplitudes.push({ bpm, amplitude: Math.hypot(re, im) / signal.length });
  }

  amplitudes.sort((a, b) => b.amplitude - a.amplitude);
  const best = amplitudes[0];
  const competitors = amplitudes.filter((item) => Math.abs(item.bpm - best.bpm) >= 8);
  const second = competitors[0]?.amplitude || 0;
  const averageAmplitude = mean(amplitudes.map((item) => item.amplitude));
  const spectralProminence = clamp01(
    ((best.amplitude / Math.max(1e-8, averageAmplitude)) - 1.2) / 5.2 +
    ((best.amplitude - second) / Math.max(1e-8, best.amplitude)) * 0.32,
  );

  const avgMotion = mean(samples.map((s) => clamp01(s.motion || 0)));
  const avgIllumination = mean(samples.map((s) => Number.isFinite(s.illumination) ? Number(s.illumination) : 0.65));
  const motionQuality = clamp01(1 - avgMotion * 1.6);
  const lightQuality = clamp01(1 - Math.abs(avgIllumination - 0.55) / 0.55);
  const spanQuality = clamp01((spanSec - 6.5) / 4.5);
  const quality = clamp01(spectralProminence * 0.58 + motionQuality * 0.2 + lightQuality * 0.12 + spanQuality * 0.1);

  return {
    bpm: quality >= 0.22 ? best.bpm : 0,
    quality,
    spectralProminence,
    sampleSpanSec: spanSec,
  };
}
