import { EMPTY_ENVIRONMENT } from '../core/vision/environment-model';
import { EMPTY_REAL_PRESENCE_POSE } from '../core/vision/real-presence';

type VisionRuntimeModule = typeof import('../presence/vision-runtime');
type VisionSnapshot = ReturnType<VisionRuntimeModule['visionSnapshot']>;

export function normalizeVisionPerception(snapshot: VisionSnapshot | undefined) {
  const face = snapshot?.face;
  const micro = face?.microExpression || {
    kind: 'none',
    confidence: 0,
    durationMs: 0,
  };
  const posture = snapshot?.posture || {
    present: false,
    label: 'unknown',
    confidence: 0,
    upright: 0,
    slump: 0,
    lean: 0,
    motion: 0,
    landmarks: [],
  };
  const pulse = snapshot?.rppg || {
    status: 'off',
    bpmTrend: 0,
    quality: 0,
    relativeActivation: 0,
    sampleCount: 0,
  };
  const environmentSensor = snapshot?.environment;
  const environmentContext = environmentSensor?.environment || { ...EMPTY_ENVIRONMENT };
  const environmentObjects = Array.isArray(environmentSensor?.objects)
    ? environmentSensor.objects
    : [];
  const spatial = face?.spatialPose || { ...EMPTY_REAL_PRESENCE_POSE };
  const faceConfidence = Math.max(
    Number(spatial.confidence || 0),
    face?.present ? 0.65 : 0,
  );

  return {
    face,
    micro,
    posture,
    pulse,
    environmentContext,
    environmentObjects,
    spatial,
    faceConfidence,
  };
}
