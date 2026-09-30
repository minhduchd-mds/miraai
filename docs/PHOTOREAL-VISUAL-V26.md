# Spatial Visual v26 — Authored Scene Segmentation

Spatial Visual v26 gives the canonical Mira bedroom image more convincing 2.5D depth without adding another realtime ML segmentation model.

## Why authored segmentation

The browser is already running face/hand/pose perception. Running another image-segmentation network continuously for a static bedroom source would compete for the same CPU/GPU budget without adding new information after the source image is known.

v26 therefore uses a scene-specific authored profile for the canonical bedroom image.

The profile identifies five presentation regions:

- window / city;
- pillow;
- subject;
- bed;
- foreground blanket.

Each region has a normalized polygon, an ordered presentation depth rank, opacity and transform origin.

These regions are **presentation masks only**. They are not ML segmentation output, metric depth, a reconstructed mesh or proof of physical geometry.

## Rendering

`PhotorealSceneSegments.tsx` is lazy-loaded only on `high` and `ultra` visual tiers.

Every segment reuses the same source image and clips it to its authored polygon. The existing camera-driven CSS variables then move each region at an appropriate bounded rate:

```text
window        → far room motion
pillow        → shallow mid motion
subject       → camera subject motion
bed           → near motion
foreground    → strongest near motion
```

Feathered CSS masks soften segment edges so movement does not expose hard polygon seams.

## Performance policy

The existing frame-time governor remains authoritative.

- `ultra`: all five regions may render;
- `high`: window and pillow are omitted;
- `reduced`: only the most important subject/foreground regions remain;
- `minimal`: all v26 segments are removed;
- reduced-motion: v26 segmentation planes are disabled.

The renderer does not add another model inference pass and does not add another WebGL context.

## Fallback

The older v21/v23 generic mid/near planes remain present as a low-cost fallback. On high/ultra tiers their opacity is reduced so the authored segments become the dominant depth cue without creating a visible double image.

## Boundary

v26 remains presentation-only:

- no scene-segmentation data enters long-term memory;
- no metric depth is fabricated;
- no claim of true 3D reconstruction is made;
- webcam perception and WebXR geometry remain separate;
- segment polygons are specific to the current bedroom source and must be reviewed if that source image changes.
