# Spatial Visual v25 — Environment Realism

Spatial Visual v25 makes the bedroom environment feel more physically coherent without adding another perception model or another WebGL scene pass.

## New environment layers

The existing adaptive environment pipeline now drives four additional presentation-only channels:

- city/window bokeh;
- volumetric light rays;
- bed/fabric bounce light;
- edge occlusion.

These layers are derived from the already-available environment label, confidence, attention, camera 3D intensity and visual-quality tier.

## Physical coherence

The room is still a 2D source image with layered presentation depth. v25 does not claim measured scene geometry.

The realism gain comes from keeping environmental cues spatially consistent with the camera viewpoint:

- window bokeh and window light move least and remain in the far plane;
- light rays rotate/shift with the room viewpoint;
- bed bounce follows the foreground more closely;
- reflections follow subject motion slightly;
- edge occlusion follows the near plane.

## Performance degradation

The existing frame-time governor remains authoritative:

- `full`: all v25 layers may render;
- `reduced`: light rays are removed and city bokeh is reduced;
- `minimal`: city bokeh, light rays, bed bounce and edge occlusion are removed;
- `lite` visual quality disables all v25 environment depth layers.

No camera-driven blur or backdrop-filter animation is introduced.

## Boundary

v25 is presentation-only. It does not:

- change face/hand/environment perception;
- persist environment appearance in long-term memory;
- claim that the rendered bedroom is the user's real room;
- infer a physical depth map from the bedroom image.
