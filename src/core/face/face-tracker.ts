import * as THREE from 'three';

// Face-tracking ETHICAL (KHÔNG deepfake): đọc webcam bằng MediaPipe FaceLandmarker →
// lái VRM của Mira theo đầu + biểu cảm của bạn (gương). Lazy-load (không vào bundle chính),
// chạy cả desktop lẫn iPhone Safari (cần HTTPS + cử chỉ người dùng để mở camera). Lỗi/từ chối
// camera → available=false, avatar quay về nhìn theo chuột. Đọc faceData ở VRMAvatar mỗi frame.

const WASM_CDN = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm';
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';

export interface FaceData {
  active: boolean; // tracker đang bật
  present: boolean; // có khuôn mặt trong khung hình
  yaw: number; // rad, đã làm mượt (đầu quay trái/phải)
  pitch: number; // rad (gật)
  roll: number; // rad (nghiêng)
  jaw: number; // 0..1 há miệng
  blinkL: number; // 0..1
  blinkR: number; // 0..1
  smile: number; // 0..1
  browUp: number; // 0..1 nhướng mày
}

export const faceData: FaceData = {
  active: false,
  present: false,
  yaw: 0,
  pitch: 0,
  roll: 0,
  jaw: 0,
  blinkL: 0,
  blinkR: 0,
  smile: 0,
  browUp: 0,
};

let landmarker: { detectForVideo: (v: HTMLVideoElement, t: number) => any; close?: () => void } | null = null;
let video: HTMLVideoElement | null = null;
let stream: MediaStream | null = null;
let raf = 0;
let stopped = true;
let busy = false;
let lastError: string | null = null;

export function faceTrackerError(): string | null {
  return lastError;
}
export function faceTrackerActive(): boolean {
  return !stopped;
}

const _m = new THREE.Matrix4();
const _e = new THREE.Euler();
const SMOOTH = 0.45;

function readFrame(): void {
  if (stopped || !landmarker || !video) return;
  let res: any = null;
  try {
    res = landmarker.detectForVideo(video, performance.now());
  } catch {
    res = null;
  }
  const cats = res?.faceBlendshapes?.[0]?.categories;
  if (cats && cats.length) {
    faceData.present = true;
    const bs: Record<string, number> = {};
    for (const c of cats) bs[c.categoryName] = c.score;
    faceData.jaw += ((bs.jawOpen || 0) - faceData.jaw) * SMOOTH;
    faceData.blinkL += ((bs.eyeBlinkLeft || 0) - faceData.blinkL) * SMOOTH;
    faceData.blinkR += ((bs.eyeBlinkRight || 0) - faceData.blinkR) * SMOOTH;
    faceData.smile +=
      (((bs.mouthSmileLeft || 0) + (bs.mouthSmileRight || 0)) / 2 - faceData.smile) * SMOOTH;
    faceData.browUp += ((bs.browInnerUp || 0) - faceData.browUp) * SMOOTH;

    const mtx = res?.facialTransformationMatrixes?.[0]?.data;
    if (mtx && mtx.length === 16) {
      _m.fromArray(mtx); // MediaPipe trả column-major — khớp THREE.Matrix4
      _e.setFromRotationMatrix(_m, 'YXZ');
      faceData.yaw += (_e.y - faceData.yaw) * SMOOTH;
      faceData.pitch += (_e.x - faceData.pitch) * SMOOTH;
      faceData.roll += (_e.z - faceData.roll) * SMOOTH;
    }
  } else {
    faceData.present = false;
  }
  raf = requestAnimationFrame(readFrame);
}

export async function startFaceTracking(): Promise<boolean> {
  if (!stopped) return true;
  if (busy) return false;
  busy = true;
  lastError = null;
  try {
    const vision = await import('@mediapipe/tasks-vision');
    const resolver = await vision.FilesetResolver.forVisionTasks(WASM_CDN);
    landmarker = await vision.FaceLandmarker.createFromOptions(resolver, {
      baseOptions: { modelAssetPath: MODEL_URL, delegate: 'GPU' },
      runningMode: 'VIDEO',
      numFaces: 1,
      outputFaceBlendshapes: true,
      outputFacialTransformationMatrixes: true,
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
    faceData.active = true;
    raf = requestAnimationFrame(readFrame);
    return true;
  } catch (e) {
    lastError = e instanceof Error ? e.message : String(e);
    console.warn('[Mira Face] không bật được camera/landmarker — avatar dùng chuột.', lastError);
    stopFaceTracking();
    return false;
  } finally {
    busy = false;
  }
}

export function stopFaceTracking(): void {
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
    landmarker?.close?.();
  } catch {
    /* noop */
  }
  landmarker = null;
  faceData.active = false;
  faceData.present = false;
}
