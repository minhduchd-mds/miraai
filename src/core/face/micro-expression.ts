import type { FACSProxy } from './facs-proxy';

export type MicroExpressionKind =
  | 'none'
  | 'smile_flash'
  | 'brow_flash'
  | 'lip_press_flash'
  | 'surprise_flash'
  | 'tension_flash'
  | 'blink_burst';

export interface MicroExpressionState {
  kind: MicroExpressionKind;
  confidence: number;
  durationMs: number;
  at: number;
}

const EMPTY: MicroExpressionState = { kind: 'none', confidence: 0, durationMs: 0, at: 0 };

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

interface ChannelState {
  baseline: number;
  activeSince: number;
  peak: number;
}

const CONFIG: Array<{
  kind: Exclude<MicroExpressionKind, 'none'>;
  threshold: number;
  signal: (au: FACSProxy) => number;
}> = [
  { kind: 'smile_flash', threshold: 0.25, signal: (au) => clamp01(au.AU12 * 0.72 + au.AU06 * 0.28) },
  { kind: 'brow_flash', threshold: 0.28, signal: (au) => clamp01(au.AU01 * 0.55 + au.AU02 * 0.45) },
  { kind: 'lip_press_flash', threshold: 0.23, signal: (au) => clamp01(au.AU23 * 0.76 + au.AU17 * 0.24) },
  { kind: 'surprise_flash', threshold: 0.28, signal: (au) => clamp01(au.AU05 * 0.34 + au.AU26 * 0.4 + au.AU01 * 0.26) },
  { kind: 'tension_flash', threshold: 0.25, signal: (au) => clamp01(au.AU04 * 0.5 + au.AU07 * 0.25 + au.AU23 * 0.25) },
  { kind: 'blink_burst', threshold: 0.48, signal: (au) => clamp01(au.AU45) },
];

/**
 * Detects brief AU-proxy excursions relative to a slow local baseline.
 * This is a temporal visual event detector, not a truth detector for emotion.
 */
export class MicroExpressionTracker {
  private channels = new Map<MicroExpressionKind, ChannelState>();
  private recent: MicroExpressionState = { ...EMPTY };
  private recentUntil = 0;

  constructor() {
    for (const config of CONFIG) {
      this.channels.set(config.kind, { baseline: 0, activeSince: 0, peak: 0 });
    }
  }

  update(au: FACSProxy, now = performance.now()): MicroExpressionState {
    let emitted: MicroExpressionState | null = null;

    for (const config of CONFIG) {
      const state = this.channels.get(config.kind)!;
      const value = config.signal(au);
      const delta = Math.max(0, value - state.baseline);

      // Slow baseline follows resting behavior, but pauses while a brief excursion is active.
      if (!state.activeSince) {
        state.baseline += (value - state.baseline) * 0.025;
      }

      if (!state.activeSince && delta >= config.threshold) {
        state.activeSince = now;
        state.peak = delta;
      } else if (state.activeSince) {
        state.peak = Math.max(state.peak, delta);
        const durationMs = now - state.activeSince;
        const released = delta <= config.threshold * 0.48;

        if (released && durationMs >= 55 && durationMs <= 720) {
          const confidence = clamp01(
            (state.peak - config.threshold) / Math.max(0.08, 1 - config.threshold) * 0.75 +
            (1 - Math.min(1, Math.abs(durationMs - 260) / 520)) * 0.25,
          );
          if (!emitted || confidence > emitted.confidence) {
            emitted = { kind: config.kind, confidence, durationMs, at: now };
          }
          state.activeSince = 0;
          state.peak = 0;
        } else if (durationMs > 760) {
          state.activeSince = 0;
          state.peak = 0;
          state.baseline += (value - state.baseline) * 0.08;
        }
      }
    }

    if (emitted && emitted.confidence >= 0.28) {
      this.recent = emitted;
      this.recentUntil = now + 900;
    }
    if (now <= this.recentUntil) return { ...this.recent };
    this.recent = { ...EMPTY };
    return { ...EMPTY };
  }

  reset(): void {
    this.channels.clear();
    for (const config of CONFIG) {
      this.channels.set(config.kind, { baseline: 0, activeSince: 0, peak: 0 });
    }
    this.recent = { ...EMPTY };
    this.recentUntil = 0;
  }
}
