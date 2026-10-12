# Spatial Room Gesture Controller · v1 (12 Oct 2026)

## Scope
Gesture steering only changes the **3D camera**. It never invokes OS commands,
voice activation, network requests, or spatial action clicks. This is independent
of the existing bimanual UI object/window transforms.

## Camera-enabled controls
- One tracked `Open_Palm` hand (confidence >= 0.75), held for **240 ms**:
  smoothly turn the room camera with the palm.
- Two **different** tracked hands (`Left` + `Right`) both pinching,
  separation >= 0.14 normalized viewport units, held for **240 ms**:
  zoom into/out of the 3D room by changing the camera's position.
- Keyboard digits 1-5, WASD/arrows and mouse drag remain available.

No gesture works unless vision is already enabled and the interactive room is
mounted. Settings/modal interactions, spatial focus, active grabs or action
events take priority over camera steering. Two-hand window/object controls
are explicitly suppressed when the room owns the gesture.

## Safety bounds
- Each observation must have its **own monotonic camera frame timestamp**;
  polling the same frame never counts as new dwell evidence.
- Camera frame older than 350 ms, missing hand, confidence < 0.75,
  invalid coordinates, large coordinate jump or visibility loss resets control.
- Rotations are capped per accepted observation; zoom ratios are bounded to
  0.92-1.08 and run through `moveRoomCamera()` collision checks.
- Short smoothing inertia applies only while a fresh open palm remains tracked;
  **no motion persists after tracking is lost**.

## Integration
`src/core/vision/spatial-room-gesture.ts` is a pure, unit-tested state machine.
`src/app/useVisionSpatialRuntime.ts` connects it only after the spatial UI
priority checks and emits `mira:room-gesture` with bounded values.
`src/presence/PhotorealRoom3D.tsx` consumes only `rotate` and `zoom` values
and invalidates the WebGL canvas.

## Validation
`scripts/spatial-bimanual-safety.test.mjs` checks dwell, two-hand identity,
frame freshness, jumps, permission boundary and exclusive window ownership.
`scripts/room-3d.spec.mjs` checks the live Three.js event-to-camera path.
GitHub CI and Visual QA provide build and Chromium regressions.

## Current limits
This is a browser-assisted virtual camera controller, not a physical robot or
macOS automation system. Real-device gesture accuracy, movement comfort and
false-activation frequency require camera tests under varied light and hand
occlusion. The v1 release does not claim performance benchmarks without them.
