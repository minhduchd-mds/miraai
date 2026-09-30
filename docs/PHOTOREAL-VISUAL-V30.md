# Spatial Visual v30 — Disocclusion-safe Warp

Spatial Visual v30 makes the single-pass GPU depth warp more conservative around areas where a single static image cannot safely reveal hidden pixels.

## Problem

A 2.5D warp can look convincing in stable interior regions, but stronger motion near depth discontinuities or source-image edges can stretch texture or create ghosting.

Because the bedroom source contains only one view, Mira cannot reconstruct pixels that were never visible in the source.

v30 therefore does **not** invent or synthesize hidden content. It reduces warp locally where the risk of disocclusion artifacts is high.

## Per-pixel safety envelope

The shader now evaluates four guards:

- depth-boundary guard from the local authored-depth gradient;
- continuity guard from the depth mismatch between the original and candidate warped UV;
- source-edge guard near the texture boundary;
- temporal guard from the v29 stability score.

These factors are multiplied into a bounded `warpConfidence`.

The final UV becomes:

```text
base UV
   ↓
candidate warped UV
   ↓
depth / edge / temporal safety
   ↓
mix(base UV, candidate UV, warpConfidence)
```

Stable interior regions keep most of the v27 warp. Risky boundaries and source edges fall back toward the original UV.

## Interaction with v28/v29

- v28 micro-relighting follows the safe warped result;
- positive micro-light is attenuated by `warpConfidence`;
- v29 temporal stability directly lowers warp confidence during recovery;
- existing 24/30 FPS redraw limits remain unchanged.

## Performance

v30 adds shader arithmetic and authored-depth lookups only.

It adds:

- no model inference;
- no React state;
- no DOM layer;
- no extra texture;
- no extra WebGL context;
- no second render pass.

## Boundary

v30 is artifact suppression, not scene reconstruction.

It does not:

- fill hidden geometry;
- hallucinate missing pixels;
- estimate metric depth;
- infer a second camera view;
- persist camera/depth state.
