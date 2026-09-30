# Spatial Visual v23 — Camera-driven 3D depth

Spatial Visual v23 makes the photoreal Mira scene respond to the user's real camera head pose while keeping the effect presentation-only and performance-bounded.

## Inputs

v23 reuses face telemetry that already exists in the camera pipeline:

- calibrated yaw;
- calibrated pitch;
- face roll;
- estimated camera distance;
- face confidence.

No additional model, detector or camera pass is introduced.

## Mapping

The lazy `photoreal-camera-depth.ts` module converts camera pose into a bounded scene frame:

```text
head yaw / pitch / roll
+ relative camera distance
+ face confidence
+ quality tier
        ↓
room offset
subject offset
foreground offset
view rotation
relative zoom
contact-shadow offset
```

The scene uses the existing clean bedroom source and the v21/v22 masked depth layers:

- room/base responds least;
- subject/mid responds more;
- blanket/foreground responds most.

This increases motion parallax without pretending that the source image contains measured 3D geometry.

## Distance baseline

Zoom is relative to a per-session camera baseline.

The first reliable face distance becomes the baseline. The baseline adapts only very slowly while the user remains near that position, preventing a fixed assumed camera distance from permanently zooming the scene for different users or devices.

## Safety and comfort bounds

Camera motion is clamped to small presentation values:

- room translation: about ±4 px;
- subject translation: about ±8 px;
- foreground translation: about ±13 px;
- horizontal viewpoint rotation: about ±3.1°;
- vertical viewpoint rotation: about ±1.9°;
- roll: about ±0.7°;
- relative zoom: roughly 0.968× to 1.038×.

Low-confidence pose and `lite` visual quality return a neutral frame.

Reduced-motion disables the camera-driven transforms.

## Performance design

The camera 3D mapper is dynamically imported only when camera pose is enabled and visual quality is above `lite`.

Per-frame animation is limited to compositor-friendly CSS transforms and custom properties:

- `translate3d`;
- `rotateX`;
- `rotateY`;
- `rotateZ`;
- `scale`.

v23 does not animate blur or backdrop-filter from camera motion and does not add a second WebGL rendering pass.

Camera pose is folded into the existing face telemetry update instead of creating another React telemetry state, reducing render churn.

## Boundary

v23 remains downstream of perception:

- head pose is consumed but not changed;
- camera pose is not stored in long-term memory;
- no physical 3D reconstruction is claimed;
- no scene depth map is inferred from the bedroom image;
- the effect can be disabled independently through reduced motion or the `lite` quality tier.
