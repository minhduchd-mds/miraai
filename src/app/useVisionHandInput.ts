import { useCallback, useRef } from 'react';
import { GestureIntentTracker } from '../core/vision/gesture-intent';
import { StablePrimaryHandRuntime } from './spatial-primary-hand';
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
  const primarySessionRef = useRef(new StablePrimaryHandRuntime());
  const lastHandFrameRef = useRef(0);

  const updateVisionHandInput = useCallback((snapshot: VisionSnapshot | undefined, now: number) => {
    const frameAt = Number(snapshot?.handFrameAt || 0);
    // A worker may deliver a frame out of order while the UI is polling.
    // Only a newer, recently inferred frame can advance gesture timers.
    const freshFrame = Number.isFinite(frameAt) && frameAt > 0 &&
      frameAt <= now && now - frameAt <= 350;
    const reversed = frameAt > 0 && frameAt < lastHandFrameRef.current;
    const newFrame = freshFrame && frameAt > lastHandFrameRef.current;
    const rawHands = freshFrame && !reversed && Array.isArray(snapshot?.hands)
      ? snapshot.hands : [];
    if (!freshFrame || reversed) {
      gestureIntentTrackerRef.current.reset();
      primarySessionRef.current.reset();
    }
    if (newFrame) lastHandFrameRef.current = frameAt;
    // A zero frame signals tracking loss, not a clock reset. Only the
    // explicit stop/restart path may reset this high-water mark.
    const selection = primarySessionRef.current.update(
      snapshot?.handSeen ? rawHands : [],
      now,
    );
    const primaryHand = selection.hand;
    // Do not carry a pending gesture across a hand switch or camera dropout.
    if (!primaryHand || selection.switched) gestureIntentTrackerRef.current.reset();
    const primaryGesture = String(primaryHand?.gesture || 'None');
    const primaryScore = Number(primaryHand?.score ?? 0);
    const primaryPinching = Boolean(primaryHand?.pinching && selection.pinchAllowed);
    const intent = newFrame || !primaryHand
      ? gestureIntentTrackerRef.current.update({
      gesture: primaryGesture,
      score: primaryScore,
      pinching: primaryPinching,
      wave: Boolean(snapshot?.wave && primaryHand),
    }, now)
      : { eventId: 0, intent: 'none' as const, gesture: primaryGesture,
          confidence: 0, stableMs: 0, at: now };
    const rawKinematics = primaryHand?.kinematics as SpatialHandKinematicsState | undefined;
    const screenKinematics = rawKinematics?.present
      ? mirrorSpatialHandKinematicsX(rawKinematics)
      : {
          ...EMPTY_HAND_KINEMATICS,
          handedness: String(primaryHand?.handedness || 'none'),
          at: now,
        };

    const relativePointer = deviceAdapter.webcamPoint({
      x: Number(primaryHand?.pointerX ?? 0.5),
      y: Number(primaryHand?.pointerY ?? 0.5),
      z: Number(primaryHand?.z ?? 0),
      confidence: primaryScore,
    });

    const primaryPointerX = relativePointer.x;
    const primaryPointerY = relativePointer.y;
    const primaryPointerZ = clamp(relativePointer.z, -0.45, 0.45);
    const pointingHand = Boolean(snapshot?.handSeen && primaryHand) && (
      (primaryGesture === 'Pointing_Up' && primaryScore >= 0.55) ||
      intent.intent === 'point_hold' ||
      screenKinematics.pointingConfidence >= 0.62
    );
    const handConfidence = !primaryHand ? 0 : primaryPinching
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
    primarySessionRef.current.reset();
    lastHandFrameRef.current = 0;
  }, []);

  return {
    updateVisionHandInput,
    resetVisionHandInput,
  };
}
