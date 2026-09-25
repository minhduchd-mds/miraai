import { acquireVisionCamera, releaseVisionCamera } from './camera-manager';
import { faceData } from '../face/face-tracker';
import { handData, type TrackedHand } from '../face/gesture-tracker';
import { postureData } from './posture-tracker';
import { facsProxyFromBlendshapes, EMPTY_FACS_PROXY } from '../face/facs-proxy';
import { inferFacialGesture } from '../face/facial-gesture';
import { MicroExpressionTracker } from '../face/micro-expression';
import { derivePosture } from './posture-model';
import { inferLiteGesture, type HandPoint } from './hand-gesture-lite';
import { VisionPostprocessWorkerClient } from './vision-worker-client';
import type { VisionWorkerResult, WorkerHandResult } from './vision-worker-protocol';
import {
  VisionPerformanceGovernor,
  EMPTY_VISION_PERFORMANCE,
  type VisionPerformanceState,
} from './vision-performance';

const WASM_CDN = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm';
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/holistic_landmarker/holistic_landmarker/float16/1/holistic_landmarker.task';

type Delegate = 'GPU' | 'CPU';

export interface HolisticRuntimeData {
  active: boolean;
  delegate: Delegate | 'unknown';
  error: string | null;
  performance: VisionPerformanceState;
}

export const holisticRuntimeData: HolisticRuntimeData = {
  active: false,
  delegate: 'unknown',
  error: null,
  performance: { ...EMPTY_VISION_PERFORMANCE, engine: 'holistic' },
};

let landmarker: { detectForVideo: (v: HTMLVideoElement, t: number) => any; close?: () => void } | null = null;
let video: HTMLVideoElement | null = null;
let raf = 0;
let stopped = true;
let busy = false;
let lastError: string | null = null;
let lastFaceSeenAt = 0;
let lastPoseCenter = { x: 0.5, y: 0.5 };
let postureMotionEma = 0;
const microExpressionTracker = new MicroExpressionTracker();
const handXHistory: number[] = [];
const headHistory: Array<{ at: number; yaw: number; pitch: number }> = [];
let headGestureUntil = 0;
let governor = new VisionPerformanceGovernor('holistic');
const postprocessWorker = new VisionPostprocessWorkerClient();
let lastWorkerSeq = 0;

const FACE_SMOOTH = 0.4;

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

function avg(a: number, b: number): number {
  return (a + b) / 2;
}

function pointDistance(a: { x: number; y: number; z?: number }, b: { x: number; y: number; z?: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y, Number(a.z || 0) - Number(b.z || 0));
}

function smooth(current: number, next: number, alpha = FACE_SMOOTH): number {
  return current + (next - current) * alpha;
}

function categoriesToMap(result: any): Record<string, number> {
  const categories = result?.faceBlendshapes?.[0]?.categories;
  if (!Array.isArray(categories)) return {};
  const map: Record<string, number> = {};
  for (const category of categories) {
    const name = String(category?.categoryName || category?.displayName || '');
    if (name) map[name] = Number(category?.score || 0);
  }
  return map;
}

function updateHeadPose(landmarks: any[], now: number): void {
  const leftEye = landmarks[33];
  const rightEye = landmarks[263];
  const leftCheek = landmarks[234];
  const rightCheek = landmarks[454];
  const nose = landmarks[1];
  const forehead = landmarks[10];
  const chin = landmarks[152];
  if (!leftEye || !rightEye || !leftCheek || !rightCheek || !nose || !forehead || !chin) return;

  const eyeDx = Number(rightEye.x) - Number(leftEye.x);
  const eyeDy = Number(rightEye.y) - Number(leftEye.y);
  const roll = Math.atan2(eyeDy, Math.max(1e-5, eyeDx));

  const cheekMidX = (Number(leftCheek.x) + Number(rightCheek.x)) / 2;
  const cheekWidth = Math.max(0.04, Math.abs(Number(rightCheek.x) - Number(leftCheek.x)));
  const yaw = Math.max(-1.05, Math.min(1.05, (Number(nose.x) - cheekMidX) / cheekWidth * 2.1));

  const faceHeight = Math.max(0.08, Math.abs(Number(chin.y) - Number(forehead.y)));
  const noseRatio = (Number(nose.y) - Number(forehead.y)) / faceHeight;
  const pitch = Math.max(-0.85, Math.min(0.85, (noseRatio - 0.47) * 2.6));

  faceData.yaw = smooth(faceData.yaw, yaw, 0.32);
  faceData.pitch = smooth(faceData.pitch, pitch, 0.32);
  faceData.roll = smooth(faceData.roll, roll, 0.32);

  headHistory.push({ at: now, yaw: faceData.yaw, pitch: faceData.pitch });
  while (headHistory.length && now - headHistory[0].at > 900) headHistory.shift();
  const yawValues = headHistory.map((item) => item.yaw);
  const pitchValues = headHistory.map((item) => item.pitch);
  const yawRange = yawValues.length ? Math.max(...yawValues) - Math.min(...yawValues) : 0;
  const pitchRange = pitchValues.length ? Math.max(...pitchValues) - Math.min(...pitchValues) : 0;

  if (pitchRange > 0.3 && yawRange < 0.34) {
    faceData.headGesture = 'nod';
    headGestureUntil = now + 700;
    headHistory.length = 0;
  } else if (yawRange > 0.42) {
    faceData.headGesture = 'shake';
    headGestureUntil = now + 700;
    headHistory.length = 0;
  } else if (now > headGestureUntil) {
    faceData.headGesture = 'none';
  }
}

function updateFace(result: any, now: number): number {
  const landmarks = result?.faceLandmarks?.[0];
  const bs = categoriesToMap(result);
  if (!Array.isArray(landmarks) || landmarks.length < 100 || !Object.keys(bs).length) {
    if (now - lastFaceSeenAt > 280) clearFace();
    return 0;
  }

  lastFaceSeenAt = now;
  faceData.active = true;
  faceData.present = true;
  faceData.landmarks = landmarks.slice(0, 478).map((p: any) => ({
    x: Number(p.x || 0),
    y: Number(p.y || 0),
    z: Number(p.z || 0),
  }));
  faceData.actionUnits = facsProxyFromBlendshapes(bs);
  faceData.microExpression = microExpressionTracker.update(faceData.actionUnits, now);

  faceData.jaw = smooth(faceData.jaw, Number(bs.jawOpen || 0));
  faceData.blinkL = smooth(faceData.blinkL, Number(bs.eyeBlinkLeft || 0));
  faceData.blinkR = smooth(faceData.blinkR, Number(bs.eyeBlinkRight || 0));
  faceData.smile = smooth(faceData.smile, avg(Number(bs.mouthSmileLeft || 0), Number(bs.mouthSmileRight || 0)));
  faceData.browUp = smooth(faceData.browUp, Number(bs.browInnerUp || 0));
  faceData.frown = smooth(faceData.frown, avg(Number(bs.mouthFrownLeft || 0), Number(bs.mouthFrownRight || 0)));
  faceData.browDown = smooth(faceData.browDown, avg(Number(bs.browDownLeft || 0), Number(bs.browDownRight || 0)));
  faceData.cheekSquint = smooth(faceData.cheekSquint, avg(Number(bs.cheekSquintLeft || 0), Number(bs.cheekSquintRight || 0)));
  faceData.eyeWide = smooth(faceData.eyeWide, avg(Number(bs.eyeWideLeft || 0), Number(bs.eyeWideRight || 0)));
  faceData.mouthPress = smooth(faceData.mouthPress, avg(Number(bs.mouthPressLeft || 0), Number(bs.mouthPressRight || 0)));

  const gazeXRaw = avg(
    Number(bs.eyeLookOutLeft || 0) - Number(bs.eyeLookInLeft || 0),
    Number(bs.eyeLookInRight || 0) - Number(bs.eyeLookOutRight || 0),
  );
  const gazeYRaw = avg(
    Number(bs.eyeLookUpLeft || 0) - Number(bs.eyeLookDownLeft || 0),
    Number(bs.eyeLookUpRight || 0) - Number(bs.eyeLookDownRight || 0),
  );
  faceData.gazeX = smooth(faceData.gazeX, gazeXRaw);
  faceData.gazeY = smooth(faceData.gazeY, gazeYRaw);

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

  const eyeSquint = avg(Number(bs.eyeSquintLeft || 0), Number(bs.eyeSquintRight || 0));
  const scores = {
    happy: clamp01(faceData.smile * 0.84 + faceData.cheekSquint * 0.2),
    sad: clamp01(faceData.frown * 0.72 + faceData.browUp * 0.16 + (1 - faceData.smile) * 0.06),
    tired: clamp01(avg(faceData.blinkL, faceData.blinkR) * 0.55 + faceData.jaw * 0.12 + (1 - faceData.eyeWide) * 0.08),
    surprised: clamp01(faceData.jaw * 0.5 + faceData.browUp * 0.3 + faceData.eyeWide * 0.24),
    angry: clamp01(faceData.browDown * 0.58 + faceData.mouthPress * 0.24 + eyeSquint * 0.08),
  };
  const ranked = Object.entries(scores).sort((a, b) => b[1] - a[1]) as Array<
    [Exclude<typeof faceData.emotion, 'neutral'>, number]
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

  updateHeadPose(landmarks, now);
  return Math.min(478, landmarks.length);
}

function clearFace(): void {
  faceData.present = false;
  faceData.yaw = 0;
  faceData.pitch = 0;
  faceData.roll = 0;
  faceData.jaw = 0;
  faceData.blinkL = 0;
  faceData.blinkR = 0;
  faceData.smile = 0;
  faceData.browUp = 0;
  faceData.frown = 0;
  faceData.browDown = 0;
  faceData.cheekSquint = 0;
  faceData.eyeWide = 0;
  faceData.mouthPress = 0;
  faceData.gazeX = 0;
  faceData.gazeY = 0;
  faceData.emotion = 'neutral';
  faceData.emotionConfidence = 0;
  faceData.landmarks = [];
  faceData.headGesture = 'none';
  faceData.faceGesture = 'none';
  faceData.faceGestureConfidence = 0;
  faceData.actionUnits = { ...EMPTY_FACS_PROXY };
  faceData.microExpression = { kind: 'none', confidence: 0, durationMs: 0, at: 0 };
  faceData.muscles = { brow: 0, eyes: 0, cheeks: 0, mouth: 0, jaw: 0 };
  headHistory.length = 0;
}

function posturePoints(raw: any[]): Array<{ x: number; y: number; z?: number; visibility?: number }> {
  return raw.slice(0, 33).map((p: any) => ({
    x: Number(p.x || 0),
    y: Number(p.y || 0),
    z: Number(p.z || 0),
    visibility: Number.isFinite(p.visibility) ? Number(p.visibility) : 0.8,
  }));
}

function applyPosture(
  estimate: ReturnType<typeof derivePosture>,
  points: ReturnType<typeof posturePoints>,
): number {
  const displacement = Math.hypot(estimate.centerX - lastPoseCenter.x, estimate.centerY - lastPoseCenter.y);
  lastPoseCenter = { x: estimate.centerX, y: estimate.centerY };
  postureMotionEma += (Math.min(1, displacement * 16) - postureMotionEma) * 0.3;

  Object.assign(postureData, estimate, {
    active: true,
    label: estimate.present && postureMotionEma > 0.48 ? 'moving' : estimate.label,
    motion: postureMotionEma,
    landmarks: points,
  });
  return points.length;
}

function updatePose(result: any): number {
  const raw = result?.poseLandmarks?.[0];
  if (!Array.isArray(raw) || raw.length < 25) {
    postureData.present = false;
    postureData.label = 'unknown';
    postureData.confidence = 0;
    postureData.motion = 0;
    postureData.landmarks = [];
    return 0;
  }

  const points = posturePoints(raw);
  return applyPosture(derivePosture(points), points);
}

function waveDetected(): boolean {
  if (handXHistory.length < 6) return false;
  let reversals = 0;
  let min = 1;
  let max = 0;
  for (let i = 1; i < handXHistory.length; i += 1) {
    min = Math.min(min, handXHistory[i]);
    max = Math.max(max, handXHistory[i]);
    if (i >= 2) {
      const d1 = handXHistory[i] - handXHistory[i - 1];
      const d2 = handXHistory[i - 1] - handXHistory[i - 2];
      if (d1 * d2 < 0 && Math.abs(d1) > 0.012) reversals += 1;
    }
  }
  return reversals >= 3 && max - min > 0.1;
}

function normalizeHand(raw: any[]): HandPoint[] | null {
  if (!Array.isArray(raw) || raw.length < 21) return null;
  return raw.slice(0, 21).map((p: any) => ({
    x: Number(p.x || 0),
    y: Number(p.y || 0),
    z: Number(p.z || 0),
  }));
}

function trackedHandFromGeometry(
  landmarks: HandPoint[],
  handedness: string,
  gestureResult = inferLiteGesture(landmarks),
): TrackedHand {
  const palm = landmarks[9] || landmarks[0];
  const indexTip = landmarks[8] || landmarks[0];
  const thumbTip = landmarks[4] || indexTip;
  return {
    handedness,
    gesture: gestureResult.gesture,
    score: gestureResult.score,
    x: Number(palm.x),
    y: Number(palm.y),
    pinching: pointDistance(indexTip, thumbTip) < 0.055,
    landmarks: landmarks.map((point) => ({ x: point.x, y: point.y })),
  };
}

function applyHands(hands: TrackedHand[]): number {
  handData.active = true;
  handData.hands = hands;
  const primary = hands.find((hand) => hand.handedness === 'Right') || hands[0];

  if (!primary) {
    handData.present = false;
    handData.gesture = 'None';
    handData.wave = false;
    handData.score = 0;
    handData.landmarks = [];
    handXHistory.length = 0;
    return 0;
  }

  handData.present = true;
  handData.gesture = primary.gesture;
  handData.score = primary.score;
  handData.landmarks = primary.landmarks;
  handData.x = smooth(handData.x, primary.x);
  handData.y = smooth(handData.y, primary.y);
  handXHistory.push(handData.x);
  if (handXHistory.length > 12) handXHistory.shift();
  handData.wave = handData.gesture === 'Open_Palm' && waveDetected();

  return hands.reduce((sum, hand) => sum + hand.landmarks.length, 0);
}

function updateHands(result: any): number {
  const hands: TrackedHand[] = [];
  const left = normalizeHand(result?.leftHandLandmarks?.[0]);
  const right = normalizeHand(result?.rightHandLandmarks?.[0]);
  if (left) hands.push(trackedHandFromGeometry(left, 'Left'));
  if (right) hands.push(trackedHandFromGeometry(right, 'Right'));
  return applyHands(hands);
}

function workerHandToTracked(hand: WorkerHandResult): TrackedHand {
  return trackedHandFromGeometry(hand.landmarks, hand.handedness, hand.gesture);
}

function applyWorkerResult(result: VisionWorkerResult): number {
  let count = 0;
  if (result.posture) {
    count += applyPosture(result.posture.estimate, result.posture.landmarks);
  } else {
    postureData.present = false;
    postureData.label = 'unknown';
    postureData.confidence = 0;
    postureData.motion = 0;
    postureData.landmarks = [];
  }

  const hands = result.hands.map(workerHandToTracked);
  count += applyHands(hands);
  return count;
}

function submitPostprocess(result: any, now: number): number {
  const workerStatus = postprocessWorker.status();
  if (!workerStatus.active) {
    governor.setPostprocess('main', 0);
    return updatePose(result) + updateHands(result);
  }

  const rawPose = result?.poseLandmarks?.[0];
  const pose = Array.isArray(rawPose) && rawPose.length >= 25 ? posturePoints(rawPose) : null;
  const leftHand = normalizeHand(result?.leftHandLandmarks?.[0]);
  const rightHand = normalizeHand(result?.rightHandLandmarks?.[0]);
  postprocessWorker.submit({ at: now, pose, leftHand, rightHand });

  const latest = postprocessWorker.latest();
  if (latest && latest.seq !== lastWorkerSeq && now - latest.at <= 700) {
    lastWorkerSeq = latest.seq;
    governor.setPostprocess('worker', latest.processingMs);
    return applyWorkerResult(latest);
  }

  if (!latest) {
    // Only the first frame falls back to synchronous geometry while the worker warms up.
    governor.setPostprocess('main', 0);
    return updatePose(result) + updateHands(result);
  }

  governor.setPostprocess('worker', workerStatus.processingMs);
  const postureCount = postureData.present ? postureData.landmarks.length : 0;
  const handCount = handData.hands.reduce((sum, hand) => sum + hand.landmarks.length, 0);
  return postureCount + handCount;
}

function clearAllSignals(): void {
  clearFace();
  faceData.active = false;
  handData.active = false;
  handData.present = false;
  handData.gesture = 'None';
  handData.wave = false;
  handData.score = 0;
  handData.landmarks = [];
  handData.hands = [];
  postureData.active = false;
  postureData.present = false;
  postureData.label = 'unknown';
  postureData.confidence = 0;
  postureData.motion = 0;
  postureData.landmarks = [];
  handXHistory.length = 0;
  headHistory.length = 0;
  microExpressionTracker.reset();
  lastPoseCenter = { x: 0.5, y: 0.5 };
  postureMotionEma = 0;
}

function readFrame(): void {
  if (stopped || !landmarker || !video) return;
  const now = performance.now();
  if (!governor.shouldProcess(now, typeof document !== 'undefined' && document.hidden)) {
    raf = requestAnimationFrame(readFrame);
    return;
  }

  const started = performance.now();
  let result: any = null;
  try {
    result = landmarker.detectForVideo(video, now);
  } catch (error) {
    lastError = error instanceof Error ? error.message : String(error);
  }

  let landmarkCount = 0;
  if (result) {
    landmarkCount += updateFace(result, now);
    landmarkCount += submitPostprocess(result, now);
  }
  const inferenceMs = performance.now() - started;
  governor.noteFrame(now, inferenceMs, landmarkCount);
  holisticRuntimeData.performance = governor.snapshot();

  raf = requestAnimationFrame(readFrame);
}

async function createLandmarker(delegate: Delegate): Promise<any> {
  const vision = await import('@mediapipe/tasks-vision');
  const resolver = await vision.FilesetResolver.forVisionTasks(WASM_CDN);
  const HolisticLandmarker = (vision as any).HolisticLandmarker;
  if (!HolisticLandmarker) throw new Error('HolisticLandmarker is unavailable in @mediapipe/tasks-vision');
  return HolisticLandmarker.createFromOptions(resolver, {
    baseOptions: { modelAssetPath: MODEL_URL, delegate },
    runningMode: 'VIDEO',
    minFaceDetectionConfidence: 0.45,
    minFacePresenceConfidence: 0.45,
    minPoseDetectionConfidence: 0.45,
    minPosePresenceConfidence: 0.45,
    minHandLandmarksConfidence: 0.45,
    outputFaceBlendshapes: true,
    outputPoseSegmentationMasks: false,
  });
}

export function holisticTrackerError(): string | null {
  return lastError;
}

export function holisticTrackerActive(): boolean {
  return !stopped;
}

export function holisticPerformanceSnapshot(): VisionPerformanceState {
  return governor.snapshot();
}

export async function startHolisticTracking(): Promise<boolean> {
  if (!stopped) return true;
  if (busy) return false;
  busy = true;
  lastError = null;
  holisticRuntimeData.error = null;

  try {
    let delegate: Delegate = 'GPU';
    try {
      landmarker = await createLandmarker('GPU');
    } catch (gpuError) {
      console.warn('[Mira Holistic] GPU delegate unavailable; falling back to CPU.', gpuError);
      delegate = 'CPU';
      landmarker = await createLandmarker('CPU');
    }

    governor = new VisionPerformanceGovernor('holistic', delegate);
    const workerActive = postprocessWorker.start();
    governor.setPostprocess(workerActive ? 'worker' : 'main', 0);
    lastWorkerSeq = 0;
    video = await acquireVisionCamera('holistic');
    stopped = false;
    holisticRuntimeData.active = true;
    holisticRuntimeData.delegate = delegate;
    holisticRuntimeData.performance = governor.snapshot();
    faceData.active = true;
    handData.active = true;
    postureData.active = true;
    raf = requestAnimationFrame(readFrame);
    return true;
  } catch (error) {
    lastError = error instanceof Error ? error.message : String(error);
    holisticRuntimeData.error = lastError;
    console.warn('[Mira Holistic] unified tracker unavailable.', lastError);
    stopHolisticTracking();
    return false;
  } finally {
    busy = false;
  }
}

export function stopHolisticTracking(): void {
  stopped = true;
  cancelAnimationFrame(raf);
  releaseVisionCamera('holistic');
  video = null;
  try { landmarker?.close?.(); } catch { /* noop */ }
  landmarker = null;
  holisticRuntimeData.active = false;
  holisticRuntimeData.delegate = 'unknown';
  postprocessWorker.stop();
  lastWorkerSeq = 0;
  clearAllSignals();
}
