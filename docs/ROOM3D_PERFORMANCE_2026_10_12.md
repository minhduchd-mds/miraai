# MiraAI 3D performance pass — 12 October 2026

## Scope
This iteration preserves the approved 3D camera, scene placement, lighting,
avatar geometry, 3D gesture controls and all voice/camera permissions.

### Changes
1. **Instanced static detailing** in `RoomLuxuryInterior.tsx`.
   - 25 wood slats + 18 floor seams were 43 individual rounded meshes.
   - These are now 2 `THREE.InstancedMesh` objects, with the same
     rounded geometry, placements and author-selected per-instance colors.
   - This removes **41 scene draw calls in the comparable visible pass**
     in principle. Real GPU driver timings have not been measured.
   - The geometry is disposed on unmount; transform/color buffers are
     initialized once in a layout effect, not every rendered frame.
2. **Shader specialization**: the common static `Rounded` furniture now
   uses `MeshStandardMaterial` when clearcoat is zero. Physical
   clearcoat remains available for parts requiring it. All lighting,
   roughness, metalness and emissive values remain unchanged.
3. **Texture requests** in `VitruvianLabAvatar.tsx` reduced from 12 to 9.
   - The unused `vit_face_rough.webp` (1,086 KiB),
     `vit_hair_diffuse.webp` (59 KiB) and
     `vit_sclera.webp` (33 KiB) are still preserved in source assets,
     but not fetched/decoded/uploaded at runtime.
   - Total archive-size elimination in Human Lab is approximately
     **1,178 KiB (1.15 MiB)**. This is not a network timing benchmark.
   - The head/body/hair meshes and all **active** texture maps remain intact.
4. **Device-aware maximum DPR**: desktop >=1024 px with adequate memory
   stays at the previous 1.5 max; constrained devices cap at 1.25;
   mobile (<768 px) and Save-Data at 1.0.

### Acceptance and limits
- Node 24 + 26 CI and existing room/asset regression tests must pass.
- Visual QA is used to catch regressions in furniture, avatar and controls.
- GPU draw-call count, total VRAM, first meaningful model render, battery
  drain and FPS on target hardware are **not yet measured**; do not cite
  the above theoretical draw-call reduction as measured FPS improvement.
- A future controlled profiling pass should use the same hardware, browser,
  fixed camera, render resolution, scene and time interval for before/after.
- Do not rewrite the 3D avatar's facial mesh or hair shaders just to improve
  frame rate; those changes require separate visual approval.
