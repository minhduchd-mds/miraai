export type PresenceMode = 'ambient' | 'attentive' | 'quiet' | 'reconnect';
export type PresenceMicroCue = 'none' | 'return' | 'focus' | 'smile' | 'brow';

export interface PresenceContinuitySample {
  faceSeen: boolean;
  interactionState: string;
  attention: number;
  socialCue?: string;
}

export interface PresenceContinuityState {
  mode: PresenceMode;
  cue: PresenceMicroCue;
  cueId: number;
  presentMs: number;
  absentMs: number;
  focusedMs: number;
  lastAwayMs: number;
  continuity: number;
  at: number;
}

export const EMPTY_PRESENCE_CONTINUITY: PresenceContinuityState = {
  mode: 'ambient',
  cue: 'none',
  cueId: 0,
  presentMs: 0,
  absentMs: 0,
  focusedMs: 0,
  lastAwayMs: 0,
  continuity: 0,
  at: 0,
};

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

/**
 * session-local continuity model for subtle presence responses.
 * It stores no camera frames, biometric template, identity embedding or durable
 * emotion history. State disappears when the page/session is reset.
 */
export class PresenceContinuityTracker {
  private presentSince = 0;
  private absentSince = 0;
  private focusedSince = 0;
  private focusLatched = false;
  private lastAwayMs = 0;
  private reconnectUntil = 0;
  private cue: PresenceMicroCue = 'none';
  private cueUntil = 0;
  private cueId = 0;
  private lastSocialCue = 'none';

  private pulse(cue: PresenceMicroCue, now: number, durationMs: number): void {
    this.cue = cue;
    this.cueUntil = now + durationMs;
    this.cueId += 1;
  }

  update(sample: PresenceContinuitySample, now = performance.now()): PresenceContinuityState {
    const faceSeen = Boolean(sample.faceSeen);
    const absent = !faceSeen || sample.interactionState === 'absent';
    const attention = clamp01(sample.attention);
    const socialCue = String(sample.socialCue || 'none');

    if (absent) {
      if (!this.absentSince) this.absentSince = now;
      this.presentSince = 0;
      this.focusedSince = 0;
      this.focusLatched = false;
      if (socialCue === 'none') this.lastSocialCue = 'none';
      if (now > this.cueUntil) this.cue = 'none';
      const absentMs = Math.max(0, now - this.absentSince);
      return {
        mode: absentMs >= 1200 ? 'quiet' : 'ambient',
        cue: this.cue,
        cueId: this.cueId,
        presentMs: 0,
        absentMs,
        focusedMs: 0,
        lastAwayMs: this.lastAwayMs,
        continuity: clamp01(0.28 - Math.min(absentMs, 10_000) / 45_000),
        at: now,
      };
    }

    if (!this.presentSince) {
      this.presentSince = now;
      if (this.absentSince) {
        this.lastAwayMs = Math.max(0, now - this.absentSince);
        if (this.lastAwayMs >= 2500) {
          this.reconnectUntil = now + Math.min(2200, 1150 + this.lastAwayMs * 0.04);
          this.pulse('return', now, 1050);
        }
      }
    }
    this.absentSince = 0;

    if (socialCue === 'none') {
      this.lastSocialCue = 'none';
    } else if (socialCue !== this.lastSocialCue) {
      this.lastSocialCue = socialCue;
      if (socialCue === 'smile') this.pulse('smile', now, 760);
      if (socialCue === 'brow_raise') this.pulse('brow', now, 620);
    }

    const focused = sample.interactionState === 'focused' && attention >= 0.72;
    if (focused) {
      if (!this.focusedSince) this.focusedSince = now;
      if (!this.focusLatched && now - this.focusedSince >= 1800) {
        this.focusLatched = true;
        this.pulse('focus', now, 720);
      }
    } else {
      this.focusedSince = 0;
      this.focusLatched = false;
    }

    if (now > this.cueUntil) this.cue = 'none';

    const presentMs = Math.max(0, now - this.presentSince);
    const focusedMs = this.focusedSince ? Math.max(0, now - this.focusedSince) : 0;
    const reconnecting = now < this.reconnectUntil;
    const attentive =
      sample.interactionState === 'focused' ||
      (sample.interactionState === 'engaged' && attention >= 0.58);

    return {
      mode: reconnecting ? 'reconnect' : attentive ? 'attentive' : 'ambient',
      cue: this.cue,
      cueId: this.cueId,
      presentMs,
      absentMs: 0,
      focusedMs,
      lastAwayMs: this.lastAwayMs,
      continuity: clamp01(
        (reconnecting ? 0.62 : 0.38) +
        attention * 0.34 +
        Math.min(1, presentMs / 12_000) * 0.2,
      ),
      at: now,
    };
  }

  reset(): void {
    this.presentSince = 0;
    this.absentSince = 0;
    this.focusedSince = 0;
    this.focusLatched = false;
    this.lastAwayMs = 0;
    this.reconnectUntil = 0;
    this.cue = 'none';
    this.cueUntil = 0;
    this.lastSocialCue = 'none';
  }
}

export function presenceContinuityPrompt(state: PresenceContinuityState): string {
  if (state.mode === 'reconnect' && state.lastAwayMs >= 2500) {
    return 'Người dùng vừa quay lại sau khi rời khung một lúc. Tiếp tục tự nhiên từ mạch trước; không cần chào lại trừ khi quãng vắng thực sự dài.';
  }
  if (state.mode === 'attentive' && state.focusedMs >= 1800) {
    return 'Presence proxy đang ổn định; giữ nhịp hội thoại tự nhiên và không bình luận liên tục về ánh nhìn.';
  }
  if (state.mode === 'quiet') {
    return 'Người dùng hiện ngoài khung; không chủ động phát lời chỉ vì camera không thấy mặt.';
  }
  return '';
}
