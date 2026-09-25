import { acquireVisionCamera, releaseVisionCamera } from './camera-manager';
import {
  EMPTY_ENVIRONMENT,
  ObjectTemporalTracker,
  inferEnvironment,
  type EnvironmentContext,
  type ObjectObservation,
  type TrackedObject,
} from './environment-model';

const WASM_CDN = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm';
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/object_detector/efficientdet_lite0/int8/1/efficientdet_lite0.tflite';

export type ObjectAwarenessStatus = 'off' | 'loading' | 'tracking' | 'low_signal' | 'error';

export interface ObjectAwarenessData {
  active: boolean;
  status: ObjectAwarenessStatus;
  delegate: 'GPU' | 'CPU' | 'unknown';
  inferenceMs: number;
  intervalMs: number;
  processedFrames: number;
  objects: TrackedObject[];
  environment: EnvironmentContext;
  error: string | null;
}

export const objectAwarenessData: ObjectAwarenessData = {
  active: false,
  status: 'off',
  delegate: 'unknown',
  inferenceMs: 0,
  intervalMs: 950,
  processedFrames: 0,
  objects: [],
  environment: { ...EMPTY_ENVIRONMENT },
  error: null,
};

let detector: { detectForVideo: (video: HTMLVideoElement, timestamp: number) => any; close?: () => void } | null = null;
let video: HTMLVideoElement | null = null;
let raf = 0;
let stopped = true;
let busy = false;
let session = 0;
let lastInferenceAt = 0;
const tracker = new ObjectTemporalTracker();

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

function baseIntervalMs(): number {
  if (typeof navigator === 'undefined') return 950;
  const mobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
  const cores = Number(navigator.hardwareConcurrency || 0);
  if (mobile || (cores > 0 && cores <= 4)) return 1_350;
  if (cores >= 8) return 760;
  return 980;
}

function toObservations(result: any, width: number, height: number): ObjectObservation[] {
  const detections = Array.isArray(result?.detections) ? result.detections : [];
  const output: ObjectObservation[] = [];

  for (const detection of detections) {
    const category = detection?.categories?.[0];
    const box = detection?.boundingBox;
    if (!category || !box || width <= 0 || height <= 0) continue;
    const score = clamp01(Number(category.score || 0));
    const label = String(category.categoryName || category.displayName || '').trim().toLowerCase();
    if (!label || score < 0.36) continue;

    const x = clamp01(Number(box.originX || 0) / width);
    const y = clamp01(Number(box.originY || 0) / height);
    const w = clamp01(Number(box.width || 0) / width);
    const h = clamp01(Number(box.height || 0) / height);
    if (w < 0.02 || h < 0.02) continue;

    output.push({
      label,
      score,
      box: {
        x,
        y,
        width: Math.min(w, 1 - x),
        height: Math.min(h, 1 - y),
      },
    });
  }

  return output.sort((a, b) => b.score - a.score).slice(0, 10);
}

function cadenceFromInference(inferenceMs: number): number {
  const base = baseIntervalMs();
  if (inferenceMs >= 180) return Math.min(1_900, base + inferenceMs * 2.2);
  if (inferenceMs >= 95) return Math.min(1_550, base + inferenceMs * 1.35);
  return base;
}

function readFrame(): void {
  if (stopped || !detector || !video) return;
  const now = performance.now();
  const hidden = typeof document !== 'undefined' && document.hidden;
  const interval = hidden ? Math.max(2_400, objectAwarenessData.intervalMs) : objectAwarenessData.intervalMs;

  if (now - lastInferenceAt < interval) {
    raf = requestAnimationFrame(readFrame);
    return;
  }
  lastInferenceAt = now;

  if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || !video.videoWidth || !video.videoHeight) {
    raf = requestAnimationFrame(readFrame);
    return;
  }

  try {
    const started = performance.now();
    const result = detector.detectForVideo(video, now);
    const inferenceMs = performance.now() - started;
    const observations = toObservations(result, video.videoWidth, video.videoHeight);
    const objects = tracker.update(observations, now);
    const environment = inferEnvironment(objects, now);

    objectAwarenessData.inferenceMs += (inferenceMs - objectAwarenessData.inferenceMs) * 0.28;
    objectAwarenessData.intervalMs = cadenceFromInference(objectAwarenessData.inferenceMs);
    objectAwarenessData.processedFrames += 1;
    objectAwarenessData.objects = objects;
    objectAwarenessData.environment = environment;
    objectAwarenessData.status = objects.some((object) => object.stable) ? 'tracking' : 'low_signal';
    objectAwarenessData.error = null;
  } catch (error) {
    objectAwarenessData.error = error instanceof Error ? error.message : String(error);
    objectAwarenessData.status = 'error';
  }

  raf = requestAnimationFrame(readFrame);
}

async function createDetector(delegate: 'GPU' | 'CPU'): Promise<any> {
  const vision = await import('@mediapipe/tasks-vision');
  const resolver = await vision.FilesetResolver.forVisionTasks(WASM_CDN);
  return vision.ObjectDetector.createFromOptions(resolver, {
    baseOptions: {
      modelAssetPath: MODEL_URL,
      delegate,
    },
    runningMode: 'VIDEO',
    maxResults: 10,
    scoreThreshold: 0.36,
  });
}

export async function startObjectAwareness(): Promise<boolean> {
  if (!stopped) return true;
  if (busy) return false;
  busy = true;
  const thisSession = ++session;
  objectAwarenessData.status = 'loading';
  objectAwarenessData.error = null;

  try {
    let delegate: 'GPU' | 'CPU' = 'GPU';
    try {
      detector = await createDetector('GPU');
    } catch (gpuError) {
      console.warn('[Mira Environment] GPU object detector unavailable; using CPU.', gpuError);
      delegate = 'CPU';
      detector = await createDetector('CPU');
    }

    if (thisSession !== session) {
      try { detector?.close?.(); } catch { /* noop */ }
      detector = null;
      return false;
    }

    video = await acquireVisionCamera('object');
    if (thisSession !== session) {
      releaseVisionCamera('object');
      try { detector?.close?.(); } catch { /* noop */ }
      detector = null;
      video = null;
      return false;
    }

    tracker.reset();
    stopped = false;
    lastInferenceAt = 0;
    objectAwarenessData.active = true;
    objectAwarenessData.status = 'low_signal';
    objectAwarenessData.delegate = delegate;
    objectAwarenessData.intervalMs = baseIntervalMs();
    objectAwarenessData.processedFrames = 0;
    objectAwarenessData.objects = [];
    objectAwarenessData.environment = { ...EMPTY_ENVIRONMENT };
    raf = requestAnimationFrame(readFrame);
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn('[Mira Environment] object awareness unavailable.', message);
    stopObjectAwareness();
    objectAwarenessData.error = message;
    objectAwarenessData.status = 'error';
    return false;
  } finally {
    busy = false;
  }
}

export function stopObjectAwareness(): void {
  session += 1;
  stopped = true;
  cancelAnimationFrame(raf);
  releaseVisionCamera('object');
  video = null;
  try { detector?.close?.(); } catch { /* noop */ }
  detector = null;
  tracker.reset();
  Object.assign(objectAwarenessData, {
    active: false,
    status: 'off',
    delegate: 'unknown',
    inferenceMs: 0,
    intervalMs: baseIntervalMs(),
    processedFrames: 0,
    objects: [],
    environment: { ...EMPTY_ENVIRONMENT },
    error: null,
  });
}

export function objectAwarenessSnapshot(): ObjectAwarenessData {
  return {
    ...objectAwarenessData,
    objects: objectAwarenessData.objects.map((object) => ({ ...object, box: { ...object.box } })),
    environment: { ...objectAwarenessData.environment, evidence: [...objectAwarenessData.environment.evidence] },
  };
}
