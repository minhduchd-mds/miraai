import { useEffect, useRef, useState } from 'react';
import type { InteractionContext } from '../intelligence/social/interaction-engine';
import type { PresenceContinuityState } from '../intelligence/social/presence-continuity';
import {
  appendPresenceReturnSample,
  type PresenceReturnSample,
} from '../presence/presence-scene';
import {
  loadPresenceReturnSamples,
  savePresenceReturnSamples,
} from './app-preferences';

export function usePresenceReturnLearning(
  presenceContinuity: PresenceContinuityState,
  interactionState: InteractionContext['state'],
) {
  const [presenceClockMs, setPresenceClockMs] = useState(() => Date.now());
  const [presenceReturnSamples, setPresenceReturnSamples] = useState<PresenceReturnSample[]>(loadPresenceReturnSamples);
  const [recentReturnAt, setRecentReturnAt] = useState<number | null>(null);
  const previousReturnSignalRef = useRef(false);

  useEffect(() => {
    let timer = 0;
    const scheduleNextMinute = () => {
      const now = Date.now();
      const delay = Math.max(1_000, 60_000 - (now % 60_000) + 24);
      timer = window.setTimeout(() => {
        setPresenceClockMs(Date.now());
        scheduleNextMinute();
      }, delay);
    };
    scheduleNextMinute();
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const returnSignal = (
      presenceContinuity.cue === 'return'
      || presenceContinuity.mode === 'reconnect'
      || interactionState === 'returning'
    );

    if (returnSignal && !previousReturnSignalRef.current) {
      const now = new Date();
      const at = now.getTime();
      setRecentReturnAt(at);
      setPresenceClockMs(at);
      setPresenceReturnSamples((previous) => {
        const next = appendPresenceReturnSample(previous, now);
        if (next !== previous) savePresenceReturnSamples(next);
        return next;
      });
    }

    previousReturnSignalRef.current = returnSignal;
  }, [interactionState, presenceContinuity.cue, presenceContinuity.mode]);

  return { presenceClockMs, presenceReturnSamples, recentReturnAt };
}
