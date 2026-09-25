# Mira Environment Awareness v7

## Purpose

Environment Awareness adds a low-frequency local object detector so Mira can use visible surroundings as optional conversational context.

The layer is deliberately conservative:
- it does not identify people,
- it does not run OCR,
- it does not infer a precise address or location,
- it does not save camera frames,
- it does not treat a room label as ground truth.

## Runtime

Mira uses MediaPipe ObjectDetector with EfficientDet Lite0 on the existing shared camera stream.

The detector runs far slower than face/hand tracking:
- roughly 0.5–1.3 FPS depending on device performance,
- slower again when the tab is hidden,
- GPU preferred with CPU fallback.

This avoids letting a second vision model dominate the main interaction loop.

## Temporal objects

Raw detections are passed through ObjectTemporalTracker.

A detection becomes stable only after repeated overlap across detector frames. Each tracked object receives a session-local ID. IDs are only for visual continuity and are not identity tracking.

The tracker expires stale objects quickly and keeps at most a small set of high-confidence objects.

## Environment proxy

Stable COCO-style object labels feed a lightweight context model.

Possible labels:
- workspace
- rest_area
- living_area
- dining_area
- person_nearby
- mixed
- unknown

Examples:
- laptop + keyboard + mouse can raise workspace confidence,
- bed/couch can raise rest-area confidence,
- dining table + cups/bowls can raise dining-area confidence.

These labels mean only "the visible objects look compatible with this kind of area". They do not establish the actual room, activity, location or intent of the user.

## Mira Brain integration

A confidence-gated environment summary is appended to the same transient context channel used by Social Awareness.

Example:
"Object detector local sees a workspace-like context (laptop, keyboard). This is only inferred from visible objects."

The environment transition can appear in the in-memory Behavior Timeline, but raw boxes and object tracks are not written to long-term memory.

## UI

The camera panel can show:
- object boxes for stable high-confidence detections,
- inferred environment proxy,
- object-model delegate,
- inference latency,
- scan cadence,
- current stable object chips.

The preview is mirrored for the user, so the overlay mirrors object boxes to remain aligned.

## Failure behavior

Object awareness is optional. If its model cannot load, face, hand, pose, rPPG, social awareness, voice and Mira Brain continue operating normally.
