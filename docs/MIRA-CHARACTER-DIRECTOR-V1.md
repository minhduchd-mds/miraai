# Mira Character Director v1 — 2026-10-16

## Scope implemented

- Added an original, deterministic procedural micro-gesture director: expressive head turns/nods, subtle torso tilt, asymmetric upper-arm motion.
- Blends between `speaking`, `listening`, `thinking` and neutral Mira states; signal amplitude is bounded and uses **existing TTS output energy**, never microphone audio.
- Adds motion **on top of the author's rest pose** for rigged VRM/GLB; preserves chair pose and authored art, avoids writing a new camera permission path.
- Resets state when a different validated avatar loads. No new model, texture, animation clip or third-party asset is distributed.
- Has deterministic unit tests and structural renderer-wiring regression tests.

## Copyright clean-room record

This work implements general humanoid animation and state-blending ideas in Mira's existing Three.js runtime. No Weelife program code, binary, mesh, animation, shader, images, likeness, audio or branding has been imported. Third-party model and animation rights remain subject to a per-asset license/provenance check.

## Important production gate

`public/avatars/realistic/manifest.json` remains `pending`: **no approved photoreal human asset is present**. This release improves the runtime for a future legitimate rigged asset, not the quality of a missing production avatar. For manual inspection, use the project's existing explicit avatar-review preview; do not bypass `chooseRoomAvatar`.

## Validation

- `node --test scripts/character-director.test.mjs`
- `npm run check` (requires Node 24.x, restored dependencies, GPU manual checks when available).
- Review five-plus camera angles and seated hand/chair intersections on a licensed model before visually approving it.
- Benchmark p50/p95 frame time, GPU memory and perceived gesture smoothness on mobile/desktop; no GPU measurements are asserted by unit tests.

## Remaining

Production-grade original facially rigged human asset; authored gesture clips + contact-aware IK; more accurate Vietnamese visemes; texture/hair/eyes PBR and device-level validation. No photoreal approval is granted by this commit.
