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
  return {
    faceSeen: Boolean(faceData.active && faceData.present),
    handSeen: Boolean(handData.active && handData.present),
    gesture: handData.gesture,
    wave: handData.wave,
  };
}

export function visionStream(): MediaStream | null {
  return getVisionCameraStream();
}
