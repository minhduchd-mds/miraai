# Mira Spatial Interaction Runtime

Mira's production UI now supports a visionOS-inspired spatial interaction model over a normal webcam.

## Interaction model

### Indirect interaction

1. Calibrated gaze + head pose chooses the UI target.
2. The target must remain stable briefly before it becomes locked.
3. A hand pinch commits the focused action.
4. A nod can commit the focused action as a face-only fallback.
5. A shake cancels an active window grab.

This mirrors the interaction principle used by spatial interfaces: look to focus, then use a small hand gesture to commit. Mira does not have system-level eye tracking, so gaze is an approximation from webcam blendshapes/head pose and is deliberately confidence-gated.

### Direct interaction

When a stable pointing gesture is detected, the hand index point becomes the pointer. Pinch commits the selected control.

### Spatial windows

The camera monitor and Result Surface expose small window handles.

- pinch + hold on a focused handle starts grab;
- hand movement moves the window in x/y;
- release ends grab;
- two pinched hands scale and rotate the focused/last-active window.

Window movement stays clamped to a safe viewport range.

## Depth-ready path

The hand pipeline preserves landmark z values:

```text
MediaPipe hand landmark z
    ↓
TrackedHand.landmarks[].z
    ↓
visionSnapshot().pointerZ / hands[].z
    ↓
SpatialPoint3D.z
    ↓
grab session
```

The current production UI keeps window z unchanged during one-hand drag. Monocular webcam z is relative and noisy, so it is not treated as metric world depth.

A future metric-depth/WebXR/device adapter can map the same `SpatialPoint3D` contract to:

- a camera ray;
- a world-space hit point;
- direct 3D touch/proximity;
- translate-z;
- real volumetric object manipulation.

This keeps the control state machine stable while swapping only the spatial sensing adapter.

## Safety and UX constraints

- No dwell-only activation; gaze alone never clicks.
- No blink-to-click because involuntary blinks create unacceptable false positives.
- Spatial control state is session-only.
- Camera/hand/gaze raw data is not added to long-term memory.
- Standard click/touch controls remain functional.
- UI feedback is intentionally minimal: focus ring, target label, and short action feedback.

## Core files

- `src/core/vision/spatial-ui-control.ts`
- `src/presence/SpatialControlOverlay.tsx`
- `src/app/AppV2.tsx`
- `src/presence/vision-runtime.ts`
- `src/core/face/gesture-tracker.ts`
- `src/core/vision/holistic-tracker.ts`
- `src/ui/vision-v2.css`
- `src/ui/result-surface.css`
