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
import {
  objectAwarenessSnapshot,
  startObjectAwareness,
  stopObjectAwareness,
} from '../core/vision/object-awareness';

let activeEngine: 'holistic' | 'legacy' = 'legacy';
let visionSession = 0;
let faceRecoveryTimer: number | null = null;

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
        if (face.lastSeenAt > 0 || face.landmarkCount >= 100) return;

        // Holistic is alive but face output never became usable. Restart on the proven
        // dedicated trackers instead of leaving the camera stuck on "Đang quét khuôn mặt".
        stopHolisticTracking();
        void startLegacyVision(session);
      }, 4_500);
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
  activeEngine = 'legacy';
}

export function visionSnapshot() {
  const landmarks = handData.landmarks.map((point) => ({ ...point }));
  const spatialPose = estimateRealPresencePose(faceData.landmarks);
  const indexTip = landmarks[8] || { x: handData.x, y: handData.y };
  const thumbTip = landmarks[4] || indexTip;
  const pinchDistance = Math.hypot(indexTip.x - thumbTip.x, indexTip.y - thumbTip.y);
  const hands = handData.hands.map((hand) => ({
    handedness: hand.handedness,
    gesture: hand.gesture,
    score: hand.score,
    x: 1 - hand.x,
    y: hand.y,
    pinching: hand.pinching,
    landmarks: hand.landmarks.map((point) => ({ ...point })),
  }));

  return {
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
    handSeen: Boolean(handData.active && handData.present),
    handCount: hands.length,
    hands,
    gesture: handData.gesture,
    wave: handData.wave,
    handX: handData.x,
    handY: handData.y,
    pointerX: 1 - indexTip.x,
    pointerY: indexTip.y,
    pinching: landmarks.length >= 21 && pinchDistance < 0.055,
    pinchDistance,
    gestureScore: handData.score,
    landmarks,
  };
}

export function visionStream(): MediaStream | null {
  return getVisionCameraStream();
}
