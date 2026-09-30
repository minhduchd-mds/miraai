# Spatial Visual v28 — Occlusion-aware View Refinement

Spatial Visual v28 adds subtle viewpoint-dependent micro-relighting and edge occlusion inside the existing single-pass GPU bedroom renderer.

## Why this step

v27 moves texture coordinates through a continuous authored depth field. That improves parallax, but a warped image can still look flat if every edge keeps identical brightness while the viewpoint changes.

v28 therefore uses the local gradient of the same authored depth field as a presentation cue:

- depth transitions facing the current viewpoint receive a very small highlight;
- depth transitions turning away from the viewpoint receive a very small occlusion darkening;
- subject-range depths receive slightly more refinement than distant room pixels;
- flat regions remain largely unchanged.

This is a visual approximation only. It does not infer surface normals, material properties or physical light sources.

## Single-pass shader

`PhotorealSceneCanvas` now combines, in order:

1. cover resampling;
2. authored continuous depth lookup;
3. optional v27 UV warp;
4. local depth-gradient sampling;
5. bounded micro-relighting / occlusion;
6. bounded sharpening;
7. halo protection.

No second WebGL context or post-processing canvas is introduced.

## Quality policy

View refinement is allowed only when:

- frame-time tier is `full`;
- reduced-motion is off;
- camera depth intensity is reliable;
- quality is `high` or `ultra`.

At `high` quality:

- warp remains off;
- micro-relighting/occlusion may run;
- redraw is capped at 24 FPS.

At `ultra` quality:

- v27 warp may run;
- v28 relight and occlusion run in the same draw;
- redraw is capped at 30 FPS.

Reduced/minimal performance tiers disable the refinement completely.

## Bounds

Maximum presentation strengths are deliberately small:

- relight strength: 0.22;
- occlusion strength: 0.18.

Final pixel modulation is smaller again because the shader multiplies those controls by local edge strength and a small subject-depth weighting.

## Boundary

v28 is presentation-only.

It does not:

- infer true normals;
- estimate real illumination;
- reconstruct physical scene geometry;
- create metric depth;
- persist camera pose or view-lighting state;
- add another perception model;
- add another WebGL context.
