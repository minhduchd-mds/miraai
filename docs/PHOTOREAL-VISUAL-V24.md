# Spatial Visual v24 — Adaptive Environmental Realism

Spatial Visual v24 makes the photoreal bedroom feel less like a flat image by adding restrained environmental lighting, atmospheric separation, optical grounding, and an automatic frame-time governor.

## Inputs

v24 reuses information already produced by the camera pipeline:

- inferred environment label;
- environment confidence;
- interaction attention;
- camera-driven depth intensity;
- visual quality tier.

No additional detector or vision model is introduced.

The environment label remains probabilistic. It is used only to tune presentation and never to claim that the rendered bedroom matches the user's real room.

## Environment rendering

The scene now contains presentation-only layers for:

- cool window glow;
- warm practical light;
- soft bounce/reflection over the bed and foreground;
- subtle atmospheric haze;
- contact-shadow reinforcement;
- extremely low-opacity dust particles;
- optical vignette.

The existing room, subject and foreground depth planes remain authoritative for camera motion.

## Environment mapping

`photoreal-environment.ts` maps the detected environment into restrained tone weights.

Examples:

- `workspace` biases slightly cooler;
- `rest_area` biases warmer and increases practical-light contribution;
- `living_area` stays balanced;
- unknown/low-confidence input remains conservative.

All values are bounded to 0..1 and scaled by visual-quality and performance tiers.

## Performance governor

`PhotorealPerformanceGovernor` observes requestAnimationFrame delta time from the existing photoreal render loop.

It keeps a short rolling window and switches between:

- `full`;
- `reduced`;
- `minimal`.

A sustained slow-frame window steps effects down. Sustained healthy frame timing allows them to recover.

The governor never reduces:

- face/hand perception;
- speech;
- interaction;
- camera tracking;
- core scene visibility.

It only scales or disables decorative environment rendering.

## Cost controls

v24 avoids a second animation loop.

Environment calculations run inside the existing scene requestAnimationFrame loop. Camera/environment mapper code remains dynamically imported.

When performance degrades:

- dust is disabled first;
- reflection is simplified;
- minimal mode keeps only lightweight room illumination;
- reduced-motion disables animated dust entirely.

Camera-driven movement remains compositor-oriented.

## Browser compatibility cleanup

v24 also moves derived atmosphere, relight and contact-shadow offsets into JavaScript CSS variables instead of relying on CSS arithmetic that multiplies typed values. The final transforms now consume normal pixel variables directly.

## Boundary

Spatial Visual v24 is presentation-only.

It does not:

- infer physically measured room illumination;
- persist room/environment telemetry;
- alter environment classification;
- run an additional object detector;
- claim volumetric reconstruction;
- sacrifice perception quality to maintain frame rate.
