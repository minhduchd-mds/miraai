# Mira Real Presence — camera spatial companion

## Goal

Real Presence turns Mira's existing camera perception into a co-presence layer: when a face is stable in frame, Mira estimates relative face position and conversational distance, removes the user's webcam background locally, and composites the live person into the bedroom scene as a "seat" beside Mira.

This is **presence simulation**, not biometric identity recognition. Camera frames are not persisted by this feature and no face embedding is created.

## Runtime

1. Shared webcam stream feeds Face Landmarker, Gesture Recognizer and Real Presence.
2. Face Landmarker provides landmarks, blendshapes and a facial transformation matrix.
3. `estimateRealPresencePose()` derives normalized face bounds, approximate camera distance, proximity class and a stable scene offset.
4. MediaPipe Image Segmenter uses the landscape Selfie Segmenter on-device to produce a person mask.
5. `RealPresenceOverlay` composites the mirrored person cutout over Mira's bedroom scene.
6. After a stable scan, the UI enters `REAL SEAT · LOCKED`.
7. Existing affect logic adapts Mira's response to observable expression cues, while avoiding claims that the camera knows the user's internal emotional state.

## Current capability

- 478-point face map already used by Mira.
- 52-class blendshape family available from MediaPipe Face Landmarker.
- Head yaw/pitch/roll, gaze approximation, nod/shake, smile/frown/wink/brow/mouth gestures.
- Approximate monocular distance from face size and assumed camera field-of-view.
- Foreground person segmentation in browser (GPU preferred, CPU fallback).
- Real-time seated cutout composition.
- Hand gesture and air-control continue sharing the same camera.

## Research anchors

- Google MediaPipe Face Landmarker: landmarks, blendshapes and facial transformation matrix.
  https://ai.google.dev/edge/mediapipe/solutions/vision/face_landmarker
- Google MediaPipe Image Segmenter / Selfie Segmenter: person/background and multi-class human segmentation.
  https://developers.google.com/edge/mediapipe/solutions/vision/image_segmenter
- WebXR Hit Test and Anchors: real-world surface placement when supported.
  https://developer.mozilla.org/en-US/docs/Web/API/XRHitTestResult
- WebXR Depth Sensing: depth information for occlusion and physical-world interaction on supported XR devices.
  https://immersive-web.github.io/depth-sensing/
- Apple visionOS Spatial Personas / shared context: side-by-side and conversational spatial placement patterns.
  https://developer.apple.com/design/human-interface-guidelines/shareplay
- Google Beam: AI volumetric video and light-field telepresence research/product direction.
  https://blog.google/innovation-and-ai/technology/research/project-starline-google-beam-update/

## Next spatial tier

The web version uses monocular approximation. Devices that expose WebXR hit-test, anchors and depth can upgrade the same feature into room-anchored presence with real occlusion. Native visionOS/ARKit can go further with shared world anchors and participant poses.
