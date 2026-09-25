export type GestureIntent =
  | 'none'
  | 'pinch_down'
  | 'pinch_up'
  | 'open_palm_hold'
  | 'victory_hold'
  | 'fist_hold'
  | 'point_hold'
  | 'thumb_up_hold'
  | 'wave';

export interface GestureIntentSample {
  gesture: string;
  score: number;
  pinching: boolean;
  wave?: boolean;
}

export interface GestureIntentState {
  eventId: number;
  intent: GestureIntent;
  gesture: string;
  confidence: number;
  stableMs: number;
  at: number;
}

const HOLD_MS: Record<string, number> = {
  Open_Palm: 650,
  Victory: 420,
  Closed_Fist: 480,
  Pointing_Up: 340,
  Thumb_Up: 420,
};

const INTENT_BY_GESTURE: Record<string, GestureIntent> = {
  Open_Palm: 'open_palm_hold',
  Victory: 'victory_hold',
  Closed_Fist: 'fist_hold',
  Pointing_Up: 'point_hold',
  Thumb_Up: 'thumb_up_hold',
};

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

/**
 * Converts noisy frame-level gestures into debounced temporal intent events.
 * Intent means "stable enough to use as a UI control", not human intention.
 */
export class GestureIntentTracker {
  private candidate = 'None';
  private candidateSince = 0;
  private candidateScore = 0;
  private emittedCandidate = '';
  private previousPinching = false;
  private pinchSince = 0;
  private eventId = 0;
  private lastEventAt = -Infinity;
  private current: GestureIntentState = {
    eventId: 0,
    intent: 'none',
    gesture: 'None',
    confidence: 0,
    stableMs: 0,
    at: 0,
  };

  private emit(intent: GestureIntent, gesture: string, confidence: number, stableMs: number, now: number): GestureIntentState {
    this.eventId += 1;
    this.lastEventAt = now;
    this.current = {
      eventId: this.eventId,
      intent,
      gesture,
      confidence: clamp01(confidence),
      stableMs: Math.max(0, stableMs),
      at: now,
    };
    return { ...this.current };
  }

  update(sample: GestureIntentSample, now = performance.now()): GestureIntentState {
    const gesture = sample.score >= 0.48 ? String(sample.gesture || 'None') : 'None';
    const score = clamp01(sample.score || 0);

    if (sample.wave && now - this.lastEventAt >= 700) {
      return this.emit('wave', 'Open_Palm', Math.max(0.7, score), 0, now);
    }

    if (sample.pinching) {
      if (!this.previousPinching) this.pinchSince = now;
      if (!this.previousPinching && now - this.lastEventAt >= 180) {
        this.previousPinching = true;
        return this.emit('pinch_down', gesture, Math.max(0.72, score), 0, now);
      }
    } else if (this.previousPinching) {
      const heldMs = Math.max(0, now - this.pinchSince);
      this.previousPinching = false;
      this.pinchSince = 0;
      if (now - this.lastEventAt >= 120) {
        return this.emit('pinch_up', gesture, Math.max(0.7, score), heldMs, now);
      }
    }

    if (gesture !== this.candidate) {
      this.candidate = gesture;
      this.candidateSince = now;
      this.candidateScore = score;
      this.emittedCandidate = '';
    } else {
      this.candidateScore += (score - this.candidateScore) * 0.32;
    }

    const stableMs = this.candidateSince ? Math.max(0, now - this.candidateSince) : 0;
    const holdMs = HOLD_MS[gesture];
    const intent = INTENT_BY_GESTURE[gesture];

    if (
      holdMs &&
      intent &&
      this.emittedCandidate !== gesture &&
      stableMs >= holdMs &&
      this.candidateScore >= 0.56 &&
      now - this.lastEventAt >= 650
    ) {
      this.emittedCandidate = gesture;
      return this.emit(intent, gesture, this.candidateScore, stableMs, now);
    }

    this.current = {
      eventId: this.eventId,
      intent: 'none',
      gesture,
      confidence: this.candidateScore,
      stableMs,
      at: now,
    };
    return { ...this.current };
  }

  reset(): void {
    this.candidate = 'None';
    this.candidateSince = 0;
    this.candidateScore = 0;
    this.emittedCandidate = '';
    this.previousPinching = false;
    this.pinchSince = 0;
    this.current = {
      eventId: this.eventId,
      intent: 'none',
      gesture: 'None',
      confidence: 0,
      stableMs: 0,
      at: 0,
    };
  }
}
