/**
 * Mira SenseBus v1 — bounded, metadata-only temporal perception signals.
 * No image/frame/audio bytes, personally identifying content or actions.
 * Confidence is an uncalibrated model score, NOT a probability.
 */
export type SenseSource = 'face' | 'hand' | 'posture' | 'voice' | 'scene';
export interface SenseObservation {
  source: SenseSource;
  kind: string;
  confidence: number;
  atMs: number;
  trackId?: string;
  ttlMs?: number;
}
export interface SenseSignal {
  source: SenseSource;
  kind: string;
  trackId: string;
  atMs: number;
  ageMs: number;
  confidence: number;
  effectiveConfidence: number;
}
export interface SenseSnapshot {
  signalCount: number;
  signals: SenseSignal[];
}
interface RecordSignal {
  source: SenseSource;
  kind: string;
  trackId: string;
  atMs: number;
  confidence: number;
  ttlMs: number;
}
const VALID_SOURCES = new Set<SenseSource>(['face','hand','posture','voice','scene']);
const MAX_SIGNALS = 48;
const MAX_SIGNAL_AGE_MS = 5_000;
const DEFAULT_TTL_MS = 900;
const HALF_LIFE_MS = 450;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export class MiraSenseBus {
  private readonly signals = new Map<string, RecordSignal>();

  ingest(observation: SenseObservation, nowMs: number): boolean {
    if (!observation || !VALID_SOURCES.has(observation.source)) return false;
    if (typeof observation.kind !== 'string' || !/^[a-z][a-z0-9_-]{0,39}$/.test(observation.kind)) return false;
    if (!Number.isFinite(nowMs) || !Number.isFinite(observation.atMs)
        || !Number.isFinite(observation.confidence) || observation.confidence <= 0) return false;
    if (observation.atMs > nowMs + 80 || nowMs - observation.atMs > MAX_SIGNAL_AGE_MS) return false;
    const trackId = observation.trackId || 'primary';
    if (!/^[a-zA-Z0-9_-]{1,32}$/.test(trackId)) return false;
    const key = [observation.source, observation.kind, trackId].join(':');
    const old = this.signals.get(key);
    if (old && old.atMs >= observation.atMs) return false;
    this.prune(nowMs);
    if (!old && this.signals.size >= MAX_SIGNALS) {
      const oldest = [...this.signals.entries()].sort((a,b) => a[1].atMs - b[1].atMs)[0];
      if (oldest) this.signals.delete(oldest[0]);
    }
    this.signals.set(key, {
      source: observation.source,
      kind: observation.kind,
      trackId,
      atMs: observation.atMs,
      confidence: clamp(observation.confidence, 0, 1),
      ttlMs: clamp(Number.isFinite(observation.ttlMs) ? observation.ttlMs! : DEFAULT_TTL_MS, 100, 2_000),
    });
    return true;
  }

  snapshot(nowMs: number): SenseSnapshot {
    if (!Number.isFinite(nowMs)) return { signalCount: 0, signals: [] };
    this.prune(nowMs);
    const signals = [...this.signals.values()].map((signal) => {
      const ageMs = Math.max(0, nowMs - signal.atMs);
      return {
        source: signal.source, kind: signal.kind, trackId: signal.trackId,
        atMs: signal.atMs, ageMs, confidence: signal.confidence,
        effectiveConfidence: signal.confidence * Math.pow(0.5, ageMs / HALF_LIFE_MS),
      };
    }).sort((a,b) => b.effectiveConfidence - a.effectiveConfidence);
    return { signalCount: signals.length, signals };
  }

  reset(): void { this.signals.clear(); }

  private prune(nowMs: number): void {
    for (const [id, signal] of this.signals) {
      if (nowMs - signal.atMs > signal.ttlMs) this.signals.delete(id);
    }
  }
}
