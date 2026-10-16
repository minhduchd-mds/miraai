import type { MiraState } from '../core/types';

/**
 * Mira-original procedural micro-gesture director for an existing humanoid rig.
 * It adds small movements to the model's artist-authored seated/standing pose;
 * it does not own a skeleton, seek permissions, fetch assets or store sensor data.
 */
export type CharacterMotionCues = Readonly<{
  headYaw: number;
  headPitch: number;
  headRoll: number;
  chestRoll: number;
  leftArmX: number;
  leftArmZ: number;
  rightArmX: number;
  rightArmZ: number;
}>;

type Weights = { speaking: number; listening: number; thinking: number };
const clamp01 = (v: number): number => Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0;
const finiteSeconds = (v: number): number => Number.isFinite(v) ? Math.max(0, v) : 0;
const ZERO_CUES: CharacterMotionCues = Object.freeze({
  headYaw: 0, headPitch: 0, headRoll: 0, chestRoll: 0,
  leftArmX: 0, leftArmZ: 0, rightArmX: 0, rightArmZ: 0,
});

/** Samples are smooth across Mira state switches and browser tab suspensions. */
export function createCharacterDirector() {
  let lastTime: number | null = null;
  const weights: Weights = { speaking: 0, listening: 0, thinking: 0 };
  const reset = (): void => {
    lastTime = null;
    weights.speaking = 0;
    weights.listening = 0;
    weights.thinking = 0;
  };
  const sample = (seconds: number, state: MiraState, ttsEnergy?: number): CharacterMotionCues => {
    const t = finiteSeconds(seconds);
    // Clock discontinuities never produce a giant blend step or invalid output.
    const dt = lastTime === null || t < lastTime ? 1 / 60 : Math.min(0.08, t - lastTime);
    lastTime = t;
    const alpha = 1 - Math.exp(-dt * 5.5);
    for (const key of ['speaking', 'listening', 'thinking'] as const) {
      weights[key] += (Number(state === key) - weights[key]) * alpha;
    }
    const talk = weights.speaking;
    const listen = weights.listening;
    const think = weights.thinking;
    const energy = typeof ttsEnergy === 'number' ? clamp01(ttsEnergy) : 0.35;
    const gesture = talk * (0.24 + 0.76 * energy);
    // Incommensurate frequencies prevent all joints moving in perfect lockstep.
    const nod = Math.sin(t * 1.7 + 0.38) * Math.sin(t * 0.57);
    const armPulse = 0.5 + 0.5 * Math.sin(t * 1.29 + 0.8);
    const sway = Math.sin(t * 0.73 + 0.4);
    const listenNod = Math.sin(t * 1.13 + 0.7) * listen;
    const thinkShift = Math.sin(t * 0.43 + 1.1) * think;
    if (talk + listen + think < 0.000001) return ZERO_CUES;
    return {
      headYaw: 0.014 * gesture * sway + 0.010 * thinkShift,
      headPitch: 0.015 * gesture * nod + 0.012 * listenNod,
      headRoll: 0.012 * gesture * Math.sin(t * 0.69) + 0.009 * thinkShift,
      chestRoll: 0.006 * gesture * sway,
      leftArmX: 0.032 * gesture * armPulse,
      leftArmZ: 0.022 * gesture * Math.sin(t * 1.09),
      rightArmX: -0.025 * gesture * (1 - 0.45 * armPulse),
      rightArmZ: -0.018 * gesture * Math.sin(t * 0.91 + 0.7),
    };
  };
  return { sample, reset };
}
