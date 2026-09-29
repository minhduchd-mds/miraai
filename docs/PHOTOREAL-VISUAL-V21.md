# Spatial Visual v21 — Real Depth & Sharpness

Spatial Visual v21 upgrades Mira's primary photoreal bedroom surface without changing the companion's perception or memory model.

## Source boundary

The current bedroom source decodes to a 1440×810 WebP. That is sufficient for a normal 1366×768 / 1440p CSS viewport, but a direct fullscreen upscale becomes visibly soft on high-DPI displays.

v21 therefore treats source resolution and presentation resolution as separate concerns:

- the original WebP remains the canonical source;
- the browser always retains a plain image fallback;
- supported devices add a WebGL resampling/sharpness pass at an adaptive DPR;
- no code claims that sharpening reconstructs detail absent from the source image.

## Adaptive visual quality

`photoreal-depth.ts` selects one of four session-only tiers:

- `lite`
- `balanced`
- `high`
- `ultra`

The decision uses viewport size, devicePixelRatio, hardwareConcurrency, optional deviceMemory and reduced-motion preference.

The tier controls:

- canvas render DPR;
- bounded GPU sharpness;
- clarity/contrast/saturation compensation;
- depth-layer opacity;
- atmospheric blur;
- micro-grain;
- parallax amplitude.

The GPU pass has a 12-megapixel render budget so high-DPI desktops do not allocate an unbounded fullscreen framebuffer.

## GPU clarity pass

`PhotorealSceneCanvas` renders the bedroom image through WebGL when the selected quality tier enables sharpening.

The fragment pass uses:

1. normal cover-resampling;
2. cross-neighbour edge enhancement;
3. bounded sharpness;
4. a luminance-based halo guard;
5. a normal CSS image underneath as fallback.

If WebGL fails, sharpness is disabled automatically and the source image remains visible.

## Layered depth

The photoreal scene is presented as several subtle planes:

```text
base image / GPU clarity
        ↓
mid-depth masked image
        ↓
near-depth lower-plane image
        ↓
atmospheric haze
        ↓
adaptive relight
        ↓
contact shadow
        ↓
micro grain
```

Parallax is deliberately small:

- far plane: up to ~1.8 px X;
- mid plane: up to ~3.4 px X;
- near plane: up to ~5.2 px X;
- perspective tilt remains below one degree.

Pointer movement and gaze/attention contribute to the same smoothed target. Reduced-motion disables the moving depth planes.

## Realism cues

v21 adds restrained realism cues rather than stronger decorative effects:

- slightly softer far layer;
- sharper mid/near structure;
- low-opacity atmospheric separation;
- local relight around the visual focal area;
- broad contact shadow to reduce the pasted-on appearance;
- very low-opacity grain to reduce digital banding.

Mood/state color adaptation remains independent and is applied after clarity compensation.

## Deployment contract

The canonical bedroom WebP is stored as base64 source parts in `assets-source/`.

Every `npm run build` now executes `scripts/restore-photoreal-assets.mjs` first. The restore step:

- joins all 11 source parts;
- base64-decodes the WebP;
- verifies the SHA-256 checksum;
- verifies RIFF/WebP container headers;
- writes `public/scenes/mira-bedroom.webp`.

The deploy artifact smoke test now requires the bedroom scene to exist. CI and GitHub Pages therefore build the same visual asset instead of relying on a Pages-only decode step.

## Boundary

Spatial Visual v21 is presentation-only. It does not:

- modify face/hand perception;
- store gaze, depth or visual-quality data in long-term memory;
- infer physical depth from the 2D bedroom image;
- claim GPU sharpening is super-resolution;
- bypass reduced-motion preferences.
