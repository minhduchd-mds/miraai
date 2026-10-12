# Mira facial observation freshness — 2026-10-12

## Why
Review of IvanCampos/Facial-Computing and visionOS-examples highlighted the distinction between an actual camera inference frame and a UI poll. Mira already uses MediaPipe face blendshapes, FACS-like signals, personal baselines and time-based mood hysteresis. Adding another vision SDK would duplicate compute and increase maintenance.

## Changes
- Both Holistic and legacy FaceLandmarker record `faceData.frameAt` on genuine successful face inference, and `blendshapesReady` separately from landmark availability.
- The shared vision snapshot only asserts face presence while a valid inferred frame is at most 450 ms old; stale landmarks are excluded from spatial presence. Mesh-only face detection remains available for tracking but is not used to infer affect.
- `AffectTracker` rejects stale, invalid and mesh-only timestamped frames, resets affect to neutral, and never reuses a duplicate frame to advance a mood's dwell time or the personal baseline.
- Existing direct/test callers without `frameAt` retain legacy behavior.
- No new dependencies, no camera stream duplication, no edits to the avatar mesh, 3D room, TTS or UI styling.

## Verification
`scripts/runtime.test.mjs` adds regression scenarios for duplicate polling, stale camera frames, lost face, invalid timestamps and mesh-only frames, plus source-wiring checks for both tracking engines. CI runs this test through `npm test`.

## Limitations
- A 450 ms freshness window is a conservative policy choice, not a measured latency target.
- Browser camera/gesture accuracy and XR features need physical-device validation.
- Facial signals are observations, not evidence of a private emotional state.
- visionOS native Swift/RealityKit code is not imported into the browser build.
