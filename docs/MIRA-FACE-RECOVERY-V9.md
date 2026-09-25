# Mira Face Recovery v9

## Problem found

The face-entry path had three fragile points.

1. Holistic face presence depended on both a landmark mesh and face blendshapes. A valid 478-point mesh could therefore be treated as "no face" if blendshape categories were temporarily empty.
2. RealPresence segmentation was mounted with `faceSeen` in the effect dependency list. Every face enter/leave transition tore down and recreated ImageSegmenter, which could cause a visible stall or runtime/GPU instability exactly when a face entered the frame.
3. The 720 ms seat-lock timer was cleaned up whenever `pose.confidence` changed. Because confidence updates frequently, the timer could be cancelled repeatedly and remain stuck in CALIBRATING.

## Fixes

### Landmark-first face presence

Face presence is now based on a validated face landmark mesh.

Blendshapes are optional enrichment:
- landmarks available + blendshapes available -> FULL
- landmarks available + blendshapes missing -> MESH ONLY
- no valid landmarks -> SCANNING

When blendshapes are absent, Mira keeps the face mesh and geometry/head-pose path alive while affect-specific channels return to neutral instead of losing face presence.

The legacy FaceLandmarker fallback uses the same rule.

### Stable RealPresence lifecycle

ImageSegmenter now boots once per active camera stream.

A `faceSeenRef` controls whether segmentation work runs on each animation frame, so face enter/leave does not reconstruct the MediaPipe segmenter.

The canvas is cleared immediately when the face leaves the frame, preventing a stale person cutout.

### Seat-lock timer

The lock timer is now explicitly cancelled only when the face becomes invalid or the component unmounts. Normal confidence jitter no longer tears it down.

### Diagnostics

The compact Vision panel exposes:
- FACE FULL · landmark count
- FACE MESH · landmark count
- FACE SCAN

This makes field debugging possible without opening DevTools.

## Privacy

This recovery layer does not add face identity recognition or persistence. It validates transient landmark geometry only.
