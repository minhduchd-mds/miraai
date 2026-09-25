# Mira Holistic Vision v5

## Goal

Replace three parallel heavy MediaPipe tasks (face, gesture and pose) with one primary Holistic Landmarker pipeline while keeping a legacy fallback.

The official Holistic task produces up to 553 landmarks in one result:
- 478 face landmarks
- 33 pose landmarks
- 21 left-hand landmarks
- 21 right-hand landmarks
- optional face blendshapes

Primary path:
HolisticLandmarker -> face + blendshapes + pose + hands -> Mira signal adapters.

A single shared camera consumer named holistic drives the model. Experimental rPPG remains a lightweight pixel sampler on the same camera stream.

If Holistic cannot initialize, Mira falls back to the previous FaceLandmarker + GestureRecognizer + PoseLandmarker stack.

Holistic returns hand landmarks but not GestureRecognizer categories, so Mira v5 uses a small geometry-only recognizer for the interaction vocabulary: Open Palm, Closed Fist, Thumb Up/Down, Victory, Pointing Up and I Love You. It is not a sign-language recognizer.

Holistic does not expose the exact FaceLandmarker facial transformation matrix in its result, so Mira derives a conservative yaw/pitch/roll proxy from face mesh geometry. Social awareness treats these as approximate orientation signals.

VisionPerformanceGovernor dynamically changes inference cadence based on device tier, measured inference time and page visibility. It backs off quickly when inference becomes expensive and recovers slowly when headroom returns. Hidden tabs are throttled heavily.

The UI exposes engine, delegate, processed FPS, inference time, detected landmark count and performance tier.

All landmark processing stays in the browser. No face embedding or identity model is added by this layer.
