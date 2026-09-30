# Spatial Visual v27 — Single-pass GPU Depth Warp

Spatial Visual v27 upgrades the canonical Mira bedroom from flat segmented planes to a continuous authored depth-field warp inside the existing GPU scene pass.

## Goal

v26 already separated the static bedroom into semantic depth regions. v27 keeps those regions as structural cues, but also bends the source texture itself so head motion produces a continuous viewpoint change instead of only translating clipped image planes.

## Continuous depth field

The lazy `photoreal-depth-warp.ts` module defines an authored relative depth field for:

- window / city;
- pillow;
- subject;
- bed;
- foreground blanket.

The field is intentionally continuous and feathered. It is **relative presentation depth only**:

- not metric depth;
- not inferred geometry;
- not scene reconstruction;
- specific to the canonical bedroom composition.

## Single-pass rendering

`PhotorealSceneCanvas` now combines:

1. cover-resampling;
2. continuous depth-field UV warp;
3. bounded sharpening;
4. halo protection.

The same WebGL context performs both clarity and warp. v27 does not create a second canvas/WebGL pipeline.

The source texture uploads once per scene load. Camera motion only updates uniforms and redraws the already-uploaded texture.

## Camera control

The existing smoothed camera-depth controller exposes its current frame to the GPU canvas.

The warp uses:

- horizontal viewpoint from camera yaw;
- vertical viewpoint from camera pitch;
- camera-depth intensity as warp strength.

The shader shifts UVs by the difference between local authored depth and a neutral depth plane, which creates small parallax inside the image itself.

## Performance policy

GPU warp is enabled only when all conditions are true:

- visual quality is `ultra`;
- frame-time tier is `full`;
- reduced-motion is off;
- reliable camera depth intensity is at least 0.18.

Warp redraw is capped at 30 FPS. High/balanced/lite tiers keep the lower-cost v26/v23 presentation path.

When warp is active, the v26 segmented overlays are reduced in opacity to avoid double-image/ghosting.

## Boundary

v27 stays downstream of perception and remains presentation-only.

It does not:

- store camera pose or depth in long-term memory;
- fabricate physical measurements;
- add another perception model;
- add another WebGL context;
- replace WebXR metric geometry;
- claim true 3D reconstruction.
