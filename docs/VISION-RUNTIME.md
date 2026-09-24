# Mira Vision Runtime

## Goal

Use one consented camera stream for all browser vision sensors. Face tracking and hand-gesture tracking can now run at the same time without competing for the webcam.

## Current pipeline

```text
getUserMedia (single shared stream)
        |
        +--> FaceLandmarker --> faceData --> VRM head / expression driver
        |
        +--> GestureRecognizer --> handData --> cursor / mic / social gestures
```

The shared lifecycle is owned by `src/core/vision/camera-manager.ts`.

## Privacy boundary

- Camera starts only after an explicit user action.
- No camera frame is uploaded by this runtime.
- Releasing the last active vision consumer stops every camera track.
- Production V2 still keeps camera/gesture capabilities out of the default critical path.

## Why this step comes before Holistic/body tracking

The existing FaceLandmarker and GestureRecognizer are already working in Mira. Sharing one camera removes the current mutual-exclusion limitation with a small, reversible change and avoids binding the product to an unverified new API surface.

## Next increments

1. Add a sensor scheduler so heavy inference does not run twice on every animation frame.
2. Move inference orchestration to a Worker where browser support and MediaPipe constraints allow it.
3. Add pinch/select, swipe, stop/cancel and head nod/shake as semantic interaction events.
4. Add pose/body tracking behind the same camera manager.
5. Add optional object awareness that activates only on user request.
6. Map the semantic interaction events to WebXR input later so the upper interaction layer remains hardware-independent.

## Acceptance checks

- Face only: camera opens once and avatar tracking still works.
- Hand only: camera opens once and gesture controls still work.
- Face + hand: both trackers stay active concurrently using the same physical stream.
- Turning one tracker off does not interrupt the other.
- Turning the final tracker off releases the camera.
- Denied camera permission leaves both trackers safely disabled.
