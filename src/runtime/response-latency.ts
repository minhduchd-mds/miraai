import type { TurnTimings } from './turn-manager';

export type ResponseSource = 'provider' | 'local_model' | 'fallback' | 'unknown';
export interface ResponseLatencySample extends TurnTimings {
  firstAudioMs: number;
  source: ResponseSource;
}
export interface LatencyPercentiles {
  count: number;
  p50Ms: number | null;
  p95Ms: number | null;
}
export interface ResponseLatencySnapshot {
  count: number;
  fallbackCount: number;
  last: ResponseLatencySample | null;
  /** Fallbacks are excluded from inference percentile statistics. */
  memory: LatencyPercentiles;
  contextReady: LatencyPercentiles;
  brain: LatencyPercentiles;
  firstAudio: LatencyPercentiles;
}

/** Only numeric session-local measurements. No transcripts, camera or identifiers. */
export class ResponseLatencyWindow {
  private readonly samples: ResponseLatencySample[] = [];
  private readonly capacity: number;
  constructor(capacity = 64) {
    this.capacity = Number.isFinite(capacity)
      ? Math.max(1, Math.min(128, Math.floor(capacity))) : 64;
  }
  record(sample: ResponseLatencySample): void {
    const fields: (keyof TurnTimings | 'firstAudioMs')[] = [
      'memoryMs','hostMs','hostActionsMs','preBrainSkillMs',
      'contextReadyMs','brainMs','totalMs','firstAudioMs',
    ];
    if (!fields.every(key => Number.isFinite(sample[key])
      && sample[key] >= 0 && sample[key] <= 120_000)) return;
    if (!(['provider','local_model','fallback','unknown'] as string[]).includes(sample.source)) return;
    const point = {} as ResponseLatencySample;
    for (const key of fields) Object.assign(point, { [key]: Math.round(sample[key]) });
    point.source = sample.source;
    this.samples.push(point);
    if (this.samples.length > this.capacity) this.samples.shift();
  }
  snapshot(): ResponseLatencySnapshot {
    const valid = this.samples.filter(x => x.source !== 'fallback');
    const summarize = (key: keyof TurnTimings | 'firstAudioMs'): LatencyPercentiles => {
      const values = valid.map(x => x[key]).sort((a,b) => a-b);
      const pct = (p: number) => values.length
        ? values[Math.ceil(p * values.length)-1] : null;
      return { count: values.length, p50Ms: pct(.5), p95Ms: pct(.95) };
    };
    return {
      count: this.samples.length,
      fallbackCount: this.samples.filter(x=>x.source==='fallback').length,
      last: this.samples.length?{...this.samples[this.samples.length-1]}:null,
      memory:summarize('memoryMs'),
      contextReady:summarize('contextReadyMs'),
      brain:summarize('brainMs'),
      firstAudio:summarize('firstAudioMs'),
    };
  }
  reset(): void { this.samples.length=0; }
}
