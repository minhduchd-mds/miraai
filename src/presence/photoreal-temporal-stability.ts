import type { PhotorealViewRefinementControl } from './photoreal-depth-warp';

export interface PhotorealTemporalRefinementState extends PhotorealViewRefinementControl {
  stability: number;
  motionSpeed: number;
  recovering: boolean;
}

interface TemporalPoint {
  viewX: number;
  viewY: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Number.isFinite(value) ? value : 0));
}

function approach(current: number, target: number, alpha: number): number {
  return current + (target - current) * clamp(alpha, 0, 1);
}

function boundedApproach(
  current: number,
  target: number,
  alpha: number,
  maxStep: number,
): number {
  const eased = approach(current, target, alpha);
  return current + clamp(eased - current, -maxStep, maxStep);
}

/**
 * Presentation-only temporal stabilizer for the v28 view refinement controls.
 *
 * It suppresses short camera-pose spikes and fast direction reversals before
 * they reach the shader. It never changes face/hand perception and never
 * persists camera motion outside the current render session.
 */
export class PhotorealTemporalStabilizer {
  private current: PhotorealTemporalRefinementState = {
    active: false,
    viewX: 0,
    viewY: 0,
    warpStrength: 0,
    relightStrength: 0,
    occlusionStrength: 0,
    fpsCap: 0,
    stability: 1,
    motionSpeed: 0,
    recovering: false,
  };

  private previousInput: TemporalPoint = { viewX: 0, viewY: 0 };
  private previousVelocity: TemporalPoint = { viewX: 0, viewY: 0 };
  private lastAt = 0;
  private initialized = false;

  update(
    input: PhotorealViewRefinementControl,
    now = performance.now(),
  ): PhotorealTemporalRefinementState {
    if (!input.active) {
      this.current = {
        active: false,
        viewX: 0,
        viewY: 0,
        warpStrength: 0,
        relightStrength: 0,
        occlusionStrength: 0,
        fpsCap: 0,
        stability: 1,
        motionSpeed: 0,
        recovering: false,
      };
      this.previousInput = { viewX: 0, viewY: 0 };
      this.previousVelocity = { viewX: 0, viewY: 0 };
      this.lastAt = now;
      this.initialized = false;
      return { ...this.current };
    }

    if (!this.initialized) {
      this.initialized = true;
      this.lastAt = now;
      this.previousInput = { viewX: input.viewX, viewY: input.viewY };
      this.current = {
        ...input,
        stability: 1,
        motionSpeed: 0,
        recovering: false,
      };
      return { ...this.current };
    }

    const dtSeconds = clamp((now - this.lastAt) / 1000, 1 / 120, 0.12);
    this.lastAt = now;

    const deltaX = input.viewX - this.previousInput.viewX;
    const deltaY = input.viewY - this.previousInput.viewY;
    const jump = Math.hypot(deltaX, deltaY);
    const velocityX = deltaX / dtSeconds;
    const velocityY = deltaY / dtSeconds;
    const motionSpeed = Math.hypot(velocityX, velocityY);

    const previousSpeed = Math.hypot(
      this.previousVelocity.viewX,
      this.previousVelocity.viewY,
    );
    const reversalDot = previousSpeed > 0.08 && motionSpeed > 0.08
      ? (
          velocityX * this.previousVelocity.viewX
          + velocityY * this.previousVelocity.viewY
        ) / Math.max(0.001, motionSpeed * previousSpeed)
      : 1;
    const reversingFast = reversalDot < -0.45 && motionSpeed > 1.1;

    let stabilityTarget = 1;
    if (jump > 0.28 || motionSpeed > 4.2) stabilityTarget = 0.28;
    else if (jump > 0.16 || motionSpeed > 2.6) stabilityTarget = 0.48;
    else if (motionSpeed > 1.35) stabilityTarget = 0.7;
    if (reversingFast) stabilityTarget = Math.min(stabilityTarget, 0.42);

    const stabilityAlpha = stabilityTarget < this.current.stability ? 0.34 : 0.075;
    const stability = approach(this.current.stability, stabilityTarget, stabilityAlpha);
    const recovering = stability < 0.94;

    const viewAlpha = recovering ? 0.1 : 0.18;
    const maxViewStep = recovering ? 0.032 : 0.058;
    const viewX = boundedApproach(
      this.current.viewX,
      input.viewX,
      viewAlpha,
      maxViewStep,
    );
    const viewY = boundedApproach(
      this.current.viewY,
      input.viewY,
      viewAlpha,
      maxViewStep,
    );

    const warpGain = 0.34 + stability * 0.66;
    const lightGain = 0.5 + stability * 0.5;
    const occlusionGain = 0.56 + stability * 0.44;
    const strengthAlpha = recovering ? 0.12 : 0.2;

    this.current = {
      active: true,
      viewX,
      viewY,
      warpStrength: approach(
        this.current.warpStrength,
        input.warpStrength * warpGain,
        strengthAlpha,
      ),
      relightStrength: approach(
        this.current.relightStrength,
        input.relightStrength * lightGain,
        strengthAlpha,
      ),
      occlusionStrength: approach(
        this.current.occlusionStrength,
        input.occlusionStrength * occlusionGain,
        strengthAlpha,
      ),
      fpsCap: input.fpsCap,
      stability,
      motionSpeed: clamp(motionSpeed, 0, 20),
      recovering,
    };

    this.previousInput = { viewX: input.viewX, viewY: input.viewY };
    this.previousVelocity = { viewX: velocityX, viewY: velocityY };
    return { ...this.current };
  }

  snapshot(): Readonly<PhotorealTemporalRefinementState> {
    return this.current;
  }

  reset(): void {
    this.current = {
      active: false,
      viewX: 0,
      viewY: 0,
      warpStrength: 0,
      relightStrength: 0,
      occlusionStrength: 0,
      fpsCap: 0,
      stability: 1,
      motionSpeed: 0,
      recovering: false,
    };
    this.previousInput = { viewX: 0, viewY: 0 };
    this.previousVelocity = { viewX: 0, viewY: 0 };
    this.lastAt = 0;
    this.initialized = false;
  }
}
