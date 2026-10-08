import {
  faceData,
  faceTrackerError,
  startFaceTracking,
  stopFaceTracking,
} from '../core/face/face-tracker';
import {
  gestureTrackerError,
  handData,
  startGestureTracking,
  stopGestureTracking,
} from '../core/face/gesture-tracker';
import { getVisionCameraStream } from '../core/vision/camera-manager';
import { MiraSenseBus } from '../core/vision/sense-bus';
import { estimateRealPresencePose } from '../core/vision/real-presence';
import { postureData, postureTrackerError, startPostureTracking, stopPostureTracking } from '../core/vision/posture-tracker';
import { rppgData, startRppgMonitoring, stopRppgMonitoring } from '../core/vision/rppg-monitor';
import {
  holisticPerformanceSnapshot,
  holisticFaceHealthSnapshot,
  holisticTrackerActive,
  holisticTrackerError,
  startHolisticTracking,
  stopHolisticTracking,
} from '../core/vision/holistic-tracker';
import { EMPTY_VISION_PERFORMANCE } from '../core/vision/vision-performance';
import { handRayFromLandmarks } from '../core/vision/spatial-ray';
import { SpatialHandKinematicsTracker } from '../core/vision/spatial-hand-kinematics';
import { SpatialHandFrameCache } from '../core/vision/spatial-hand-frame-cache';
import { SpatialAdaptivePointer } from '../core/vision/spatial-adaptive-pointer';
import { spatialPerformanceProfiler } from '../core/vision/spatial-performance';
// Heavy bimanual geometry is imported only with the camera runtime.
export { updateSpatialWindowBimanual } from '../app/spatial-window-bimanual';
export { updateSpatialObjectBimanual } from '../app/spatial-object-bimanual';
import {
  objectAwarenessSnapshot,
  startObjectAwareness,
  stopObjectAwareness,
} from '../core/vision/object-awareness';

let activeEngine: 'holistic' | 'legacy' = 'legacy';
let visionSession = 0;
let faceRecoveryTimer: number | null = null;
const handKinematicsTracker = new SpatialHandKinematicsTracker();
const adaptiveHandPointer = new SpatialAdaptivePointer();
const handFrameCache = new SpatialHandFrameCache<ReturnType<typeof buildHandSnapshot>[number]>();
const senseBus = new MiraSenseBus();

function buildHandSnapshot(frameAt: number) {
  adaptiveHandPointer.retain(handData.hands.map((hand) => hand.handedness));
  return handData.hands.map((hand) => {
    const handIndexTip = hand.landmarks[8] || hand.landmarks[0] || { x: hand.x, y: hand.y, z: 0 };
    const pointer = adaptiveHandPointer.update(
      hand.handedness, 1 - Number(handIndexTip.x), Number(handIndexTip.y), frameAt, hand.score,
    );
    const kinematics = handKinematicsTracker.update({
      handedness: hand.handedness,
      landmarks: hand.landmarks,
      worldLandmarks: hand.worldLandmarks,
      confidence: hand.score,
    }, frameAt);
    return {
      handedness: hand.handedness,
      gesture: hand.gesture,
      score: hand.score,
      x: 1 - hand.x,
      y: hand.y,
      z: Number(handIndexTip.z || 0),
      pointerX: pointer?.x ?? 0.5,
      pointerY: pointer?.y ?? 0.5,
      ray: handRayFromLandmarks(hand.landmarks),
      pinching: kinematics.pinching,
      pinchRatio: kinematics.pinchRatio,
      kinematics,
      landmarks: hand.landmarks.map((point) => ({ ...point })),
      worldLandmarks: hand.worldLandmarks.map((point) => ({ ...point })),
    };
  });
}

function clearFaceRecoveryTimer(): void {
  if (faceRecoveryTimer != null && typeof window !== 'undefined') window.clearTimeout(faceRecoveryTimer);
  faceRecoveryTimer = null;
}

async function startLegacyVision(session: number): Promise<{ ok: boolean; error: string }> {
  const [faceOk, handOk, postureOk, rppgOk] = await Promise.all([
    startFaceTracking(),
    startGestureTracking(),
    startPostureTracking(),
    startRppgMonitoring(),
  ]);
  if (session !== visionSession) {
    stopFaceTracking();
    stopGestureTracking();
    stopPostureTracking();
    stopRppgMonitoring();
    return { ok: false, error: 'Vision session changed.' };
  }
  activeEngine = 'legacy';
  const ok = faceOk || handOk || postureOk || rppgOk;
  if (ok) void startObjectAwareness();
  return {
    ok,
    error: faceOk ? '' : (faceTrackerError() || gestureTrackerError() || postureTrackerError() || 'Face detector unavailable.'),
  };
}

export async function startVision(): Promise<{ ok: boolean; error: string }> {
  const session = ++visionSession;
  clearFaceRecoveryTimer();
  const holisticOk = await startHolisticTracking();
  if (session !== visionSession) return { ok: false, error: 'Vision session changed.' };

  if (holisticOk) {
    activeEngine = 'holistic';
    await startRppgMonitoring();
    void startObjectAwareness();

    if (typeof window !== 'undefined') {
      faceRecoveryTimer = window.setTimeout(() => {
        faceRecoveryTimer = null;
        if (session !== visionSession || !holisticTrackerActive()) return;

        const face = holisticFaceHealthSnapshot();
        const performance = holisticPerformanceSnapshot();
        if (face.lastSeenAt > 0 || face.landmarkCount >= 100) return;

        // A healthy Holistic graph can legitimately report no face when the user is
        // outside the camera ROI. Do not tear it down just because face landmarks are
        // absent: that would boot a second Face/Hand/Pose stack, duplicate inference,
        // and re-initialize MediaPipe graphs unnecessarily.
        if (performance.processedFrames >= 6 && !holisticTrackerError()) return;

        // Fallback only when Holistic failed to produce a usable processing loop.
        stopHolisticTracking();
        void startLegacyVision(session);
      }, 8_000);
    }
    return { ok: true, error: '' };
  }

  // Backward-compatible fallback for browsers/devices that cannot load HolisticLandmarker.
  const fallback = await startLegacyVision(session);
  return {
    ok: fallback.ok,
    error: fallback.error || holisticTrackerError() || '',
  };
}

export function stopVision(): void {
  visionSession += 1;
  clearFaceRecoveryTimer();
  stopHolisticTracking();
  stopFaceTracking();
  stopGestureTracking();
  stopPostureTracking();
  stopRppgMonitoring();
  stopObjectAwareness();
  handKinematicsTracker.reset();
  adaptiveHandPointer.reset();
  handFrameCache.reset();
  spatialPerformanceProfiler.reset();
  senseBus.reset();
  activeEngine = 'legacy';
}

export function visionSnapshot() {
  const now = performance.now();
  // Polling must not refresh stale camera inference or authorize old pinches.
  const handFresh = Number.isFinite(handData.lastFrameAt) &&
    handData.lastFrameAt > 0 && now >= handData.lastFrameAt &&
    now - handData.lastFrameAt <= 350;
  const landmarks = handFresh ? handData.landmarks.map((point) => ({ ...point })) : [];
  const spatialPose = estimateRealPresencePose(faceData.landmarks);
  const indexTip = landmarks[8] || { x: 0.5, y: 0.5, z: 0 };
  const thumbTip = landmarks[4] || indexTip;
  const pinchDistance = Math.hypot(indexTip.x - thumbTip.x, indexTip.y - thumbTip.y);
  const hands = handFrameCache.read(
    handFresh ? handData.lastFrameAt : 0,
    buildHandSnapshot,
    () => { handKinematicsTracker.reset(); adaptiveHandPointer.reset(); },
  );

  // Temporal metadata only: do not store landmarks or camera frames in SenseBus.
  if (faceData.active && faceData.present) {
    senseBus.ingest({ source: 'face', kind: 'presence', confidence: 0.85, atMs: now }, now);
  }
  for (const hand of hands) {
    if (hand.score > 0) {
      senseBus.ingest({ source: 'hand', kind: 'tracked', trackId: hand.handedness || 'unknown',
        confidence: hand.score, atMs: now }, now);
    }
  }
  if (postureData.active && postureData.present) {
    senseBus.ingest({ source: 'posture', kind: 'presence',
      confidence: postureData.confidence, atMs: now }, now);
  }
  const sense = senseBus.snapshot(now);
  return {
    sense,
    faceSeen: Boolean(faceData.active && faceData.present),
    face: {
      present: Boolean(faceData.active && faceData.present),
      emotion: faceData.emotion,
      confidence: faceData.emotionConfidence,
      yaw: faceData.yaw,
      pitch: faceData.pitch,
      roll: faceData.roll,
      jaw: faceData.jaw,
      blinkL: faceData.blinkL,
      blinkR: faceData.blinkR,
      smile: faceData.smile,
      frown: faceData.frown,
      browUp: faceData.browUp,
      browDown: faceData.browDown,
      cheekSquint: faceData.cheekSquint,
      eyeWide: faceData.eyeWide,
      mouthPress: faceData.mouthPress,
      gazeX: faceData.gazeX,
      gazeY: faceData.gazeY,
      headGesture: faceData.headGesture,
      faceGesture: faceData.faceGesture,
      faceGestureConfidence: faceData.faceGestureConfidence,
      actionUnits: { ...faceData.actionUnits },
      microExpression: { ...faceData.microExpression },
      landmarks: faceData.landmarks.map((point) => ({ ...point })),
      muscles: { ...faceData.muscles },
      spatialPose,
    },
    posture: {
      active: postureData.active,
      present: postureData.present,
      label: postureData.label,
      confidence: postureData.confidence,
      upright: postureData.upright,
      slump: postureData.slump,
      lean: postureData.lean,
      shoulderSlope: postureData.shoulderSlope,
      motion: postureData.motion,
      landmarks: postureData.landmarks.map((point) => ({ ...point })),
    },
    rppg: { ...rppgData },
    environment: objectAwarenessSnapshot(),
    faceRuntime: holisticTrackerActive()
      ? holisticFaceHealthSnapshot()
      : {
          status: faceData.present ? 'full' : 'scanning',
          landmarkCount: faceData.landmarks.length,
          blendshapesReady: Boolean(faceData.present),
          lastSeenAt: 0,
        },
    visionPerformance: holisticTrackerActive()
      ? holisticPerformanceSnapshot()
      : { ...EMPTY_VISION_PERFORMANCE, engine: activeEngine },
    visionEngine: activeEngine,
    spatialPerformance: spatialPerformanceProfiler.snapshot(
      (performance as Performance & { memory?: { usedJSHeapSize?: number } }).memory?.usedJSHeapSize,
    ),
    handSeen: Boolean(handFresh && handData.active && handData.present),
    handFrameAt: handFresh ? handData.lastFrameAt : 0,
    handCount: hands.length,
    hands,
    gesture: handFresh ? handData.gesture : 'None',
    wave: handFresh && handData.wave,
    handX: handFresh ? handData.x : 0.5,
    handY: handFresh ? handData.y : 0.5,
    pointerX: 1 - indexTip.x,
    pointerY: indexTip.y,
    pointerZ: Number(indexTip.z || 0),
    pointerRay: handFresh ? handRayFromLandmarks(landmarks) : null,
    pinching: handFresh && (hands[0]?.pinching ?? (landmarks.length >= 21 && pinchDistance < 0.055)),
    pinchDistance: handFresh ? pinchDistance : 1,
    gestureScore: handFresh ? handData.score : 0,
    landmarks,
  };
}

// Late-bound camera runtime diagnostics stay out of the deferred AppV2 bundle.
export function noteSpatialUiPoll(frameAt: number, now: number, handSeen: boolean): void {
  spatialPerformanceProfiler.notePoll(frameAt, now, handSeen);
}
export function noteSpatialHandAction(frameAt: number, now: number): void {
  spatialPerformanceProfiler.noteHandAction(frameAt, now);
}
export function noteSpatialUiWork(durationMs: number): void {
  spatialPerformanceProfiler.noteUiWork(durationMs);
}
export function resetSpatialPerformance(): void {
  spatialPerformanceProfiler.reset();
}

export function visionStream(): MediaStream | null {
  return getVisionCameraStream();
}
