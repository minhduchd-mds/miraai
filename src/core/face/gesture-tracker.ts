import { acquireVisionCamera, releaseVisionCamera } from '../vision/camera-manager';
import { isRecoverableGpuDelegateError, visionInferenceErrorMessage } from '../vision/vision-delegate-fallback';

// Điều khiển bằng BÀN TAY qua webcam (MediaPipe GestureRecognizer — cùng @mediapipe/tasks-vision với face).
// FREE, chạy trong trình duyệt, không GPU server. Lazy-load. Xuất handData để App đọc mỗi frame:
//   gesture: 'Open_Palm' | 'Thumb_Up' | 'Victory' | 'Closed_Fist' | 'Pointing_Up' | 'None' ...
//   x,y: tâm bàn tay (chuẩn hoá 0..1, CHƯA soi gương) · wave: đang vẫy tay · present: có tay trong khung.
const WASM_CDN = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm';
const GESTURE_MODEL =
  'https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task';

export interface TrackedHand {
  handedness: string;
  gesture: string;
  score: number;
  x: number;
  y: number;
  pinching: boolean;
  pinchRatio: number;
  landmarks: Array<{ x: number; y: number; z?: number }>;
  worldLandmarks: Array<{ x: number; y: number; z?: number }>;
}

export interface HandData {
  active: boolean;
  present: boolean;
  gesture: string;
  x: number;
  y: number;
  wave: boolean;
  score: number;
  landmarks: Array<{ x: number; y: number; z?: number }>;
  hands: TrackedHand[];
  /** Monotonic time of latest completed inference. */
  lastFrameAt: number;
}

export const handData: HandData = {
  active: false,
  present: false,
  gesture: 'None',
  x: 0.5,
  y: 0.5,
  wave: false,
  score: 0,
  landmarks: [],
  hands: [],
  lastFrameAt: 0,
};

let recognizer: { recognizeForVideo: (v: HTMLVideoElement, t: number) => any; close?: () => void } | null = null;
let video: HTMLVideoElement | null = null;
let raf = 0;
let stopped = true;
let busy = false;
let lastError: string | null = null;
let lastInferenceAt = 0;
let activeDelegate: 'GPU' | 'CPU' | 'unknown' = 'unknown';
let delegateFailoverPromise: Promise<boolean> | null = null;
let consecutiveInferenceFailures = 0;

const SMOOTH = 0.4;
const MOBILE_INFERENCE_MS = 42;
const DESKTOP_INFERENCE_MS = 30;

function inferenceIntervalMs(): number {
  if (typeof navigator === 'undefined') return DESKTOP_INFERENCE_MS;
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)
    ? MOBILE_INFERENCE_MS
    : DESKTOP_INFERENCE_MS;
}
const xHist: number[] = []; // lịch sử x tâm tay để phát hiện vẫy

export function gestureTrackerError(): string | null {
  return lastError;
}

function normalizedPinchRatio(
  landmarks: Array<{ x: number; y: number; z?: number }>,
): number {
  if (landmarks.length < 21) return 1;
  const indexTip = landmarks[8];
  const thumbTip = landmarks[4];
  const indexMcp = landmarks[5];
  const pinkyMcp = landmarks[17];
  const palmSpan = Math.max(1e-5, Math.hypot(
    indexMcp.x - pinkyMcp.x,
    indexMcp.y - pinkyMcp.y,
    Number(indexMcp.z || 0) - Number(pinkyMcp.z || 0),
  ));
  const pinch = Math.hypot(
    indexTip.x - thumbTip.x,
    indexTip.y - thumbTip.y,
    Number(indexTip.z || 0) - Number(thumbTip.z || 0),
  );
  return pinch / palmSpan;
}

function detectWave(): boolean {
  if (xHist.length < 6) return false;
  let reversals = 0;
  let min = 1;
  let max = 0;
  for (let i = 1; i < xHist.length; i++) {
    min = Math.min(min, xHist[i]);
    max = Math.max(max, xHist[i]);
    if (i >= 2) {
      const d1 = xHist[i] - xHist[i - 1];
      const d2 = xHist[i - 1] - xHist[i - 2];
      if (d1 * d2 < 0 && Math.abs(d1) > 0.012) reversals++;
    }
  }
  return reversals >= 3 && max - min > 0.1; // tay lia qua lại nhiều lần + biên độ đủ rộng
}

async function createGestureRecognizer(delegate: 'GPU' | 'CPU'): Promise<any> {
  const vision = await import('@mediapipe/tasks-vision');
  const resolver = await vision.FilesetResolver.forVisionTasks(WASM_CDN);
  return vision.GestureRecognizer.createFromOptions(resolver, {
    baseOptions: { modelAssetPath: GESTURE_MODEL, delegate },
    runningMode: 'VIDEO',
    numHands: 2,
  });
}

async function fallbackGestureToCpu(reason: unknown): Promise<boolean> {
  if (delegateFailoverPromise) return delegateFailoverPromise;
  delegateFailoverPromise = (async () => {
    const previous = recognizer;
    recognizer = null;
    try { previous?.close?.(); } catch { /* noop */ }
    try {
      const cpu = await createGestureRecognizer('CPU');
      if (stopped) {
        try { cpu?.close?.(); } catch { /* noop */ }
        return false;
      }
      recognizer = cpu;
      activeDelegate = 'CPU';
      consecutiveInferenceFailures = 0;
      lastError = null;
      console.warn('[Mira Hand] GPU inference failed; switched to CPU delegate.', visionInferenceErrorMessage(reason));
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
  if (!recognizer || delegateFailoverPromise) {
    raf = requestAnimationFrame(readFrame);
    return;
  }

  const now = performance.now();
  if (now - lastInferenceAt < inferenceIntervalMs()) {
    raf = requestAnimationFrame(readFrame);
    return;
  }
  lastInferenceAt = now;

  let res: any = null;
  try {
    res = recognizer.recognizeForVideo(video, now);
    consecutiveInferenceFailures = 0;
  } catch (error) {
    res = null;
    consecutiveInferenceFailures += 1;
    if (
      activeDelegate === 'GPU' &&
      (isRecoverableGpuDelegateError(error) || consecutiveInferenceFailures >= 2)
    ) {
      void fallbackGestureToCpu(error);
    }
  }

  handData.lastFrameAt = res ? now : 0;
  const allLandmarks = Array.isArray(res?.landmarks) ? res.landmarks.slice(0, 2) : [];
  const allWorldLandmarks = Array.isArray(res?.worldLandmarks) ? res.worldLandmarks.slice(0, 2) : [];
  const hands: TrackedHand[] = allLandmarks
    .map((lm: any[], index: number) => {
      if (!lm?.length) return null;
      const landmarks = lm.slice(0, 21).map((point: { x: number; y: number; z?: number }) => ({
        x: Number(point.x),
        y: Number(point.y),
        z: Number(point.z || 0),
      }));
      const worldLandmarks = Array.isArray(allWorldLandmarks[index])
        ? allWorldLandmarks[index].slice(0, 21).map((point: { x: number; y: number; z?: number }) => ({
            x: Number(point.x),
            y: Number(point.y),
            z: Number(point.z || 0),
          }))
        : [];
      const palm = lm[9] || lm[0];
      const gesture = res?.gestures?.[index]?.[0]?.categoryName || 'None';
      const score = Number(res?.gestures?.[index]?.[0]?.score || 0);
      const handed = res?.handednesses?.[index]?.[0] || res?.handedness?.[index]?.[0];
      const shapeLandmarks = worldLandmarks.length >= 21 ? worldLandmarks : landmarks;
      const pinchRatio = normalizedPinchRatio(shapeLandmarks);
      return {
        handedness: String(handed?.categoryName || handed?.displayName || `Hand ${index + 1}`),
        gesture,
        score,
        x: Number(palm.x),
        y: Number(palm.y),
        pinching: pinchRatio <= 0.52,
        pinchRatio,
        landmarks,
        worldLandmarks,
      } satisfies TrackedHand;
    })
    .filter(Boolean) as TrackedHand[];

  handData.hands = hands;
  const primary = hands.find((hand) => hand.handedness === 'Right') || hands[0];

  if (primary) {
    handData.present = true;
    handData.gesture = primary.gesture;
    handData.score = primary.score;
    handData.landmarks = primary.landmarks;
    handData.x += (primary.x - handData.x) * SMOOTH;
    handData.y += (primary.y - handData.y) * SMOOTH;
    xHist.push(handData.x);
    if (xHist.length > 12) xHist.shift();
    handData.wave = handData.gesture === 'Open_Palm' && detectWave();
  } else {
    handData.present = false;
    handData.gesture = 'None';
    handData.wave = false;
    handData.score = 0;
    handData.landmarks = [];
    if (xHist.length) xHist.length = 0;
  }

  raf = requestAnimationFrame(readFrame);
}

export async function startGestureTracking(): Promise<boolean> {
  if (!stopped) return true;
  if (busy) return false;
  busy = true;
  lastError = null;
  try {
    try {
      recognizer = await createGestureRecognizer('GPU');
      activeDelegate = 'GPU';
    } catch {
      recognizer = await createGestureRecognizer('CPU');
      activeDelegate = 'CPU';
    }
    consecutiveInferenceFailures = 0;
    video = await acquireVisionCamera('gesture');
    stopped = false;
    handData.active = true;
    raf = requestAnimationFrame(readFrame);
    return true;
  } catch (e) {
    lastError = e instanceof Error ? e.message : String(e);
    console.warn('[Mira Hand] không bật được camera/gesture.', lastError);
    stopGestureTracking();
    return false;
  } finally {
    busy = false;
  }
}

export function stopGestureTracking(): void {
  stopped = true;
  cancelAnimationFrame(raf);
  releaseVisionCamera('gesture');
  video = null;
  try {
    recognizer?.close?.();
  } catch {
    /* noop */
  }
  recognizer = null;
  activeDelegate = 'unknown';
  delegateFailoverPromise = null;
  consecutiveInferenceFailures = 0;
  handData.active = false;
  handData.present = false;
  handData.gesture = 'None';
  handData.wave = false;
  handData.score = 0;
  handData.landmarks = [];
  handData.hands = [];
  handData.lastFrameAt = 0;
  lastInferenceAt = 0;
  xHist.length = 0;
}
