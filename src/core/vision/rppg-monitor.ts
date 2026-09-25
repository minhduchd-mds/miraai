import { faceData } from '../face/face-tracker';
import { acquireVisionCamera, releaseVisionCamera } from './camera-manager';
import { estimatePulseFromSamples, type RGBSample } from './rppg-signal';

export type RppgStatus = 'off' | 'waiting_face' | 'calibrating' | 'tracking' | 'low_signal';

export interface RppgData {
  active: boolean;
  status: RppgStatus;
  bpmTrend: number;
  quality: number;
  relativeActivation: number;
  sampleCount: number;
  signalAgeMs: number;
}

export const rppgData: RppgData = {
  active: false,
  status: 'off',
  bpmTrend: 0,
  quality: 0,
  relativeActivation: 0,
  sampleCount: 0,
  signalAgeMs: 0,
};

const WIDTH = 160;
const HEIGHT = 120;
const MAX_WINDOW_MS = 13_500;

let video: HTMLVideoElement | null = null;
let canvas: HTMLCanvasElement | null = null;
let ctx: CanvasRenderingContext2D | null = null;
let raf = 0;
let stopped = true;
let busy = false;
let lastSampleAt = 0;
let lastReliableAt = 0;
let baselineBpm = 0;
let baselineSamples = 0;
let lastFaceCenter = { x: 0.5, y: 0.5, w: 0.2 };
const samples: RGBSample[] = [];

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

function intervalMs(): number {
  if (typeof navigator === 'undefined') return 75;
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) ? 95 : 70;
}

function faceBox() {
  const points = faceData.landmarks;
  if (!faceData.present || points.length < 100) return null;
  let minX = 1, minY = 1, maxX = 0, maxY = 0;
  for (const p of points) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  const w = maxX - minX;
  const h = maxY - minY;
  if (w < 0.07 || h < 0.09) return null;
  return { x: minX, y: minY, w, h, cx: (minX + maxX) / 2, cy: (minY + maxY) / 2 };
}

function sampleRect(x: number, y: number, w: number, h: number) {
  if (!ctx) return null;
  const sx = Math.max(0, Math.min(WIDTH - 1, Math.round(x * WIDTH)));
  const sy = Math.max(0, Math.min(HEIGHT - 1, Math.round(y * HEIGHT)));
  const sw = Math.max(2, Math.min(WIDTH - sx, Math.round(w * WIDTH)));
  const sh = Math.max(2, Math.min(HEIGHT - sy, Math.round(h * HEIGHT)));
  const data = ctx.getImageData(sx, sy, sw, sh).data;
  let r = 0, g = 0, b = 0, count = 0;
  for (let i = 0; i < data.length; i += 16) {
    r += data[i];
    g += data[i + 1];
    b += data[i + 2];
    count += 1;
  }
  if (!count) return null;
  return { r: r / count, g: g / count, b: b / count };
}

function sampleSkin(box: ReturnType<typeof faceBox>) {
  if (!box) return null;
  const regions = [
    { x: box.x + box.w * 0.34, y: box.y + box.h * 0.08, w: box.w * 0.32, h: box.h * 0.18 },
    { x: box.x + box.w * 0.16, y: box.y + box.h * 0.48, w: box.w * 0.23, h: box.h * 0.2 },
    { x: box.x + box.w * 0.61, y: box.y + box.h * 0.48, w: box.w * 0.23, h: box.h * 0.2 },
  ];
  const colors = regions.map((region) => sampleRect(region.x, region.y, region.w, region.h)).filter(Boolean) as Array<{r:number;g:number;b:number}>;
  if (!colors.length) return null;
  return {
    r: colors.reduce((s, c) => s + c.r, 0) / colors.length,
    g: colors.reduce((s, c) => s + c.g, 0) / colors.length,
    b: colors.reduce((s, c) => s + c.b, 0) / colors.length,
  };
}

function resetWindow(status: RppgStatus): void {
  samples.length = 0;
  rppgData.status = status;
  rppgData.bpmTrend = 0;
  rppgData.quality = 0;
  rppgData.relativeActivation = 0;
  rppgData.sampleCount = 0;
}

function readFrame(now: number): void {
  if (stopped || !video || !ctx || !canvas) return;
  if (now - lastSampleAt < intervalMs()) {
    raf = requestAnimationFrame(readFrame);
    return;
  }
  lastSampleAt = now;

  const box = faceBox();
  if (!box || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
    if (now - lastReliableAt > 1200) resetWindow('waiting_face');
    raf = requestAnimationFrame(readFrame);
    return;
  }

  try {
    ctx.drawImage(video, 0, 0, WIDTH, HEIGHT);
    const color = sampleSkin(box);
    if (!color) {
      raf = requestAnimationFrame(readFrame);
      return;
    }

    const motion = clamp01(
      Math.hypot(box.cx - lastFaceCenter.x, box.cy - lastFaceCenter.y) * 12 +
      Math.abs(box.w - lastFaceCenter.w) * 7,
    );
    lastFaceCenter = { x: box.cx, y: box.cy, w: box.w };
    const brightness = (color.r + color.g + color.b) / (3 * 255);
    // Keep normalized scene brightness; the signal estimator converts this into light quality.
    const illumination = clamp01(brightness);

    samples.push({ t: now, ...color, motion, illumination });
    while (samples.length && now - samples[0].t > MAX_WINDOW_MS) samples.shift();

    const estimate = estimatePulseFromSamples(samples);
    rppgData.sampleCount = samples.length;
    rppgData.signalAgeMs = Math.round(estimate.sampleSpanSec * 1000);
    rppgData.quality += (estimate.quality - rppgData.quality) * 0.26;

    if (estimate.bpm > 0 && estimate.quality >= 0.34) {
      lastReliableAt = now;
      rppgData.bpmTrend = rppgData.bpmTrend
        ? rppgData.bpmTrend * 0.72 + estimate.bpm * 0.28
        : estimate.bpm;
      rppgData.status = estimate.quality >= 0.56 ? 'tracking' : 'low_signal';

      if (estimate.quality >= 0.62) {
        baselineSamples += 1;
        if (!baselineBpm) baselineBpm = rppgData.bpmTrend;
        const rate = baselineSamples < 12 ? 0.12 : 0.015;
        baselineBpm += (rppgData.bpmTrend - baselineBpm) * rate;
      }

      if (baselineBpm > 0 && estimate.quality >= 0.55) {
        rppgData.relativeActivation = Math.max(-1, Math.min(1, (rppgData.bpmTrend - baselineBpm) / 24));
      } else {
        rppgData.relativeActivation *= 0.92;
      }
    } else {
      rppgData.status = samples.length >= 72 ? 'low_signal' : 'calibrating';
      rppgData.relativeActivation *= 0.94;
    }
  } catch {
    rppgData.status = 'low_signal';
  }

  raf = requestAnimationFrame(readFrame);
}

export async function startRppgMonitoring(): Promise<boolean> {
  if (!stopped) return true;
  if (busy) return false;
  busy = true;
  try {
    video = await acquireVisionCamera('rppg');
    canvas = document.createElement('canvas');
    canvas.width = WIDTH;
    canvas.height = HEIGHT;
    ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('Canvas 2D unavailable');
    stopped = false;
    rppgData.active = true;
    rppgData.status = 'calibrating';
    lastSampleAt = 0;
    lastReliableAt = performance.now();
    raf = requestAnimationFrame(readFrame);
    return true;
  } catch (error) {
    console.warn('[Mira rPPG] experimental pulse trend unavailable.', error);
    stopRppgMonitoring();
    return false;
  } finally {
    busy = false;
  }
}

export function stopRppgMonitoring(): void {
  stopped = true;
  cancelAnimationFrame(raf);
  releaseVisionCamera('rppg');
  video = null;
  canvas = null;
  ctx = null;
  samples.length = 0;
  baselineBpm = 0;
  baselineSamples = 0;
  lastFaceCenter = { x: 0.5, y: 0.5, w: 0.2 };
  Object.assign(rppgData, {
    active: false,
    status: 'off',
    bpmTrend: 0,
    quality: 0,
    relativeActivation: 0,
    sampleCount: 0,
    signalAgeMs: 0,
  });
}
