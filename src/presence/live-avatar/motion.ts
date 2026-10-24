// Mira LiveAvatar — behaviour layer: turns conversation state + audio into FaceParams.
// Pure and clock-driven (time is passed in) so it is deterministic under test.
import { NEUTRAL_FACE, visemeFromAudio, type FaceParams } from './rig-deform.ts';

export type AvatarState = 'idle' | 'listening' | 'thinking' | 'speaking' | 'interrupted' | 'error';

export interface MotionInput {
  timeMs: number;
  state: AvatarState;
  /** Output (Mira's voice) level 0..1 when audio is playing, else -1. */
  voiceLevel: number;
  voiceBands: { low: number; mid: number; high: number } | null;
  /** Microphone level 0..1 while the user talks, else 0. */
  userLevel: number;
  reducedMotion: boolean;
  /** User's observed expression (camera, opt-in "Phản ứng"): Mira responds with empathy, not mimicry. */
  userMood?: 'happy' | 'sad' | 'tired' | 'angry' | 'surprised' | 'neutral';
  /**
   * Mira's reply is audible but no analyser level exists (AudioContext still locked, device
   * voice). The mouth then follows a procedural syllable rhythm instead of freezing shut.
   */
  voiceAudible?: boolean;
  /** Pointer/touch position, -1..1 from the stage centre (null when away). Eyes follow it. */
  lookAt?: { x: number; y: number } | null;
}

/** Small expression offsets: warmer smile for joy, softer face + concerned brows for sadness/fatigue,
 *  calm attention (never anger back), raised brows for surprise. */
export const EMPATHY_OFFSETS: Record<NonNullable<MotionInput['userMood']>, { smile: number; brow: number }> = {
  happy: { smile: 0.18, brow: 0.05 },
  sad: { smile: -0.14, brow: 0.25 },
  tired: { smile: -0.08, brow: 0.12 },
  angry: { smile: -0.12, brow: 0.1 },
  surprised: { smile: 0.04, brow: 0.35 },
  neutral: { smile: 0, brow: 0 },
};

/** Seeded PRNG so blink timing is natural but reproducible in tests. */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class AvatarMotion {
  private params: FaceParams = { ...NEUTRAL_FACE };
  private rand: () => number;
  private nextBlinkAt = 0;
  private blinkStart = -1;
  private nextSaccadeAt = 0;
  private gazeTarget = { x: 0, y: 0 };
  private envelope = 0;
  private lastT = 0;
  // Procedural speech (no analyser level): syllable oscillator with phrase pauses.
  private syllablePhase = 0;
  private syllableRate = 5;
  private syllableShape = { round: 0, spread: 0 };
  private phrasePauseUntil = 0;
  private nextPhrasePauseAt = 0;
  // Emphasis: a fast rise in loudness (a stressed syllable) lifts the brows and nods once.
  private fastEnv = 0;
  private emphasis = 0;
  private nodKick = 0;
  // Listening backchannel: a small nod + smile when the user pauses after speaking.
  private userTalkMs = 0;
  private userQuietMs = 0;
  private ackPulse = 0;

  constructor(seed = 1) {
    this.rand = mulberry32(seed);
  }

  /** Smooth towards `target` with separate attack/release time constants (seconds). */
  private ease(current: number, target: number, dt: number, attack: number, release: number) {
    const tau = target > current ? attack : release;
    return current + (target - current) * (1 - Math.exp(-dt / Math.max(1e-3, tau)));
  }

  /** Syllable-rate loudness (~4–6.5 syl/s, Vietnamese is syllable-timed) with phrase pauses. */
  private proceduralVoice(t: number, dt: number): { level: number; bands: { low: number; mid: number; high: number } } {
    if (!this.nextPhrasePauseAt) this.nextPhrasePauseAt = t + 1.4 + this.rand() * 1.6;
    if (t >= this.nextPhrasePauseAt) {
      this.phrasePauseUntil = t + 0.18 + this.rand() * 0.22;
      this.nextPhrasePauseAt = this.phrasePauseUntil + 1.2 + this.rand() * 1.8;
    }
    if (t < this.phrasePauseUntil) return { level: 0, bands: { low: 0, mid: 0, high: 0 } };
    const before = this.syllablePhase;
    this.syllablePhase += dt * this.syllableRate;
    if (Math.floor(this.syllablePhase) !== Math.floor(before)) {
      // New syllable: new rate and vowel colour (o/u rounds, i/e spreads, a opens).
      this.syllableRate = 4.2 + this.rand() * 2.3;
      const v = this.rand();
      this.syllableShape = v < 0.3 ? { round: 0.7, spread: 0 } : v < 0.6 ? { round: 0, spread: 0.7 } : { round: 0.1, spread: 0.15 };
    }
    const f = this.syllablePhase % 1;
    // Fast open, slower close; never fully silent mid-phrase.
    const level = 0.12 + 0.78 * Math.pow(Math.sin(Math.PI * Math.min(1, f * 1.15)), 1.4);
    const { round, spread } = this.syllableShape;
    return { level, bands: { low: 0.35 + round * 0.5, mid: 0.4, high: 0.2 + spread * 0.6 } };
  }

  update(input: MotionInput): FaceParams {
    const t = input.timeMs / 1000;
    const dt = this.lastT ? Math.min(0.1, Math.max(0, t - this.lastT)) : 1 / 60;
    this.lastT = t;
    const p = this.params;
    const motion = input.reducedMotion ? 0.25 : 1;
    const measured = input.state === 'speaking' && input.voiceLevel >= 0;
    const procedural = input.state === 'speaking' && !measured && input.voiceAudible === true;
    const speaking = measured || procedural;

    // Mouth: driven only by Mira's own voice (or its procedural stand-in), never by the mic.
    let level = 0;
    let bands: MotionInput['voiceBands'] = null;
    if (measured) {
      // Speech RMS rarely exceeds ~0.6: expand it so syllables visibly open and close.
      level = Math.min(1, Math.pow(Math.max(0, input.voiceLevel), 0.72) * 1.3);
      bands = input.voiceBands;
    } else if (procedural) {
      const v = this.proceduralVoice(t, dt);
      level = v.level * motion;
      bands = v.bands;
    }
    const mouth = speaking ? visemeFromAudio(level, bands) : { jaw: 0, round: 0, spread: 0 };
    p.jaw = this.ease(p.jaw, mouth.jaw, dt, 0.03, 0.055);
    p.round = this.ease(p.round, mouth.round, dt, 0.045, 0.08);
    p.spread = this.ease(p.spread, mouth.spread, dt, 0.045, 0.08);
    this.envelope = this.ease(this.envelope, speaking ? level : 0, dt, 0.25, 0.6);

    // Emphasis: fast envelope well above the slow one = a stressed syllable.
    this.fastEnv = this.ease(this.fastEnv, speaking ? level : 0, dt, 0.04, 0.12);
    if (speaking && this.fastEnv - this.envelope > 0.22 && this.emphasis < 0.2) {
      this.emphasis = 1;
      this.nodKick = 1;
    }
    this.emphasis = Math.max(0, this.emphasis - dt * 2.2);
    this.nodKick = Math.max(0, this.nodKick - dt * 3.5);

    // Listening backchannel: user spoke ≥ 0.6 s, then paused ≥ 0.3 s → nod + smile once.
    if (input.state === 'listening') {
      if (input.userLevel > 0.12) { this.userTalkMs += dt * 1000; this.userQuietMs = 0; }
      else {
        this.userQuietMs += dt * 1000;
        if (this.userTalkMs > 600 && this.userQuietMs > 300) { this.ackPulse = 1; this.userTalkMs = 0; }
      }
    } else { this.userTalkMs = 0; this.userQuietMs = 0; }
    this.ackPulse = Math.max(0, this.ackPulse - dt * 1.6);

    // Expression: warm resting smile, a touch more while listening to the user.
    const empathy = EMPATHY_OFFSETS[input.userMood || 'neutral'];
    const smileTarget = Math.max(0.06, (input.state === 'listening' ? 0.38 : input.state === 'thinking' ? 0.12 : 0.28) + empathy.smile + this.ackPulse * 0.15);
    p.smile = this.ease(p.smile, smileTarget * (1 - p.jaw * 0.55), dt, 0.35, 0.55);
    const browTarget = Math.min(0.75, (input.state === 'thinking' ? 0.35 : speaking ? this.envelope * 0.45 + this.emphasis * 0.35 : input.state === 'listening' ? 0.18 + this.ackPulse * 0.15 : 0) + empathy.brow);
    p.brow = this.ease(p.brow, browTarget, dt, 0.1, 0.35);

    // Blinks: every 2.2–5.8 s, 120 ms down / 160 ms up; double blink sometimes.
    if (!this.nextBlinkAt) this.nextBlinkAt = t + 1.2 + this.rand() * 2;
    if (this.blinkStart < 0 && t >= this.nextBlinkAt) this.blinkStart = t;
    let blink = 0;
    if (this.blinkStart >= 0) {
      const e = t - this.blinkStart;
      blink = e < 0.12 ? e / 0.12 : e < 0.28 ? 1 - (e - 0.12) / 0.16 : 0;
      if (e >= 0.28) {
        this.blinkStart = -1;
        this.nextBlinkAt = t + (this.rand() < 0.15 ? 0.25 : 2.2 + this.rand() * 3.6);
      }
    }
    p.blinkL = blink;
    p.blinkR = blink;

    // Gaze: follows the user's pointer when present (interactive), else mostly at the viewer
    // with small saccades; looks up/aside while thinking.
    const thinking = input.state === 'thinking';
    if (t >= this.nextSaccadeAt) {
      this.gazeTarget = thinking
        ? { x: (this.rand() - 0.5) * 0.9, y: -0.55 - this.rand() * 0.3 }
        : { x: (this.rand() - 0.5) * 0.35, y: (this.rand() - 0.5) * 0.25 };
      this.nextSaccadeAt = t + (thinking ? 0.9 : 1.4) + this.rand() * 1.8;
    }
    const look = !thinking && input.lookAt ? input.lookAt : null;
    const gx = look ? Math.max(-1, Math.min(1, look.x * 0.85)) + this.gazeTarget.x * 0.2 : this.gazeTarget.x;
    const gy = look ? Math.max(-1, Math.min(1, look.y * 0.7)) + this.gazeTarget.y * 0.2 : this.gazeTarget.y;
    p.gazeX = this.ease(p.gazeX, gx * motion, dt, 0.06, 0.06);
    p.gazeY = this.ease(p.gazeY, gy * motion, dt, 0.06, 0.06);

    // Head: layered slow sines + speech sway/nods (stronger on stressed syllables) + listening
    // tilt and acknowledgement nods + a slight turn towards the pointer. Stays within ±0.08.
    const idleYaw = (Math.sin(t * 0.37) * 0.6 + Math.sin(t * 0.91 + 1.3) * 0.4) * 0.026;
    const idlePitch = (Math.sin(t * 0.43 + 0.7) * 0.6 + Math.sin(t * 1.17) * 0.4) * 0.018;
    const idleRoll = Math.sin(t * 0.29 + 2.1) * 0.016;
    const nod = speaking ? Math.sin(t * 5.2) * this.envelope * 0.04 + this.nodKick * 0.03 : 0;
    const ackNod = Math.sin((1 - this.ackPulse) * Math.PI * 2) * this.ackPulse * 0.035;
    const listenTilt = input.state === 'listening' ? 0.035 + input.userLevel * 0.02 : 0;
    const lookYaw = look ? look.x * 0.025 : 0;
    const lookPitch = look ? look.y * 0.015 : 0;
    const clampHead = (v: number) => Math.max(-0.08, Math.min(0.08, v));
    p.yaw = this.ease(p.yaw, clampHead((idleYaw + lookYaw + (speaking ? Math.sin(t * 2.3) * this.envelope * 0.032 : 0)) * motion), dt, 0.22, 0.25);
    p.pitch = this.ease(p.pitch, clampHead((idlePitch + nod + ackNod + lookPitch) * motion), dt, 0.1, 0.18);
    p.roll = this.ease(p.roll, clampHead((idleRoll + listenTilt + (speaking ? Math.sin(t * 0.8 + 0.4) * this.envelope * 0.02 : 0)) * motion), dt, 0.45, 0.55);
    p.breath = Math.sin(t * (speaking ? 1.9 : 1.35)) * (0.55 * motion);
    return p;
  }
}
