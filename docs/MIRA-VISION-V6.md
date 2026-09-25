# Mira Vision v6 — worker post-processing, personal calibration and temporal intent

## Scope

Vision v6 keeps MediaPipe Holistic as the primary landmark model and moves CPU-side landmark interpretation away from the main UI thread where the browser supports module workers.

The Holistic model call itself remains on the main thread because the current browser Tasks Vision path is synchronous around the live video element. Mira does not claim otherwise. The worker offloads the post-processing that follows the model:
- pose geometry
- posture derivation
- lightweight hand-gesture geometry

If module workers are unavailable or fail, the same calculations fall back to the main thread.

## Worker pipeline

Holistic Landmarker
-> raw pose + hand landmarks
-> VisionPostprocessWorkerClient
-> module Web Worker
-> posture + gesture results
-> Mira shared telemetry

Face blendshapes and micro-expression timing stay on the main thread because they feed low-latency conversation behavior.

The performance panel reports POSTPROCESS as WORKER or MAIN and keeps model inference time separate from worker processing time.

## Gaze/head calibration

GazeHeadCalibrator learns the user's normal camera-facing center from stable frames:
- gaze X/Y offset
- head yaw/pitch offset
- local spread estimates

Calibration uses aggregate numeric values only. It never stores frames, face crops or identity embeddings.

The first 90 stable samples build the baseline. Afterwards the center adapts very slowly. Social Awareness uses the calibrated gaze/head values so natural posture or camera placement is less likely to be treated as looking away.

## Temporal gesture intent

Frame-level gesture labels are noisy, so direct UI commands now pass through GestureIntentTracker.

Examples:
- Victory must remain stable before toggling live voice.
- Open Palm must remain stable before interrupting Mira.
- Closed Fist must remain stable before closing the result surface.
- Pinch actions use edge events so a held pinch does not repeatedly click.

The word "intent" here means a debounced control event, not an inference about the user's mental intention.

## Failure behavior

Every new layer is optional:
- Worker failure -> main-thread post-processing.
- Calibration not ready -> partial centering only.
- Gesture confidence too low -> no control event.
- Holistic initialization failure -> legacy Face + Hand + Pose pipeline.

This keeps camera interaction usable on older phones and browsers while improving responsiveness on capable devices.
