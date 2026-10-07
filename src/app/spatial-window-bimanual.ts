import type { SpatialFocus } from '../core/vision/spatial-ui-control';
import { measureTwoHands, rotationFromAngles, scaleFromDistance, smoothValue } from '../presence/spatial-math';
import {
  clampSpatial,
  spatialWindowAvailable,
  type SpatialWindowId,
  type SpatialWindowTransform,
  type TwoHandSpatialSession,
} from './spatial-ui-helpers';

type MutableBox<T> = { current: T };

type BimanualHand = {
  pointerX?: number;
  pointerY?: number;
  x?: number;
  y?: number;
};

type SpatialWindowBimanualInput = {
  pinchedHands: BimanualHand[];
  focus: SpatialFocus | null;
  lastWindowId: SpatialWindowId;
  now: number;
  sessionRef: MutableBox<TwoHandSpatialSession | null>;
  windowsRef: MutableBox<Record<SpatialWindowId, SpatialWindowTransform>>;
  updateWindow: (
    id: SpatialWindowId,
    updater: (current: SpatialWindowTransform) => SpatialWindowTransform,
  ) => void;
  showFeedback: (message: string) => void;
};

export function updateSpatialWindowBimanual(input: SpatialWindowBimanualInput): boolean {
  const {
    pinchedHands,
    focus,
    lastWindowId,
    now,
    sessionRef,
    windowsRef,
    updateWindow,
    showFeedback,
  } = input;

  const transformTarget = focus?.kind === 'window'
    ? focus.id
    : lastWindowId;

  if (pinchedHands.length < 2 || !spatialWindowAvailable(transformTarget)) {
    sessionRef.current = null;
    return false;
  }

  const a = pinchedHands[0];
  const b = pinchedHands[1];
  const geometry = measureTwoHands(
    {
      x: clampSpatial(Number(a?.pointerX ?? a?.x ?? 0.5), 0, 1),
      y: clampSpatial(Number(a?.pointerY ?? a?.y ?? 0.5), 0, 1),
    },
    {
      x: clampSpatial(Number(b?.pointerX ?? b?.x ?? 0.5), 0, 1),
      y: clampSpatial(Number(b?.pointerY ?? b?.y ?? 0.5), 0, 1),
    },
  );

  let session = sessionRef.current;
  if (!session || session.id !== transformTarget) {
    const base = windowsRef.current[transformTarget];
    sessionRef.current = {
      id: transformTarget,
      since: now,
      active: false,
      startDistance: geometry.distance,
      startAngle: geometry.angleDeg,
      baseScale: base.scale,
      baseRotation: base.rotation,
    };
    return true;
  }

  if (!session.active && now - session.since >= 240 && geometry.distance >= 0.08) {
    session.active = true;
    showFeedback('Hai tay · scale / rotate');
    return true;
  }

  if (session.active) {
    const targetScale = scaleFromDistance(
      session.baseScale,
      session.startDistance,
      geometry.distance,
      0.82,
      1.28,
    );
    const targetRotation = rotationFromAngles(
      session.baseRotation,
      session.startAngle,
      geometry.angleDeg,
      -12,
      12,
    );
    updateWindow(session.id, (current) => ({
      ...current,
      scale: smoothValue(current.scale, targetScale, 0.26),
      rotation: smoothValue(current.rotation, targetRotation, 0.22),
    }));
  }

  return true;
}
