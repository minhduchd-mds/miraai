import type { SpatialControlEvent } from '../core/vision/spatial-ui-control';
import type { SpatialDepthAnchorTracker } from '../core/vision/spatial-ray';
import {
  clampSpatial,
  spatialWindowAvailable,
  type SpatialGrabSession,
  type SpatialWindowId,
  type SpatialWindowTransform,
  type TwoHandSpatialSession,
} from './spatial-ui-helpers';

type MutableBox<T> = { current: T };

type WindowControlInput = {
  event: SpatialControlEvent;
  twoHandsActive: boolean;
  now: number;
  grabSessionRef: MutableBox<SpatialGrabSession | null>;
  depthRuntime: SpatialDepthAnchorTracker;
  windowsRef: MutableBox<Record<SpatialWindowId, SpatialWindowTransform>>;
  lastWindowRef: MutableBox<SpatialWindowId>;
  twoHandSessionRef: MutableBox<TwoHandSpatialSession | null>;
  spatialHeadConsumedAtRef: MutableBox<number>;
  updateWindow: (
    id: SpatialWindowId,
    updater: (current: SpatialWindowTransform) => SpatialWindowTransform,
  ) => void;
  showFeedback: (message: string) => void;
};

export function handleSpatialWindowControl(input: WindowControlInput): boolean {
  const {
    event,
    twoHandsActive,
    now,
    grabSessionRef,
    depthRuntime,
    windowsRef,
    lastWindowRef,
    twoHandSessionRef,
    spatialHeadConsumedAtRef,
    updateWindow,
    showFeedback,
  } = input;

  if (event.type === 'grab_start' && spatialWindowAvailable(event.targetId)) {
    const id = event.targetId;
    grabSessionRef.current = {
      id,
      start: { x: event.point.x, y: event.point.y, z: event.point.z },
      base: { ...windowsRef.current[id] },
    };
    depthRuntime.begin(event.point.z);
    lastWindowRef.current = id;
    showFeedback('Pinch giữ · di chuyển cửa sổ');
    return true;
  }

  if (event.type === 'grab_move' && grabSessionRef.current && !twoHandsActive) {
    const session = grabSessionRef.current;
    if (session.id !== event.targetId) return true;

    const width = Math.max(1, window.innerWidth);
    const height = Math.max(1, window.innerHeight);
    const dx = (event.point.x - session.start.x) * width * 1.42;
    const dy = (event.point.y - session.start.y) * height * 1.3;
    const limitX = width * 0.56;
    const limitY = height * 0.48;
    const depth = depthRuntime.update(event.point.z);
    const depthPx = depth.ready && depth.confidence >= 0.56
      ? depth.normalizedDelta * 120
      : 0;

    // Damping changes only the visual transform, not the input/gesture TTL.
    updateWindow(session.id, (current) => ({
      ...current,
      x: clampSpatial(current.x * 0.28 + (session.base.x + dx) * 0.72, -limitX, limitX),
      y: clampSpatial(current.y * 0.28 + (session.base.y + dy) * 0.72, -limitY, limitY),
      z: clampSpatial(current.z * 0.45 + (session.base.z + depthPx) * 0.55, -120, 120),
    }));
    return true;
  }

  if (event.type === 'grab_end') {
    grabSessionRef.current = null;
    depthRuntime.end();
    showFeedback('Đã thả cửa sổ');
    return true;
  }

  if (event.type === 'cancel') {
    grabSessionRef.current = null;
    depthRuntime.reset();
    twoHandSessionRef.current = null;
    spatialHeadConsumedAtRef.current = now;
    showFeedback('Đã hủy thao tác');
    return true;
  }

  return false;
}
