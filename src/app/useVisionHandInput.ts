import { useCallback, useRef } from 'react';
import { GestureIntentTracker } from '../core/vision/gesture-intent';
import type { SpatialDeviceAdapterRuntime } from '../core/vision/spatial-device-adapter';
import {
  EMPTY_HAND_KINEMATICS,
  mirrorSpatialHandKinematicsX,
  type SpatialHandKinematicsState,
} from '../core/vision/spatial-hand-kinematics';

type VisionRuntimeModule = typeof import('../presence/vision-runtime');
type VisionSnapshot = ReturnType<VisionRuntimeModule['visionSnapshot']>;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Number.isFinite(value) ? value : 0));
}

export function useVisionHandInput(deviceAdapter: SpatialDeviceAdapterRuntime) {
  const gestureIntentTrackerRef = useRef(new GestureIntentTracker());

  const updateVisionHandInput = useCallback((snapshot: VisionSnapshot | undefined, now: number) => {
    const intent = gestureIntentTrackerRef.current.update({
      gesture: String(snapshot?.gesture || 'None'),
      score: Number(snapshot?.gestureScore || 0),
      pinching: Boolean(snapshot?.pinching),
      wave: Boolean(snapshot?.wave),
    }, now);

    const rawHands = Array.isArray(snapshot?.hands) ? snapshot.hands : [];
    const primaryHand =
      rawHands.find((hand) => String(hand?.handedness || '') === 'Right') ||
      rawHands[0] ||
      null;
    const primaryGesture = String(primaryHand?.gesture || snapshot?.gesture || 'None');
    const primaryScore = Number(primaryHand?.score ?? snapshot?.gestureScore ?? 0);
    const primaryPinching = Boolean(primaryHand?.pinching ?? snapshot?.pinching);
    const rawKinematics = primaryHand?.kinematics as SpatialHandKinematicsState | undefined;
    const screenKinematics = rawKinematics?.present
      ? mirrorSpatialHandKinematicsX(rawKinematics)
      : {
          ...EMPTY_HAND_KINEMATICS,
          handedness: String(primaryHand?.handedness || 'none'),
          at: now,
        };

    const relativePointer = deviceAdapter.webcamPoint({
      x: Number(primaryHand?.pointerX ?? snapshot?.pointerX ?? 0.5),
      y: Number(primaryHand?.pointerY ?? snapshot?.pointerY ?? 0.5),
      z: Number(primaryHand?.z ?? snapshot?.pointerZ ?? 0),
      confidence: primaryScore,
    });

    const primaryPointerX = relativePointer.x;
    const primaryPointerY = relativePointer.y;
    const primaryPointerZ = clamp(relativePointer.z, -0.45, 0.45);
    const pointingHand = Boolean(snapshot?.handSeen) && (
      (primaryGesture === 'Pointing_Up' && primaryScore >= 0.55) ||
      intent.intent === 'point_hold' ||
      screenKinematics.pointingConfidence >= 0.62
    );
    const handConfidence = primaryPinching
      ? Math.max(0.78, primaryScore, screenKinematics.pinchConfidence)
      : pointingHand
        ? Math.max(0.62, primaryScore, screenKinematics.pointingConfidence)
        : Math.max(0.5, primaryScore, screenKinematics.confidence * 0.82);

    return {
      intent,
      rawHands,
      primaryHand,
      primaryGesture,
      primaryScore,
      primaryPinching,
      screenKinematics,
      primaryPointerX,
      primaryPointerY,
      primaryPointerZ,
      pointingHand,
      handConfidence,
    };
  }, [deviceAdapter]);

  const resetVisionHandInput = useCallback(() => {
    gestureIntentTrackerRef.current.reset();
  }, []);

  return {
    updateVisionHandInput,
    resetVisionHandInput,
  };
}
