export type FaceSocialCue = 'none' | 'wink_left' | 'wink_right' | 'brow_raise' | 'smile';
export type FaceSocialAction = 'none' | 'toggle_affect' | 'cycle_theme';

export interface FaceGestureSocialSample {
  faceSeen: boolean;
  faceConfidence: number;
  gesture: string;
  gestureConfidence: number;
}

export interface FaceSocialEvent {
  eventId: number;
  cue: FaceSocialCue;
  action: FaceSocialAction;
  stableMs: number;
  confidence: number;
  at: number;
}

const EMPTY_EVENT: FaceSocialEvent = {
  eventId: 0,
  cue: 'none',
  action: 'none',
  stableMs: 0,
  confidence: 0,
  at: 0,
};

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

function supportedCue(value: string): FaceSocialCue {
  return value === 'wink_left' || value === 'wink_right' || value === 'brow_raise' || value === 'smile'
    ? value
    : 'none';
}

function gestureThreshold(cue: FaceSocialCue): number {
  if (cue === 'wink_left' || cue === 'wink_right') return 0.72;
  if (cue === 'brow_raise') return 0.68;
  if (cue === 'smile') return 0.62;
  return 1;
}

function requiredStableMs(cue: FaceSocialCue): number {
  if (cue === 'wink_left' || cue === 'wink_right') return 110;
  if (cue === 'brow_raise') return 260;
  if (cue === 'smile') return 420;
  return Number.POSITIVE_INFINITY;
}

function requiredFrames(cue: FaceSocialCue): number {
  return cue === 'wink_left' || cue === 'wink_right' ? 2 : 3;
}

function actionFor(cue: FaceSocialCue): FaceSocialAction {
  if (cue === 'wink_left') return 'toggle_affect';
  if (cue === 'wink_right') return 'cycle_theme';
  return 'none';
}

/**
 * Turns noisy facial-gesture classifications into deliberate, low-risk UI events.
 * It never infers intention from a single frame: face lock, confidence, temporal
 * stability, release and cooldown are all required before an action can fire.
 */
export class FaceSocialControlTracker {
  private candidate: FaceSocialCue = 'none';
  private candidateSince = 0;
  private candidateFrames = 0;
  private fired = false;
  private cooldownUntil = 0;
  private eventId = 0;

  update(sample: FaceGestureSocialSample, now = performance.now()): FaceSocialEvent {
    const cue = supportedCue(String(sample.gesture || 'none'));
    const faceConfidence = clamp01(sample.faceConfidence);
    const gestureConfidence = clamp01(sample.gestureConfidence);
    const valid =
      sample.faceSeen &&
      faceConfidence >= 0.62 &&
      cue !== 'none' &&
      gestureConfidence >= gestureThreshold(cue);

    if (!valid) {
      this.candidate = 'none';
      this.candidateSince = 0;
      this.candidateFrames = 0;
      this.fired = false;
      return { ...EMPTY_EVENT, eventId: this.eventId };
    }

    if (cue !== this.candidate) {
      this.candidate = cue;
      this.candidateSince = now;
      this.candidateFrames = 1;
      this.fired = false;
      return { ...EMPTY_EVENT, eventId: this.eventId };
    }

    this.candidateFrames += 1;
    const stableMs = Math.max(0, now - this.candidateSince);
    if (
      this.fired ||
      now < this.cooldownUntil ||
      this.candidateFrames < requiredFrames(cue) ||
      stableMs < requiredStableMs(cue)
    ) {
      return { ...EMPTY_EVENT, eventId: this.eventId };
    }

    this.fired = true;
    this.cooldownUntil = now + (cue === 'wink_left' || cue === 'wink_right' ? 1600 : 1100);
    this.eventId += 1;
    return {
      eventId: this.eventId,
      cue,
      action: actionFor(cue),
      stableMs,
      confidence: Math.min(faceConfidence, gestureConfidence),
      at: now,
    };
  }

  reset(): void {
    this.candidate = 'none';
    this.candidateSince = 0;
    this.candidateFrames = 0;
    this.fired = false;
    this.cooldownUntil = 0;
  }
}

export function gazePresenceLabel(state: string): string {
  if (state === 'focused') return 'Ánh nhìn · Kết nối';
  if (state === 'engaged') return 'Ánh nhìn · Hiện diện';
  if (state === 'looking_away') return 'Ánh nhìn · Lệch';
  if (state === 'returning') return 'Ánh nhìn · Quay lại';
  return 'Ánh nhìn · Hiệu chỉnh';
}
