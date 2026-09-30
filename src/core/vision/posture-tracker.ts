import { acquireVisionCamera, releaseVisionCamera } from './camera-manager';
import { isRecoverableGpuDelegateError, visionInferenceErrorMessage } from './vision-delegate-fallback';
import { derivePosture, EMPTY_POSTURE, type PosePoint, type PostureEstimate, type PostureLabel } from './posture-model';

const WASM_CDN = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm';
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';

export interface PostureData extends PostureEstimate {
  active: boolean;
  motion: number;
  landmarks: PosePoint[];
}

export const postureData: PostureData = {
  ...EMPTY_POSTURE,
  active: false,
  motion: 0,
  landmarks: [],
};

let landmarker: { detectForVideo: (v: HTMLVideoElement, t: number) => any; close?: () => void } | null = null;
let video: HTMLVideoElement | null = null;
let raf = 0;
let stopped = true;
let busy = false;
let lastError: string | null = null;
let lastInferenceAt = 0;
let activeDelegate: 'GPU' | 'CPU' | 'unknown' = 'unknown';
let delegateFailoverPromise: Promise<boolean> | null = null;
let consecutiveInferenceFailures = 0;
let previousCenter = { x: 0.5, y: 0.5 };
let motionEma = 0;

function intervalMs(): number {
  if (typeof navigator === 'undefined') return 95;
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) ? 155 : 95;
}

export function postureTrackerError(): string | null {
  return lastError;
}

function clearPose(): void {
  postureData.present = false;
  postureData.label = 'unknown';
  postureData.confidence = 0;
  postureData.upright = 0;
  postureData.slump = 0;
  postureData.lean = 0;
  postureData.shoulderSlope = 0;
  postureData.torsoLength = 0;
  postureData.motion = 0;
  postureData.landmarks = [];
}

async function createPostureLandmarker(delegate: 'GPU' | 'CPU'): Promise<any> {
  const vision = await import('@mediapipe/tasks-vision');
  const resolver = await vision.FilesetResolver.forVisionTasks(WASM_CDN);
  return vision.PoseLandmarker.createFromOptions(resolver, {
    baseOptions: { modelAssetPath: MODEL_URL, delegate },
    runningMode: 'VIDEO',
    numPoses: 1,
    minPoseDetectionConfidence: 0.45,
    minPosePresenceConfidence: 0.45,
    minTrackingConfidence: 0.45,
  } as any);
}

async function fallbackPostureToCpu(reason: unknown): Promise<boolean> {
  if (delegateFailoverPromise) return delegateFailoverPromise;
  delegateFailoverPromise = (async () => {
    const previous = landmarker;
    landmarker = null;
    try { previous?.close?.(); } catch { /* noop */ }
    try {
      const cpu = await createPostureLandmarker('CPU');
      if (stopped) {
        try { cpu?.close?.(); } catch { /* noop */ }
        return false;
      }
      landmarker = cpu;
      activeDelegate = 'CPU';
      consecutiveInferenceFailures = 0;
      lastError = null;
      console.warn('[Mira Posture] GPU inference failed; switched to CPU delegate.', visionInferenceErrorMessage(reason));
      return true;
    } catch (error) {
      lastError = visionInferenceErrorMessage(error);
      return false;
    }
  })().finally(() => {
    delegateFailoverPromise = null;
  });
  return delegateFailoverPromise;
}

function readFrame(): void {
  if (stopped || !video) return;
  if (!landmarker || delegateFailoverPromise) {
    raf = requestAnimationFrame(readFrame);
    return;
  }
  const now = performance.now();
  if (now - lastInferenceAt < intervalMs()) {
    raf = requestAnimationFrame(readFrame);
    return;
  }
  lastInferenceAt = now;

  try {
    const result = landmarker.detectForVideo(video, now);
    consecutiveInferenceFailures = 0;
    const raw = result?.landmarks?.[0];
    if (Array.isArray(raw) && raw.length >= 25) {
      const landmarks: PosePoint[] = raw.slice(0, 33).map((p: any) => ({
        x: Number(p.x || 0),
        y: Number(p.y || 0),
        z: Number(p.z || 0),
        visibility: Number.isFinite(p.visibility) ? Number(p.visibility) : 0.8,
      }));
      const estimate = derivePosture(landmarks);
      const displacement = Math.hypot(estimate.centerX - previousCenter.x, estimate.centerY - previousCenter.y);
      previousCenter = { x: estimate.centerX, y: estimate.centerY };
      motionEma += (Math.min(1, displacement * 16) - motionEma) * 0.3;

      let label: PostureLabel = estimate.label;
      if (estimate.present && motionEma > 0.48) label = 'moving';

      Object.assign(postureData, estimate, {
        active: true,
        label,
        motion: motionEma,
        landmarks,
      });
    } else {
      clearPose();
    }
  } catch (error) {
    clearPose();
    consecutiveInferenceFailures += 1;
    if (
      activeDelegate === 'GPU' &&
      (isRecoverableGpuDelegateError(error) || consecutiveInferenceFailures >= 2)
    ) {
      void fallbackPostureToCpu(error);
    }
  }

  raf = requestAnimationFrame(readFrame);
}

export async function startPostureTracking(): Promise<boolean> {
  if (!stopped) return true;
  if (busy) return false;
  busy = true;
  lastError = null;
  try {
    try {
      landmarker = await createPostureLandmarker('GPU');
      activeDelegate = 'GPU';
    } catch {
      landmarker = await createPostureLandmarker('CPU');
      activeDelegate = 'CPU';
    }
    consecutiveInferenceFailures = 0;

    video = await acquireVisionCamera('pose');
    stopped = false;
    postureData.active = true;
    lastInferenceAt = 0;
    previousCenter = { x: 0.5, y: 0.5 };
    motionEma = 0;
    raf = requestAnimationFrame(readFrame);
    return true;
  } catch (error) {
    lastError = error instanceof Error ? error.message : String(error);
    console.warn('[Mira Posture] pose tracking unavailable.', lastError);
    stopPostureTracking();
    return false;
  } finally {
    busy = false;
  }
}

export function stopPostureTracking(): void {
  stopped = true;
  cancelAnimationFrame(raf);
  releaseVisionCamera('pose');
  video = null;
  try { landmarker?.close?.(); } catch { /* noop */ }
  landmarker = null;
  activeDelegate = 'unknown';
  delegateFailoverPromise = null;
  consecutiveInferenceFailures = 0;
  postureData.active = false;
  clearPose();
  previousCenter = { x: 0.5, y: 0.5 };
  motionEma = 0;
  lastInferenceAt = 0;
}
