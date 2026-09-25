export type InteractionState =
  | 'engaged'
  | 'focused'
  | 'looking_away'
  | 'returning'
  | 'absent'
  | 'uncertain';

export interface InteractionSample {
  facePresent?: boolean;
  faceConfidence?: number;
  yaw?: number;
  pitch?: number;
  gazeX?: number;
  gazeY?: number;
  posturePresent?: boolean;
  postureConfidence?: number;
  postureMotion?: number;
  distanceM?: number;
}

export interface InteractionContext {
  state: InteractionState;
  attention: number;
  eyeContact: number;
  headAlignment: number;
  continuityMs: number;
  awayMs: number;
  lastAwayMs: number;
  confidence: number;
}

export const EMPTY_INTERACTION: InteractionContext = {
  state: 'uncertain',
  attention: 0,
  eyeContact: 0,
  headAlignment: 0,
  continuityMs: 0,
  awayMs: 0,
  lastAwayMs: 0,
  confidence: 0,
};

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

function normalizeAngle(rad: number, softLimit: number, hardLimit: number): number {
  const value = Math.abs(Number(rad) || 0);
  if (value <= softLimit) return 1;
  if (value >= hardLimit) return 0;
  return 1 - (value - softLimit) / Math.max(0.0001, hardLimit - softLimit);
}

/**
 * Joint-attention proxy from observable head/gaze/presence geometry.
 * It does not infer intention, comprehension or private mental state.
 */
export class InteractionTracker {
  private current: InteractionContext = { ...EMPTY_INTERACTION };
  private faceSince = 0;
  private awaySince = 0;
  private focusedSince = 0;
  private returnUntil = 0;
  private lastSeenAt = 0;
  private lastAwayMs = 0;

  update(sample: InteractionSample, now = performance.now()): InteractionContext {
    const facePresent = Boolean(sample.facePresent);
    const faceConfidence = clamp01(sample.faceConfidence ?? (facePresent ? 0.8 : 0));
    const postureConfidence = sample.posturePresent ? clamp01(sample.postureConfidence || 0) : 0;
    const motion = clamp01(sample.postureMotion || 0);

    if (!facePresent) {
      if (!this.awaySince) this.awaySince = now;
      if (this.faceSince) this.lastAwayMs = 0;
      this.faceSince = 0;
      this.focusedSince = 0;
      const awayMs = Math.max(0, now - this.awaySince);
      const state: InteractionState = awayMs >= 1200 ? 'absent' : 'uncertain';
      this.current = {
        state,
        attention: this.current.attention * 0.72,
        eyeContact: this.current.eyeContact * 0.66,
        headAlignment: this.current.headAlignment * 0.7,
        continuityMs: 0,
        awayMs,
        lastAwayMs: this.lastAwayMs,
        confidence: clamp01(faceConfidence * 0.2 + postureConfidence * 0.15),
      };
      return { ...this.current };
    }

    if (!this.faceSince) {
      this.faceSince = now;
      if (this.awaySince) {
        this.lastAwayMs = Math.max(0, now - this.awaySince);
        this.returnUntil = now + Math.min(2200, Math.max(850, this.lastAwayMs * 0.15));
      }
    }
    this.lastSeenAt = now;
    this.awaySince = 0;

    // MediaPipe gaze proxies are blendshape-derived, so keep the window fairly tolerant.
    const gazeMagnitude = Math.hypot(Number(sample.gazeX || 0), Number(sample.gazeY || 0));
    const eyeContact = clamp01(1 - gazeMagnitude / 0.62);
    const yawAlignment = normalizeAngle(Number(sample.yaw || 0), 0.12, 0.72);
    const pitchAlignment = normalizeAngle(Number(sample.pitch || 0), 0.1, 0.58);
    const headAlignment = clamp01(yawAlignment * 0.64 + pitchAlignment * 0.36);

    const distance = Number(sample.distanceM || 0);
    const distanceFit = distance > 0
      ? clamp01(1 - Math.abs(distance - 0.82) / 1.25)
      : 0.62;
    const motionStability = clamp01(1 - motion * 0.72);

    const rawAttention = clamp01(
      eyeContact * 0.42 +
      headAlignment * 0.34 +
      distanceFit * 0.12 +
      motionStability * 0.12,
    );

    const alpha = rawAttention > this.current.attention ? 0.28 : 0.16;
    const attention = this.current.attention + (rawAttention - this.current.attention) * alpha;
    const continuityMs = Math.max(0, now - this.faceSince);
    const lookingAway = eyeContact < 0.34 || headAlignment < 0.38;

    if (attention >= 0.76 && eyeContact >= 0.58 && headAlignment >= 0.64) {
      if (!this.focusedSince) this.focusedSince = now;
    } else {
      this.focusedSince = 0;
    }

    let state: InteractionState = 'engaged';
    if (now <= this.returnUntil) state = 'returning';
    else if (lookingAway && continuityMs >= 700) state = 'looking_away';
    else if (this.focusedSince && now - this.focusedSince >= 1400) state = 'focused';
    else if (attention < 0.42) state = 'uncertain';

    const confidence = clamp01(
      faceConfidence * 0.66 +
      postureConfidence * 0.12 +
      headAlignment * 0.12 +
      eyeContact * 0.1,
    );

    this.current = {
      state,
      attention,
      eyeContact,
      headAlignment,
      continuityMs,
      awayMs: 0,
      lastAwayMs: this.lastAwayMs,
      confidence,
    };
    return { ...this.current };
  }

  reset(): void {
    this.current = { ...EMPTY_INTERACTION };
    this.faceSince = 0;
    this.awaySince = 0;
    this.focusedSince = 0;
    this.returnUntil = 0;
    this.lastSeenAt = 0;
    this.lastAwayMs = 0;
  }
}

export function interactionPrompt(context: InteractionContext): string {
  if (context.confidence < 0.42) return '';
  if (context.state === 'absent') {
    return 'Camera không còn thấy khuôn mặt ổn định; đừng chủ động nói cho đến khi người dùng quay lại.';
  }
  if (context.state === 'looking_away') {
    return 'Gaze/head proxy cho thấy người dùng đang nhìn lệch khỏi màn hình; ưu tiên im lặng hoặc câu trả lời ngắn, không suy diễn lý do.';
  }
  if (context.state === 'returning') {
    return 'Người dùng vừa quay lại khung camera sau một quãng vắng; tiếp tục tự nhiên, không làm quá việc chào mừng.';
  }
  if (context.state === 'focused') {
    return 'Gaze/head proxy đang khá ổn định về phía màn hình; có thể giữ mức chi tiết bình thường nếu nội dung cần.';
  }
  if (context.state === 'engaged') {
    return 'Tín hiệu hiện diện và hướng nhìn tương đối ổn định; tiếp tục hội thoại tự nhiên.';
  }
  return '';
}
