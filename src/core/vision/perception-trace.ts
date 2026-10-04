export type PerceptionFrameScheduler = 'video-frame' | 'animation-frame';

export interface PerceptionTraceSample {
  at: number;
  inferenceMs: number;
  landmarkCount: number;
  facePresent: boolean;
  handPresent: boolean;
  gesture: string;
  gestureScore: number;
  pinching: boolean;
  scheduler: PerceptionFrameScheduler;
  frameLatenessMs: number;
  width: number;
  height: number;
}

export interface PerceptionTraceSession {
  schema: 'mira.perception-trace.v1';
  privacy: 'normalized-signals-only';
  startedAt: number;
  endedAt: number;
  samples: PerceptionTraceSample[];
  droppedSamples: number;
}

function finite(value: number): number {
  return Number.isFinite(value) ? value : 0;
}

export class PerceptionTraceRecorder {
  private active = false;
  private startedAt = 0;
  private samples: PerceptionTraceSample[] = [];
  private droppedSamples = 0;

  constructor(private readonly maxSamples = 1_800) {}

  start(now = performance.now()): void {
    this.active = true;
    this.startedAt = finite(now);
    this.samples = [];
    this.droppedSamples = 0;
  }

  record(sample: PerceptionTraceSample): void {
    if (!this.active) return;
    const sanitized: PerceptionTraceSample = {
      at: Math.max(0, finite(sample.at)),
      inferenceMs: Math.max(0, finite(sample.inferenceMs)),
      landmarkCount: Math.max(0, Math.round(finite(sample.landmarkCount))),
      facePresent: Boolean(sample.facePresent),
      handPresent: Boolean(sample.handPresent),
      gesture: String(sample.gesture || 'None').slice(0, 48),
      gestureScore: Math.max(0, Math.min(1, finite(sample.gestureScore))),
      pinching: Boolean(sample.pinching),
      scheduler: sample.scheduler === 'video-frame' ? 'video-frame' : 'animation-frame',
      frameLatenessMs: Math.max(0, finite(sample.frameLatenessMs)),
      width: Math.max(0, Math.round(finite(sample.width))),
      height: Math.max(0, Math.round(finite(sample.height))),
    };
    if (this.samples.length >= this.maxSamples) {
      this.samples.shift();
      this.droppedSamples += 1;
    }
    this.samples.push(sanitized);
  }

  stop(now = performance.now()): PerceptionTraceSession {
    this.active = false;
    return this.snapshot(now);
  }

  snapshot(now = performance.now()): PerceptionTraceSession {
    return {
      schema: 'mira.perception-trace.v1',
      privacy: 'normalized-signals-only',
      startedAt: this.startedAt,
      endedAt: Math.max(this.startedAt, finite(now)),
      samples: this.samples.map((sample) => ({ ...sample })),
      droppedSamples: this.droppedSamples,
    };
  }

  isActive(): boolean {
    return this.active;
  }
}
