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

  constructor(seed = 1) {
    this.rand = mulberry32(seed);
  }

  /** Smooth towards `target` with separate attack/release time constants (seconds). */
  private ease(current: number, target: number, dt: number, attack: number, release: number) {
    const tau = target > current ? attack : release;
    return current + (target - current) * (1 - Math.exp(-dt / Math.max(1e-3, tau)));
  }

  update(input: MotionInput): FaceParams {
    const t = input.timeMs / 1000;
    const dt = this.lastT ? Math.min(0.1, Math.max(0, t - this.lastT)) : 1 / 60;
    this.lastT = t;
    const p = this.params;
    const motion = input.reducedMotion ? 0.25 : 1;
    const speaking = input.state === 'speaking' && input.voiceLevel >= 0;

    // Mouth: driven only by Mira's own voice, never by the microphone.
    const mouth = speaking ? visemeFromAudio(input.voiceLevel, input.voiceBands) : { jaw: 0, round: 0, spread: 0 };
    p.jaw = this.ease(p.jaw, mouth.jaw, dt, 0.035, 0.07);
    p.round = this.ease(p.round, mouth.round, dt, 0.05, 0.09);
    p.spread = this.ease(p.spread, mouth.spread, dt, 0.05, 0.09);
    this.envelope = this.ease(this.envelope, speaking ? input.voiceLevel : 0, dt, 0.25, 0.6);

    // Expression: warm resting smile, a touch more while listening to the user.
    const empathy = EMPATHY_OFFSETS[input.userMood || 'neutral'];
    const smileTarget = Math.max(0.06, (input.state === 'listening' ? 0.38 : input.state === 'thinking' ? 0.12 : 0.28) + empathy.smile);
    p.smile = this.ease(p.smile, smileTarget * (1 - p.jaw * 0.6), dt, 0.4, 0.6);
    const browTarget = Math.min(0.75, (input.state === 'thinking' ? 0.35 : speaking ? this.envelope * 0.5 : input.state === 'listening' ? 0.18 : 0) + empathy.brow);
    p.brow = this.ease(p.brow, browTarget, dt, 0.18, 0.4);

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

    // Gaze: mostly at the viewer; small saccades, looks up/aside while thinking.
    if (t >= this.nextSaccadeAt) {
      const thinking = input.state === 'thinking';
      this.gazeTarget = thinking
        ? { x: (this.rand() - 0.5) * 0.9, y: -0.55 - this.rand() * 0.3 }
        : { x: (this.rand() - 0.5) * 0.35, y: (this.rand() - 0.5) * 0.25 };
      this.nextSaccadeAt = t + (thinking ? 0.9 : 1.4) + this.rand() * 1.8;
    }
    p.gazeX = this.ease(p.gazeX, this.gazeTarget.x * motion, dt, 0.06, 0.06);
    p.gazeY = this.ease(p.gazeY, this.gazeTarget.y * motion, dt, 0.06, 0.06);

    // Head: layered slow sines (alive, never looping visibly) + speech nods + listening tilt.
    const idleYaw = (Math.sin(t * 0.37) * 0.6 + Math.sin(t * 0.91 + 1.3) * 0.4) * 0.022;
    const idlePitch = (Math.sin(t * 0.43 + 0.7) * 0.6 + Math.sin(t * 1.17) * 0.4) * 0.016;
    const idleRoll = Math.sin(t * 0.29 + 2.1) * 0.014;
    const nod = speaking ? Math.sin(t * 5.2) * this.envelope * 0.035 : 0;
    const listenTilt = input.state === 'listening' ? 0.035 + input.userLevel * 0.02 : 0;
    p.yaw = this.ease(p.yaw, (idleYaw + (speaking ? Math.sin(t * 2.3) * this.envelope * 0.02 : 0)) * motion, dt, 0.25, 0.25);
    p.pitch = this.ease(p.pitch, (idlePitch + nod) * motion, dt, 0.12, 0.2);
    p.roll = this.ease(p.roll, (idleRoll + listenTilt) * motion, dt, 0.5, 0.6);
    p.breath = Math.sin(t * (speaking ? 1.9 : 1.35)) * (0.55 * motion);
    return p;
  }
}
