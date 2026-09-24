import { faceData, faceTrackerError, startFaceTracking, stopFaceTracking } from '../core/face/face-tracker';
import { gestureTrackerError, handData, startGestureTracking, stopGestureTracking } from '../core/face/gesture-tracker';
import { getVisionCameraStream } from '../core/vision/camera-manager';

export async function startVision(): Promise<{ ok: boolean; error: string }> {
  const [faceOk, handOk] = await Promise.all([startFaceTracking(), startGestureTracking()]);
  return {
    ok: faceOk || handOk,
    error: faceTrackerError() || gestureTrackerError() || '',
  };
}

export function stopVision(): void {
  stopFaceTracking();
  stopGestureTracking();
}

export function visionSnapshot() {
  const landmarks = handData.landmarks.map((point) => ({ ...point }));
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
