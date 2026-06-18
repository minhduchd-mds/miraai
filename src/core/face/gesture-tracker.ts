// Điều khiển bằng BÀN TAY qua webcam (MediaPipe GestureRecognizer — cùng @mediapipe/tasks-vision với face).
// FREE, chạy trong trình duyệt, không GPU server. Lazy-load. Xuất handData để App đọc mỗi frame:
//   gesture: 'Open_Palm' | 'Thumb_Up' | 'Victory' | 'Closed_Fist' | 'Pointing_Up' | 'None' ...
//   x,y: tâm bàn tay (chuẩn hoá 0..1, CHƯA soi gương) · wave: đang vẫy tay · present: có tay trong khung.
const WASM_CDN = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm';
const GESTURE_MODEL =
  'https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task';

export interface HandData {
  active: boolean;
  present: boolean;
  gesture: string;
  x: number;
  y: number;
  wave: boolean;
}

export const handData: HandData = { active: false, present: false, gesture: 'None', x: 0.5, y: 0.5, wave: false };

let recognizer: { recognizeForVideo: (v: HTMLVideoElement, t: number) => any; close?: () => void } | null = null;
let video: HTMLVideoElement | null = null;
let stream: MediaStream | null = null;
let raf = 0;
let stopped = true;
let busy = false;
let lastError: string | null = null;

const SMOOTH = 0.4;
const xHist: number[] = []; // lịch sử x tâm tay để phát hiện vẫy

export function gestureTrackerError(): string | null {
  return lastError;
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

function readFrame(): void {
  if (stopped || !recognizer || !video) return;
  let res: any = null;
  try {
    res = recognizer.recognizeForVideo(video, performance.now());
  } catch {
    res = null;
  }
  const lm = res?.landmarks?.[0];
  if (lm && lm.length) {
    handData.present = true;
    handData.gesture = res?.gestures?.[0]?.[0]?.categoryName || 'None';
    const palm = lm[9] || lm[0]; // gốc ngón giữa ~ tâm bàn tay
    handData.x += (palm.x - handData.x) * SMOOTH;
    handData.y += (palm.y - handData.y) * SMOOTH;
    xHist.push(handData.x);
    if (xHist.length > 12) xHist.shift();
    handData.wave = handData.gesture === 'Open_Palm' && detectWave();
  } else {
    handData.present = false;
    handData.gesture = 'None';
    handData.wave = false;
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
    const vision = await import('@mediapipe/tasks-vision');
    const resolver = await vision.FilesetResolver.forVisionTasks(WASM_CDN);
    recognizer = await vision.GestureRecognizer.createFromOptions(resolver, {
      baseOptions: { modelAssetPath: GESTURE_MODEL, delegate: 'GPU' },
      runningMode: 'VIDEO',
      numHands: 1,
    });
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
      audio: false,
    });
    const v = document.createElement('video');
    v.playsInline = true;
    v.muted = true;
    v.srcObject = stream;
    await v.play();
    video = v;
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
  if (stream) {
    stream.getTracks().forEach((t) => t.stop());
    stream = null;
  }
  if (video) {
    video.srcObject = null;
    video = null;
  }
  try {
    recognizer?.close?.();
  } catch {
    /* noop */
  }
  recognizer = null;
  handData.active = false;
  handData.present = false;
  handData.gesture = 'None';
  handData.wave = false;
  xHist.length = 0;
}
