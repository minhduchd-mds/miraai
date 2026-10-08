import type { HandPoint } from './hand-gesture-lite';
import type { PosePoint } from './posture-model';
import type { VisionWorkerPayload, VisionWorkerResult } from './vision-worker-protocol';

export interface VisionWorkerStatus {
  active: boolean;
  supported: boolean;
  pending: boolean;
  processingMs: number;
  completed: number;
  error: string | null;
}

export class VisionPostprocessWorkerClient {
  private worker: Worker | null = null;
  private seq = 0;
  private pending = false;
  private latestResult: VisionWorkerResult | null = null;
  private completed = 0;
  private error: string | null = null;

  start(): boolean {
    if (this.worker) return true;
    if (typeof Worker === 'undefined') return false;
    try {
      this.worker = new Worker(new URL('./vision-postprocess-worker.ts', import.meta.url), {
        type: 'module',
        name: 'mira-vision-postprocess',
      });
      this.worker.onmessage = (event: MessageEvent<VisionWorkerResult>) => {
        if (!event.data || event.data.seq !== this.seq) return;
        this.latestResult = event.data;
        this.pending = false;
        this.completed += 1;
      };
      this.worker.onerror = (event) => {
        this.error = event.message || 'Vision postprocess worker failed';
        this.pending = false;
        this.stop();
      };
      return true;
    } catch (error) {
      this.error = error instanceof Error ? error.message : String(error);
      this.stop();
      return false;
    }
  }

  submit(input: {
    at: number;
    pose: PosePoint[] | null;
    leftHand: HandPoint[] | null;
    rightHand: HandPoint[] | null;
    leftHandWorld?: HandPoint[] | null;
    rightHandWorld?: HandPoint[] | null;
  }): boolean {
    if (!this.worker || this.pending) return false;
    this.seq += 1;
    const payload: VisionWorkerPayload = {
      seq: this.seq,
      at: input.at,
      pose: input.pose,
      leftHand: input.leftHand,
      rightHand: input.rightHand,
      leftHandWorld: input.leftHandWorld || null,
      rightHandWorld: input.rightHandWorld || null,
    };
    this.pending = true;
    try { this.worker.postMessage(payload); }
    catch (error) {
      this.error = error instanceof Error ? error.message : String(error);
      this.stop();
      return false;
    }
    return true;
  }

  latest(): VisionWorkerResult | null {
    return this.latestResult
      ? {
          ...this.latestResult,
          posture: this.latestResult.posture
            ? {
                estimate: { ...this.latestResult.posture.estimate },
                landmarks: this.latestResult.posture.landmarks.map((point) => ({ ...point })),
              }
            : null,
          hands: this.latestResult.hands.map((hand) => ({
            ...hand,
            landmarks: hand.landmarks.map((point) => ({ ...point })),
            worldLandmarks: hand.worldLandmarks.map((point) => ({ ...point })),
            gesture: { ...hand.gesture, extensions: { ...hand.gesture.extensions } },
          })),
        }
      : null;
  }

  /**
   * Validate sequence and source timestamp BEFORE cloning landmark geometry.
   * UI polling cannot refresh the original inference timestamp.
   */
  latestFresh(afterSeq: number, now: number, maxAgeMs = 350): VisionWorkerResult | null {
    const candidate = this.latestResult;
    if (!candidate || !Number.isFinite(candidate.seq) || candidate.seq <= afterSeq ||
        !Number.isFinite(candidate.at) || candidate.at <= 0 ||
        !Number.isFinite(now) || now < candidate.at ||
        now - candidate.at > maxAgeMs) return null;
    return this.latest();
  }

  status(): VisionWorkerStatus {
    return {
      active: Boolean(this.worker),
      supported: typeof Worker !== 'undefined',
      pending: this.pending,
      processingMs: Number(this.latestResult?.processingMs || 0),
      completed: this.completed,
      error: this.error,
    };
  }

  stop(): void {
    try { this.worker?.terminate(); } catch { /* noop */ }
    this.worker = null;
    this.pending = false;
    this.latestResult = null;
  }
}
