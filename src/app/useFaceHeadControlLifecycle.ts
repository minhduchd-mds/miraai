import { useCallback, useRef } from 'react';
import {
  resolveFaceControlAction,
  type FaceControlAction,
} from '../intelligence/affect/affect-control';

type FaceHeadControlSample = {
  faceSeen: boolean;
  faceConfidence: number;
  headGesture: string;
  state: string;
  voiceReady: boolean;
  spatialHeadConsumedAt: number;
};

export function useFaceHeadControlLifecycle() {
  const lastHeadGestureRef = useRef('none');
  const lastFaceActionAtRef = useRef(0);

  const updateFaceHeadControl = useCallback((
    sample: FaceHeadControlSample,
    now: number,
  ): FaceControlAction => {
    const headGesture = String(sample.headGesture || 'none');
    if (headGesture === 'none') {
      lastHeadGestureRef.current = 'none';
      return 'none';
    }
    if (headGesture === lastHeadGestureRef.current) return 'none';

    lastHeadGestureRef.current = headGesture;
    if (now - sample.spatialHeadConsumedAt < 520) return 'none';

    const action = resolveFaceControlAction({
      faceSeen: sample.faceSeen,
      faceConfidence: sample.faceConfidence,
      headGesture,
      state: sample.state,
      voiceReady: sample.voiceReady,
    });

    if (action === 'none' || now - lastFaceActionAtRef.current < 1_400) return 'none';
    lastFaceActionAtRef.current = now;
    return action;
  }, []);

  const resetFaceHeadControl = useCallback(() => {
    lastHeadGestureRef.current = 'none';
    lastFaceActionAtRef.current = 0;
  }, []);

  return {
    updateFaceHeadControl,
    resetFaceHeadControl,
  };
}
