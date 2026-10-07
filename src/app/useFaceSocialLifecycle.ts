import { useCallback, useEffect, useRef, useState } from 'react';
import {
  FaceSocialControlTracker,
  type FaceSocialCue,
  type FaceSocialEvent,
} from '../intelligence/social/face-social-control';
import {
  EMPTY_PRESENCE_CONTINUITY,
  PresenceContinuityTracker,
  type PresenceContinuityState,
} from '../intelligence/social/presence-continuity';

type FaceSocialLifecycleSample = {
  faceSeen: boolean;
  faceConfidence: number;
  gesture: string;
  gestureConfidence: number;
  interactionState: string;
  attention: number;
};

export function useFaceSocialLifecycle() {
  const faceSocialTrackerRef = useRef(new FaceSocialControlTracker());
  const presenceContinuityRef = useRef(new PresenceContinuityTracker());
  const [faceSocialCue, setFaceSocialCue] = useState<FaceSocialCue>('none');
  const [presenceContinuity, setPresenceContinuity] = useState<PresenceContinuityState>(
    () => ({ ...EMPTY_PRESENCE_CONTINUITY }),
  );
  const cueTimerRef = useRef<number | null>(null);

  const clearCueTimer = useCallback(() => {
    if (cueTimerRef.current != null) {
      window.clearTimeout(cueTimerRef.current);
      cueTimerRef.current = null;
    }
  }, []);

  const updateFaceSocial = useCallback((
    sample: FaceSocialLifecycleSample,
    now: number,
  ): { socialEvent: FaceSocialEvent; continuity: PresenceContinuityState } => {
    const socialEvent = faceSocialTrackerRef.current.update({
      faceSeen: sample.faceSeen,
      faceConfidence: sample.faceConfidence,
      gesture: sample.gesture,
      gestureConfidence: sample.gestureConfidence,
    }, now);

    if (socialEvent.eventId > 0 && socialEvent.cue !== 'none') {
      setFaceSocialCue(socialEvent.cue);
      clearCueTimer();
      cueTimerRef.current = window.setTimeout(() => {
        cueTimerRef.current = null;
        setFaceSocialCue('none');
      }, 720);
    }

    const continuity = presenceContinuityRef.current.update({
      faceSeen: sample.faceSeen,
      interactionState: sample.interactionState,
      attention: sample.attention,
      socialCue: socialEvent.cue,
    }, now);
    setPresenceContinuity(continuity);

    return { socialEvent, continuity };
  }, [clearCueTimer]);

  const resetFaceSocial = useCallback(() => {
    faceSocialTrackerRef.current.reset();
    presenceContinuityRef.current.reset();
    clearCueTimer();
    setFaceSocialCue('none');
    setPresenceContinuity({ ...EMPTY_PRESENCE_CONTINUITY });
  }, [clearCueTimer]);

  useEffect(() => () => clearCueTimer(), [clearCueTimer]);

  return {
    faceSocialCue,
    presenceContinuity,
    updateFaceSocial,
    resetFaceSocial,
  };
}
