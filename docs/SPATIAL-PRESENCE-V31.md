# Spatial Presence v31 — perceptible 3D photo depth

## Change

- Existing CSS multipane depth was muted to opacity .045 in **all** high/ultra scenes, although authored semantic segment layers exist only in the `bedtime` composition. Now the mute applies only to bedtime. Daytime, welcome-home and home-evening retain their existing middle and near foreground depth even when WebGL is unavailable.
- Add a **lazy** React Three Fiber photo bas-relief renderer for the four current source photographs. One subdivided mesh (64×40), one texture, authored scene-dependent Z-depth, perspective camera driven by existing pointer/head-pose motion. Texture cropping honors `object-fit: cover` and the source aspect ratio.
- Default activation: desktop width >=900px, quality high/ultra, full performance tier, reduced-motion OFF, Data Saver OFF. `?spatial3d=1` explicitly tries it in balanced quality; `?spatial3d=0` disables it. `lite`, reduced/minimal performance tiers, Data Saver and reduced-motion always use the original WebP presentation.
- Existing photoreal WebGL resampling and bedtime segmented overlays do **not** mount while the 3D renderer is selected, avoiding duplicate GPU canvases. 3D uses React Three Fiber/Three.js already in the project; no new A-Frame runtime dependency.
- Browser keeps the existing WebP scene until 3D texture reports loaded and a frame can render. WebGL/texture failures fall back to WebP for the session.
- The renderer uses `frameloop=demand`, triggered by pointer/head movement, with camera smoothing that invalidates while settling; no continuous fixed 60 FPS scene redraw.

## Scope and accuracy

This is **2.5D bas-relief with real geometric perspective**, *not* a reconstructed photogrammetric room. A single image contains no unseen surfaces. Large lateral movements would stretch the texture; camera movement is deliberately bounded to <0.42 world units. To produce genuine free-walk 3D, obtain individual character/room/foreground textures or a scanned GLB/NeRF/Gaussian splat asset.

## Performance and safety

- One geometry ~2,665 vertices, one photo texture, no live segmentation model and no extra camera capture.
- No head pose/pointer trace is stored or sent to the network. All depth is a purely local presentation effect.
- Existing audio, gestures and neural perception keep priority. MutationObserver watches the existing render-performance tier and disables the 3D layer if it degrades.
- Tests cover depth shape for 4 scenes, quality/performance/user-motion policy, bounded perspective and lazy single-renderer integration. CI validates the initial JS budget and TypeScript.

## A-Frame evaluation

A-Frame 1.8.0 supports embedded WebXR and glTF scenes and remains a useful experimental framework for immersive XR. It is not required for this photographic scene: Mira already ships Three.js plus React Three Fiber. Loading A-Frame in production would add another framework and risk a redundant render loop. Consider an isolated immersive/Labs route when authentic GLB room assets become available.
