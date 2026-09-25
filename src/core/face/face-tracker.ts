import * as THREE from 'three';
import { acquireVisionCamera, releaseVisionCamera } from '../vision/camera-manager';
import { inferFacialGesture, type FacialGesture } from './facial-gesture';
import { EMPTY_FACS_PROXY, facsProxyFromBlendshapes, type FACSProxy } from './facs-proxy';
import { blendshapeMap, normalizeFaceLandmarks } from '../vision/face-frame-guard';
import { MicroExpressionTracker, type MicroExpressionState } from './micro-expression';

const WASM_CDN = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm';
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';

export interface FaceLandmark {
  x: number;
  y: number;
  z: number;
}

export interface FaceMuscles {
  brow: number;
  eyes: number;
  cheeks: number;
  mouth: number;
  jaw: number;
}

export interface FaceData {
  active: boolean;
  present: boolean;
  yaw: number;
  pitch: number;
  roll: number;
  jaw: number;
  blinkL: number;
  blinkR: number;
  smile: number;
  browUp: number;
  frown: number;
  browDown: number;
  cheekSquint: number;
  eyeWide: number;
  mouthPress: number;
  gazeX: number;
  gazeY: number;
  emotion: 'happy' | 'sad' | 'tired' | 'surprised' | 'angry' | 'neutral';
  emotionConfidence: number;
  headGesture: 'nod' | 'shake' | 'none';
  faceGesture: FacialGesture;
  faceGestureConfidence: number;
  actionUnits: FACSProxy;
  microExpression: MicroExpressionState;
  landmarks: FaceLandmark[];
  muscles: FaceMuscles;
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
  frown: 0,
  browDown: 0,
  cheekSquint: 0,
  eyeWide: 0,
  mouthPress: 0,
  gazeX: 0,
  gazeY: 0,
  emotion: 'neutral',
  emotionConfidence: 0,
  headGesture: 'none',
  faceGesture: 'none',
  faceGestureConfidence: 0,
  actionUnits: { ...EMPTY_FACS_PROXY },
  microExpression: { kind: 'none', confidence: 0, durationMs: 0, at: 0 },
  landmarks: [],
  muscles: { brow: 0, eyes: 0, cheeks: 0, mouth: 0, jaw: 0 },
};

let landmarker: { detectForVideo: (v: HTMLVideoElement, t: number) => any; close?: () => void } | null = null;
let video: HTMLVideoElement | null = null;
let raf = 0;
let stopped = true;
let busy = false;
let lastError: string | null = null;
let lastInferenceAt = 0;
let gestureUntil = 0;
const poseHistory: Array<{ at: number; yaw: number; pitch: number }> = [];
const microExpressionTracker = new MicroExpressionTracker();

export function faceTrackerError(): string | null {
  return lastError;
}
export function faceTrackerActive(): boolean {
  return !stopped;
}

const _m = new THREE.Matrix4();
const _e = new THREE.Euler();
const SMOOTH = 0.4;

function inferenceIntervalMs(): number {
  if (typeof navigator === 'undefined') return 30;
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) ? 45 : 30;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, Number(value) || 0));
}

function avg(a: number, b: number): number {
  return (a + b) / 2;
}

function updateHeadGesture(now: number): void {
  poseHistory.push({ at: now, yaw: faceData.yaw, pitch: faceData.pitch });
  while (poseHistory.length && now - poseHistory[0].at > 900) poseHistory.shift();
  const yawValues = poseHistory.map((item) => item.yaw);
  const pitchValues = poseHistory.map((item) => item.pitch);
  const yawRange = yawValues.length ? Math.max(...yawValues) - Math.min(...yawValues) : 0;
  const pitchRange = pitchValues.length ? Math.max(...pitchValues) - Math.min(...pitchValues) : 0;

  if (pitchRange > 0.28 && yawRange < 0.3) {
    faceData.headGesture = 'nod';
    gestureUntil = now + 700;
    poseHistory.length = 0;
  } else if (yawRange > 0.36) {
    faceData.headGesture = 'shake';
    gestureUntil = now + 700;
    poseHistory.length = 0;
  } else if (now > gestureUntil) {
    faceData.headGesture = 'none';
  }
}

function updateEmotion(bs: Record<string, number>): void {
  const cheek = avg(bs.cheekSquintLeft || 0, bs.cheekSquintRight || 0);
  const eyeWide = avg(bs.eyeWideLeft || 0, bs.eyeWideRight || 0);
  const eyeSquint = avg(bs.eyeSquintLeft || 0, bs.eyeSquintRight || 0);
  const mouthPress = avg(bs.mouthPressLeft || 0, bs.mouthPressRight || 0);
  faceData.cheekSquint += (cheek - faceData.cheekSquint) * SMOOTH;
  faceData.eyeWide += (eyeWide - faceData.eyeWide) * SMOOTH;
  faceData.mouthPress += (mouthPress - faceData.mouthPress) * SMOOTH;

  const scores = {
    happy: clamp01(faceData.smile * 0.84 + faceData.cheekSquint * 0.2),
    sad: clamp01(faceData.frown * 0.72 + faceData.browUp * 0.16 + (1 - faceData.smile) * 0.06),
    tired: clamp01(
      avg(faceData.blinkL, faceData.blinkR) * 0.55 +
      faceData.jaw * 0.12 +
      (1 - faceData.eyeWide) * 0.08,
    ),
    surprised: clamp01(faceData.jaw * 0.5 + faceData.browUp * 0.3 + faceData.eyeWide * 0.24),
    angry: clamp01(faceData.browDown * 0.58 + faceData.mouthPress * 0.24 + eyeSquint * 0.08),
  };
  const ranked = Object.entries(scores).sort((a, b) => b[1] - a[1]) as Array<
    [Exclude<FaceData['emotion'], 'neutral'>, number]
  >;
  const [emotion, top] = ranked[0];
  const second = ranked[1]?.[1] || 0;
  const confidence = clamp01(top * 0.82 + Math.max(0, top - second) * 0.42);
  faceData.emotion = top >= 0.28 && confidence >= 0.26 ? emotion : 'neutral';
  faceData.emotionConfidence = faceData.emotion === 'neutral' ? 0 : confidence;

  faceData.muscles = {
    brow: clamp01(Math.max(faceData.browUp, faceData.browDown)),
    eyes: clamp01(Math.max(avg(faceData.blinkL, faceData.blinkR), faceData.eyeWide, eyeSquint)),
    cheeks: clamp01(faceData.cheekSquint),
    mouth: clamp01(Math.max(faceData.smile, faceData.frown, faceData.mouthPress)),
    jaw: clamp01(faceData.jaw),
  };
}

function readFrame(): void {
  if (stopped || !landmarker || !video) return;
  const now = performance.now();
  if (now - lastInferenceAt < inferenceIntervalMs()) {
    raf = requestAnimationFrame(readFrame);
    return;
  }
  lastInferenceAt = now;

  let res: any = null;
  try {
    res = landmarker.detectForVideo(video, now);
  } catch {
    res = null;
  }

  const landmarks = normalizeFaceLandmarks(res?.faceLandmarks?.[0]);
  const bs = blendshapeMap(res?.faceBlendshapes?.[0]?.categories);
  if (landmarks.length >= 100) {
    faceData.present = true;
    faceData.landmarks = landmarks;

    if (!Object.keys(bs).length) {
      faceData.actionUnits = { ...EMPTY_FACS_PROXY };
      faceData.microExpression = { kind: 'none', confidence: 0, durationMs: 0, at: now };
      microExpressionTracker.reset();
      faceData.jaw += (0 - faceData.jaw) * 0.18;
      faceData.blinkL += (0 - faceData.blinkL) * 0.18;
      faceData.blinkR += (0 - faceData.blinkR) * 0.18;
      faceData.smile += (0 - faceData.smile) * 0.18;
      faceData.browUp += (0 - faceData.browUp) * 0.18;
      faceData.frown += (0 - faceData.frown) * 0.18;
      faceData.browDown += (0 - faceData.browDown) * 0.18;
      faceData.cheekSquint += (0 - faceData.cheekSquint) * 0.18;
      faceData.eyeWide += (0 - faceData.eyeWide) * 0.18;
      faceData.mouthPress += (0 - faceData.mouthPress) * 0.18;
      faceData.gazeX += (0 - faceData.gazeX) * 0.18;
      faceData.gazeY += (0 - faceData.gazeY) * 0.18;
      faceData.emotion = 'neutral';
      faceData.emotionConfidence = 0;
      faceData.faceGesture = 'none';
      faceData.faceGestureConfidence = 0;
      faceData.muscles = { brow: 0, eyes: 0, cheeks: 0, mouth: 0, jaw: 0 };
      const mtx = res?.facialTransformationMatrixes?.[0]?.data;
      if (mtx?.length === 16) {
        _m.fromArray(mtx);
        _e.setFromRotationMatrix(_m, 'YXZ');
        faceData.yaw += (_e.y - faceData.yaw) * SMOOTH;
        faceData.pitch += (_e.x - faceData.pitch) * SMOOTH;
        faceData.roll += (_e.z - faceData.roll) * SMOOTH;
        updateHeadGesture(now);
      }
      raf = requestAnimationFrame(readFrame);
      return;
    }

    faceData.actionUnits = facsProxyFromBlendshapes(bs);
    faceData.microExpression = microExpressionTracker.update(faceData.actionUnits, now);

    faceData.jaw += ((bs.jawOpen || 0) - faceData.jaw) * SMOOTH;
    faceData.blinkL += ((bs.eyeBlinkLeft || 0) - faceData.blinkL) * SMOOTH;
    faceData.blinkR += ((bs.eyeBlinkRight || 0) - faceData.blinkR) * SMOOTH;
    faceData.smile +=
      (avg(bs.mouthSmileLeft || 0, bs.mouthSmileRight || 0) - faceData.smile) * SMOOTH;
    faceData.browUp += ((bs.browInnerUp || 0) - faceData.browUp) * SMOOTH;
    faceData.frown +=
      (avg(bs.mouthFrownLeft || 0, bs.mouthFrownRight || 0) - faceData.frown) * SMOOTH;
    faceData.browDown +=
      (avg(bs.browDownLeft || 0, bs.browDownRight || 0) - faceData.browDown) * SMOOTH;

    const gazeXRaw = avg(
      (bs.eyeLookOutLeft || 0) - (bs.eyeLookInLeft || 0),
      (bs.eyeLookInRight || 0) - (bs.eyeLookOutRight || 0),
    );
    const gazeYRaw = avg(
      (bs.eyeLookUpLeft || 0) - (bs.eyeLookDownLeft || 0),
      (bs.eyeLookUpRight || 0) - (bs.eyeLookDownRight || 0),
    );
    faceData.gazeX += (gazeXRaw - faceData.gazeX) * SMOOTH;
    faceData.gazeY += (gazeYRaw - faceData.gazeY) * SMOOTH;

    const facialGesture = inferFacialGesture({
      smile: faceData.smile,
      frown: faceData.frown,
      browUp: faceData.browUp,
      jaw: faceData.jaw,
      blinkL: faceData.blinkL,
      blinkR: faceData.blinkR,
      cheekSquint: faceData.cheekSquint,
      eyeWide: faceData.eyeWide,
    });
    faceData.faceGesture = facialGesture.gesture;
    faceData.faceGestureConfidence = facialGesture.confidence;

    updateEmotion(bs);

    const mtx = res?.facialTransformationMatrixes?.[0]?.data;
    if (mtx?.length === 16) {
      _m.fromArray(mtx);
      _e.setFromRotationMatrix(_m, 'YXZ');
      faceData.yaw += (_e.y - faceData.yaw) * SMOOTH;
      faceData.pitch += (_e.x - faceData.pitch) * SMOOTH;
      faceData.roll += (_e.z - faceData.roll) * SMOOTH;
      updateHeadGesture(now);
    }
  } else {
    faceData.present = false;
    faceData.emotion = 'neutral';
    faceData.emotionConfidence = 0;
    faceData.landmarks = [];
    faceData.headGesture = 'none';
    faceData.faceGesture = 'none';
    faceData.faceGestureConfidence = 0;
    faceData.actionUnits = { ...EMPTY_FACS_PROXY };
    faceData.microExpression = { kind: 'none', confidence: 0, durationMs: 0, at: 0 };
    microExpressionTracker.reset();
    faceData.muscles = { brow: 0, eyes: 0, cheeks: 0, mouth: 0, jaw: 0 };
    poseHistory.length = 0;
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
    try {
      landmarker = await vision.FaceLandmarker.createFromOptions(resolver, {
        baseOptions: { modelAssetPath: MODEL_URL, delegate: 'GPU' },
        runningMode: 'VIDEO',
        numFaces: 1,
        outputFaceBlendshapes: true,
        outputFacialTransformationMatrixes: true,
      });
    } catch {
      landmarker = await vision.FaceLandmarker.createFromOptions(resolver, {
        baseOptions: { modelAssetPath: MODEL_URL, delegate: 'CPU' },
        runningMode: 'VIDEO',
        numFaces: 1,
        outputFaceBlendshapes: true,
        outputFacialTransformationMatrixes: true,
      });
    }
    video = await acquireVisionCamera('face');
    stopped = false;
    faceData.active = true;
    lastInferenceAt = 0;
    raf = requestAnimationFrame(readFrame);
    return true;
  } catch (error) {
    lastError = error instanceof Error ? error.message : String(error);
    console.warn('[Mira Face] không bật được camera/landmarker.', lastError);
    stopFaceTracking();
    return false;
  } finally {
    busy = false;
  }
}

export function stopFaceTracking(): void {
  stopped = true;
  cancelAnimationFrame(raf);
  releaseVisionCamera('face');
  video = null;
  try { landmarker?.close?.(); } catch { /* noop */ }
  landmarker = null;
  faceData.active = false;
  faceData.present = false;
  faceData.landmarks = [];
  faceData.emotion = 'neutral';
  faceData.emotionConfidence = 0;
  faceData.headGesture = 'none';
  faceData.faceGesture = 'none';
  faceData.faceGestureConfidence = 0;
  faceData.actionUnits = { ...EMPTY_FACS_PROXY };
  faceData.microExpression = { kind: 'none', confidence: 0, durationMs: 0, at: 0 };
  microExpressionTracker.reset();
  faceData.muscles = { brow: 0, eyes: 0, cheeks: 0, mouth: 0, jaw: 0 };
  poseHistory.length = 0;
  lastInferenceAt = 0;
}
