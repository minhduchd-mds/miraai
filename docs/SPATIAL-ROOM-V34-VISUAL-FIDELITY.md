# MiraAI Spatial Room v34 — art-directed concept fidelity

The canonical visual reference is the user-approved 1672×941 composite image in conversation: Mira in a white cardigan at a marble desk; warm furnished interior, city window left, sofa left, illuminated workstation, large cream bed right, wardrobe and ring ceiling light; five conceptual camera views.

## Built

- Preserved existing genuine 3D floor/walls/furniture and bounded orbit/walk camera, with pointer-drag and WASD.
- Added foreground Mira photographic portrait using the repository's *existing* `expr_01_gentle.webp` image and a radial alpha mask; stylized sweater/seat geometry under it. The image remains a billboard, **not** a scanned VRM/GLB character.
- Added warm ceiling torus, wood slat headboard, sofa cushions and throws, desk workstation/monitor, wardrobe, candles, rug, drapes, decorative illumination, foreground keyboard and marble desk. Camera presets 1–5 map to front, left, right, back and overview.
- The photographic WebP fallback remains on screen until the actual face image has loaded into the WebGL scene.
- Reused existing Three.js/React Three Fiber, frameloop-demand, DPR limits, reduced-motion and saving-data gates. No extra packages, no fake camera telemetry, no upload of private user images.

## Fidelity boundary

**This is not a 100% pixel-identical scene.** The approved reference is an AI-generated single composite image; it provides neither hidden surfaces nor a rigged 3D human nor PBR texture maps. Exact static frontal view requires displaying the approved source image itself. Matching all 360° views and person appearance requires a new artist-authored GLB/VRM avatar, textured interior GLBs and separately approved multi-angle renders. Do not label this production experiment as a photogrammetric scan.

## QA

`scripts/spatial-room3d.test.mjs` covers presence of photographic sprite and five presets; the main CI runs TypeScript/unit/bundle checks. Full visual regression of angle accuracy needs additional art assets and image-based comparison.
