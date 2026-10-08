# Spatial Room 3D v32 — geometry-backed walkaround experience

## Why

The prior `?spatial3d=1` view creates a real mesh displacement from one image, but does not have separately modeled walls/furniture or let the camera actually move around the room. It is accurately classified as 2.5D, not a navigable interior. An equirectangular 360 photo permits head rotation but not spatial translation.

## Implementation

- The explicit `?room3d=1` route toggles a lazily loaded **geometry-backed** scene in `PhotorealRoom3D.tsx`, using the existing Three.js and React Three Fiber runtime.
- Geometric elements: 10×12×3.8 unit shell (floor, ceiling, four walls), bed and headboard/pillows, sofa, coffee table, desk, shelves, plants and an illuminated window with stylized skyline. Everything has real independent spatial coordinates and mesh surfaces. A camera can orbit/yaw and translate within safe bounds.
- Drag left/right to turn around a full 360°. Drag vertically to look up/down. WASD moves across X/Z; arrow up/down move; arrow left/right turn. Pointer capture is released on up/cancel. Keyboard capture ignores text fields and contenteditable elements.
- `?room3d=1` is a **diagnostic 3D room mode**, separate from existing `?spatial3d=1` photographic 2.5D renderer; its geometry is an artistic approximation of Mira's home, not an exact 3D reconstruction of the panorama image.
- Lazy chunk. `frameloop=demand`; only redraw when camera moves, with input-driven invalidation. DPR limited to 1–1.5. No A-Frame dependency, second scene camera, remote asset calls, textures, ML model or voice pipeline changes.
- The original WebP remains visible until 3D frame readiness is indicated. WebGL or component error falls back to old image; reduced motion, lite devices, Data Saver and reduced/minimal performance tiers do not mount the renderer.

## QA gates

`scripts/spatial-room3d.test.mjs` verifies 3D geometry, camera and movement, performance limits, opt-in, keyboard accessibility and safety. Full project CI verifies TypeScript, bundles, functional unit suite. Visual QA using an actual WebGL browser still needs device-specific confirmation.

## Next quality step

Replace stylized box meshes with optimized GLB/PBR furniture, use proper shadows and room baking, and, if the exact 360 photograph is intended to be walkable, obtain corresponding depth+multi-view imagery or a photogrammetry/NeRF/3D scan. A single panoramic JPG cannot provide hidden surfaces for translation.
