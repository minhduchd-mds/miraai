# Spatial Visual v29 — Temporal Depth Stabilization

Spatial Visual v29 stabilizes camera-driven depth refinement before the controls reach the GPU shader.

## Why this step

v27 and v28 add continuous warp, micro-relighting and edge occlusion. Those effects amplify head-pose noise if the camera estimate jumps or reverses direction quickly.

v29 adds a presentation-only temporal stabilizer inside the lazy GPU renderer. It does not change face, hand or pose perception.

## Inputs

The stabilizer consumes the already-bounded v28 refinement control:

- view X / Y;
- warp strength;
- relight strength;
- occlusion strength;
- FPS cap.

It tracks only short-lived render-session state:

- previous view input;
- previous view velocity;
- current stability score;
- recovery state.

## Stabilization

The controller measures normalized viewpoint speed, input jump size and fast direction reversal.

When motion becomes unstable it:

- reduces stability;
- limits the maximum viewpoint step;
- slows interpolation;
- temporarily attenuates warp more than lighting;
- marks the renderer as recovering.

When the input settles it gradually restores full strength.

The stabilizer resets immediately when view refinement is disabled by quality tier, frame pressure or reduced-motion.

## Performance

v29 adds no model, no React state and no additional WebGL pass.

It lives inside the existing lazy `PhotorealSceneCanvas` path and uses scalar math only. Existing 24/30 FPS shader redraw caps remain authoritative.

## Diagnostics

The GPU canvas exposes session-only diagnostics:

- `data-depth-stability`;
- `data-depth-recovering`.

These are intended for development/performance inspection and are not persisted.

## Boundary

v29 is presentation-only:

- no camera motion is written to memory;
- no perception thresholds are changed;
- no physical stabilization or metric tracking is claimed;
- no second render pipeline is created.
