import type { PostureEstimate, PosePoint } from './posture-model';
import type { HandPoint, LiteGestureResult } from './hand-gesture-lite';

export interface VisionWorkerPayload {
  seq: number;
  at: number;
  pose: PosePoint[] | null;
  leftHand: HandPoint[] | null;
  rightHand: HandPoint[] | null;
}

export interface WorkerHandResult {
  handedness: 'Left' | 'Right';
  landmarks: HandPoint[];
  gesture: LiteGestureResult;
}

export interface VisionWorkerResult {
  seq: number;
  at: number;
  posture: {
    estimate: PostureEstimate;
    landmarks: PosePoint[];
  } | null;
  hands: WorkerHandResult[];
  processingMs: number;
}
