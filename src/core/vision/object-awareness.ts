import { acquireVisionCamera, releaseVisionCamera } from './camera-manager';
import {
  EMPTY_ENVIRONMENT,
  ObjectTemporalTracker,
  inferEnvironment,
  type EnvironmentContext,
  type ObjectObservation,
  type TrackedObject,
} from './environment-model';
import { holisticPerformanceSnapshot } from './holistic-tracker';
import {
  OnnxAcceleratorLab,
  acceleratorComparisonEnabled,
  acceleratorLabEnabled,
  type AcceleratorComparison,
  type AcceleratorPrediction,
} from './onnx-accelerator-lab';
import type { AcceleratorProvider } from './accelerator-selection';

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
  scheduler: 'video-frame' | 'animation-frame';
  primaryPressureMs: number;
  objects: TrackedObject[];
  environment: EnvironmentContext;
  accelerator: {
    enabled: boolean;
    status: 'off' | 'loading' | 'ready' | 'running' | 'error';
    provider: AcceleratorProvider | null;
    runtimeVersion: string;
    model: string;
    loadMs: number;
    preprocessMs: number;
    inferenceMs: number;
    endToEndMs: number;
    label: string;
    confidence: number;
    benchmark: AcceleratorComparison | null;
    error: string | null;
  };
  error: string | null;
}

export const objectAwarenessData: ObjectAwarenessData = {
  active: false,
  status: 'off',
  delegate: 'unknown',
  inferenceMs: 0,
  intervalMs: 950,
  processedFrames: 0,
  scheduler: 'animation-frame',
  primaryPressureMs: 0,
  objects: [],
  environment: { ...EMPTY_ENVIRONMENT },
  accelerator: {
    enabled: false,
    status: 'off',
    provider: null,
    runtimeVersion: '1.30.0',
    model: 'squeezenet1.1-7',
    loadMs: 0,
    preprocessMs: 0,
    inferenceMs: 0,
    endToEndMs: 0,
    label: '',
    confidence: 0,
    benchmark: null,
    error: null,
  },
  error: null,
};

let detector: { detectForVideo: (video: HTMLVideoElement, timestamp: number) => any; close?: () => void } | null = null;
let video: HTMLVideoElement | null = null;
let frameRequestId = 0;
let timerId = 0;
let frameScheduler: 'video-frame' | 'animation-frame' = 'animation-frame';
let stopped = true;
let busy = false;
let session = 0;
let lastInferenceAt = 0;
const tracker = new ObjectTemporalTracker();
const acceleratorLab = new OnnxAcceleratorLab();
let acceleratorTimerId = 0;
let acceleratorBusy = false;

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

function cadenceFromInference(inferenceMs: number, primaryPressureMs = 0): number {
  const base = baseIntervalMs();
  const primaryPenalty = primaryPressureMs >= 55 ? 620 : primaryPressureMs >= 36 ? 320 : 0;
  if (inferenceMs >= 180) return Math.min(2_300, base + inferenceMs * 2.2 + primaryPenalty);
  if (inferenceMs >= 95) return Math.min(1_900, base + inferenceMs * 1.35 + primaryPenalty);
  return Math.min(1_700, base + primaryPenalty);
}

function cancelFrameSchedule(): void {
  if (timerId && typeof window !== 'undefined') window.clearTimeout(timerId);
  timerId = 0;

  if (!frameRequestId) return;
  const frameVideo = video as (HTMLVideoElement & {
    cancelVideoFrameCallback?: (id: number) => void;
  }) | null;
  if (frameScheduler === 'video-frame' && typeof frameVideo?.cancelVideoFrameCallback === 'function') {
    frameVideo.cancelVideoFrameCallback(frameRequestId);
  } else {
    cancelAnimationFrame(frameRequestId);
  }
  frameRequestId = 0;
}

function scheduleReadFrame(delayMs = 0): void {
  if (stopped || !video) return;

  if (delayMs > 18 && typeof window !== 'undefined') {
    timerId = window.setTimeout(() => {
      timerId = 0;
      scheduleReadFrame(0);
    }, Math.min(2_500, Math.max(0, delayMs)));
    return;
  }

  const frameVideo = video as HTMLVideoElement & {
    requestVideoFrameCallback?: (
      callback: (now: number, metadata: { expectedDisplayTime?: number }) => void,
    ) => number;
  };

  if (typeof frameVideo.requestVideoFrameCallback === 'function') {
    frameScheduler = 'video-frame';
    objectAwarenessData.scheduler = 'video-frame';
    frameRequestId = frameVideo.requestVideoFrameCallback((now) => readFrame(now));
    return;
  }

  frameScheduler = 'animation-frame';
  objectAwarenessData.scheduler = 'animation-frame';
  frameRequestId = requestAnimationFrame((now) => readFrame(now));
}

function readFrame(callbackNow = performance.now()): void {
  if (stopped || !detector || !video) return;
  const now = Number.isFinite(callbackNow) ? callbackNow : performance.now();
  const hidden = typeof document !== 'undefined' && document.hidden;
  const interval = hidden ? Math.max(2_400, objectAwarenessData.intervalMs) : objectAwarenessData.intervalMs;
  const elapsed = Math.max(0, now - lastInferenceAt);

  if (elapsed < interval) {
    scheduleReadFrame(interval - elapsed);
    return;
  }

  if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || !video.videoWidth || !video.videoHeight) {
    scheduleReadFrame(80);
    return;
  }

  lastInferenceAt = now;

  try {
    const started = performance.now();
    const result = detector.detectForVideo(video, now);
    const inferenceMs = performance.now() - started;
    const observations = toObservations(result, video.videoWidth, video.videoHeight);
    const objects = tracker.update(observations, now);
    const environment = inferEnvironment(objects, now);
    const primary = holisticPerformanceSnapshot();
    const primaryPressureMs = Math.max(0, primary.inferenceMs + primary.postprocessMs);

    objectAwarenessData.inferenceMs += (inferenceMs - objectAwarenessData.inferenceMs) * 0.28;
    objectAwarenessData.primaryPressureMs +=
      (primaryPressureMs - objectAwarenessData.primaryPressureMs) * 0.24;
    objectAwarenessData.intervalMs = cadenceFromInference(
      objectAwarenessData.inferenceMs,
      objectAwarenessData.primaryPressureMs,
    );
    objectAwarenessData.processedFrames += 1;
    objectAwarenessData.objects = objects;
    objectAwarenessData.environment = environment;
    objectAwarenessData.status = objects.some((object) => object.stable) ? 'tracking' : 'low_signal';
    objectAwarenessData.error = null;
  } catch (error) {
    objectAwarenessData.error = error instanceof Error ? error.message : String(error);
    objectAwarenessData.status = 'error';
  }

  scheduleReadFrame(objectAwarenessData.intervalMs);
}

function clearAcceleratorTimer(): void {
  if (acceleratorTimerId && typeof window !== 'undefined') window.clearTimeout(acceleratorTimerId);
  acceleratorTimerId = 0;
}

function resetAcceleratorState(enabled = acceleratorLabEnabled()): void {
  Object.assign(objectAwarenessData.accelerator, {
    enabled,
    status: enabled ? 'loading' : 'off',
    provider: null,
    runtimeVersion: '1.30.0',
    model: 'squeezenet1.1-7',
    loadMs: 0,
    preprocessMs: 0,
    inferenceMs: 0,
    endToEndMs: 0,
    label: '',
    confidence: 0,
    benchmark: null,
    error: null,
  });
}

function applyAcceleratorPrediction(prediction: AcceleratorPrediction): void {
  Object.assign(objectAwarenessData.accelerator, {
    status: 'ready',
    provider: prediction.provider,
    preprocessMs: prediction.preprocessMs,
    inferenceMs: prediction.inferenceMs,
    endToEndMs: prediction.endToEndMs,
    label: prediction.label,
    confidence: prediction.confidence,
    error: null,
  });
}

function scheduleAcceleratorCycle(currentSession: number, delayMs = 2_500): void {
  clearAcceleratorTimer();
  if (!objectAwarenessData.accelerator.enabled || stopped || currentSession !== session) return;
  if (typeof window === 'undefined') return;
  acceleratorTimerId = window.setTimeout(() => {
    acceleratorTimerId = 0;
    void runAcceleratorCycle(currentSession);
  }, Math.max(250, delayMs));
}

async function runAcceleratorCycle(currentSession: number): Promise<void> {
  if (
    acceleratorBusy ||
    stopped ||
    currentSession !== session ||
    !video ||
    !objectAwarenessData.accelerator.enabled
  ) return;

  if (typeof document !== 'undefined' && document.hidden) {
    scheduleAcceleratorCycle(currentSession, 8_000);
    return;
  }

  acceleratorBusy = true;
  objectAwarenessData.accelerator.status = 'running';
  try {
    if (acceleratorComparisonEnabled() && !objectAwarenessData.accelerator.benchmark) {
      const benchmark = await acceleratorLab.compare(video, 3);
      if (currentSession !== session || stopped) return;
      objectAwarenessData.accelerator.benchmark = benchmark;
      objectAwarenessData.accelerator.provider = benchmark.selected;
    }

    let provider = objectAwarenessData.accelerator.provider;
    if (!provider) provider = await acceleratorLab.openBest();
    if (currentSession !== session || stopped) return;

    const runtime = acceleratorLab.snapshot();
    objectAwarenessData.accelerator.provider = provider;
    objectAwarenessData.accelerator.loadMs = runtime.loadMs;
    const prediction = await acceleratorLab.predict(video, provider);
    if (currentSession !== session || stopped) return;
    applyAcceleratorPrediction(prediction);
    scheduleAcceleratorCycle(currentSession, 8_000);
  } catch (error) {
    if (currentSession !== session || stopped) return;
    objectAwarenessData.accelerator.status = 'error';
    objectAwarenessData.accelerator.error = error instanceof Error ? error.message : String(error);
    acceleratorLab.close();
    scheduleAcceleratorCycle(currentSession, 30_000);
  } finally {
    acceleratorBusy = false;
  }
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
    objectAwarenessData.scheduler = 'animation-frame';
    objectAwarenessData.primaryPressureMs = 0;
    objectAwarenessData.objects = [];
    objectAwarenessData.environment = { ...EMPTY_ENVIRONMENT };
    resetAcceleratorState(acceleratorLabEnabled());
    scheduleReadFrame(0);
    if (objectAwarenessData.accelerator.enabled) scheduleAcceleratorCycle(thisSession);
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
  cancelFrameSchedule();
  clearAcceleratorTimer();
  acceleratorBusy = false;
  acceleratorLab.close();
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
    scheduler: 'animation-frame',
    primaryPressureMs: 0,
    objects: [],
    environment: { ...EMPTY_ENVIRONMENT },
    accelerator: {
      enabled: false,
      status: 'off',
      provider: null,
      runtimeVersion: '1.30.0',
      model: 'squeezenet1.1-7',
      loadMs: 0,
      preprocessMs: 0,
      inferenceMs: 0,
      endToEndMs: 0,
      label: '',
      confidence: 0,
      benchmark: null,
      error: null,
    },
    error: null,
  });
}

export function objectAwarenessSnapshot(): ObjectAwarenessData {
  return {
    ...objectAwarenessData,
    objects: objectAwarenessData.objects.map((object) => ({ ...object, box: { ...object.box } })),
    environment: { ...objectAwarenessData.environment, evidence: [...objectAwarenessData.environment.evidence] },
    accelerator: {
      ...objectAwarenessData.accelerator,
      benchmark: objectAwarenessData.accelerator.benchmark
        ? {
            ...objectAwarenessData.accelerator.benchmark,
            summaries: objectAwarenessData.accelerator.benchmark.summaries.map((item) => ({ ...item })),
          }
        : null,
    },
  };
}
