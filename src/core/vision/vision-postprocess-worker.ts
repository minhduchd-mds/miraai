import { derivePosture } from './posture-model';
import { inferLiteGesture } from './hand-gesture-lite';
import type { VisionWorkerPayload, VisionWorkerResult, WorkerHandResult } from './vision-worker-protocol';

interface VisionWorkerScope {
  onmessage: ((event: MessageEvent<VisionWorkerPayload>) => void) | null;
  postMessage: (message: VisionWorkerResult) => void;
}

const scope = self as unknown as VisionWorkerScope;

scope.onmessage = (event: MessageEvent<VisionWorkerPayload>) => {
  const started = performance.now();
  const payload = event.data;
  const hands: WorkerHandResult[] = [];

  if (Array.isArray(payload.leftHand) && payload.leftHand.length >= 21) {
    hands.push({
      handedness: 'Left',
      landmarks: payload.leftHand.slice(0, 21),
      gesture: inferLiteGesture(payload.leftHand),
    });
  }
  if (Array.isArray(payload.rightHand) && payload.rightHand.length >= 21) {
    hands.push({
      handedness: 'Right',
      landmarks: payload.rightHand.slice(0, 21),
      gesture: inferLiteGesture(payload.rightHand),
    });
  }

  const posture = Array.isArray(payload.pose) && payload.pose.length >= 25
    ? {
        estimate: derivePosture(payload.pose),
        landmarks: payload.pose.slice(0, 33),
      }
    : null;

  scope.postMessage({
    seq: payload.seq,
    at: payload.at,
    posture,
    hands,
    processingMs: performance.now() - started,
  });
};
