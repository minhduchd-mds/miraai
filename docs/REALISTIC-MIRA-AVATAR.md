# MiraAI Human Avatar — photorealistic VRM production contract
Updated: 2026-10-09

## Visual acceptance
The previous female VRMs are **stylized development previews**, not humans. A mere warm shader, dark hair or scale change cannot give a photographic face. **Do not mark the work as photoreal complete while the manifest is pending.** Requirements:
- Natural adult female proportions matching the user's approved concept, with nuanced facial anatomy, realistic skin pores/roughness/normal maps and separate eye/cornea materials
- Layered dark hair with translucency/alpha sorting, cream knit/cardigan, and seated hand-to-cheek pose without self-intersections
- Facial expressions (blink, smile, mouth shapes), gaze, head motion and deformation that hold at front, side 45/90 degrees and rear views
- Correct object scale and PBR skin exposure in the existing ACES-lit room at 1366x768
- Detailed reference match needs editorial **human approval** comparing renders; geometry/texture heuristics alone cannot certify 100% likeness

## Asset authoring pathways (choose one)
**Open toolchain:** MakeHuman/MPFB (core CC0 assets) -> Blender sculpt, real skin and hair cards, rig + eye joints -> export via VRM Add-on for Blender. Check licenses of any *third-party* skin/hair/wardrobe assets separately. Recommended for open/reproducible web output.

**High-end toolchain:** MetaHuman Creator in Unreal Engine 5.6+, optimize/retopologize and bake materials, export character through a separately validated GLB/FBX pathway, rig to VRM in Blender (ensure Epic license permits the intended distribution, and review external assets). The old web Creator is being discontinued in Nov 2026. Avoid assuming Unreal shaders and groom hair will export 1:1 to three.js.

## Integration and approval
1. Produce **one native VRM 0.x or 1.0** file with complete humanoid metadata: `public/avatars/realistic/mira-human-v1.vrm`. Do not ship a photo quad, billboard or a fake GLB with missing VRM metadata.
2. Keep model's PBR maps intact (skin albedo/normal/roughness, fabric, eyes and hair); do not recolor all meshes in runtime. Optimize total binary <=50MiB; desktop performance should remain viable.
3. Set `public/avatars/realistic/manifest.json`: `status="approved"`, `visualApproval="approved"` **only after** reference renders reviewed, `sourceUrl` (HTTPS), `license`, and actual `scale`, `position` and `rotationY`. Filename must be a safe local `.vrm` filename, without slashes or external URL.
4. Run `npm run check:avatar` and full CI. The structural check requires glTF 2, VRM metadata, humanoid skin, 30K+ source vertices, at least three textured layers, normal maps and identifiable head bone. These checks are *minimum heuristics*, not proof of human realism.
5. Take Chromium screenshots at 0°, +/-45°, +/-90°, 180°, plus focused face close-ups, and review against the user's reference. Test blinking, smiling, looking around, and arm-chair/table intersections. Record reviewer/sign-off before replacing the preview.

## Runtime
`RoomMiraVRM.tsx` reads the same-origin manifest. Only approved local `.vrm` assets with provenance are eligible. When the manifest is pending or an approved model fails to load, it falls back to the **existing stylized preview**, not a falsely claimed realistic model. An approved model retains its authored PBR maps and own transform, while the development preview keeps legacy wardrobe-color adaptation. The rest of the 3D room and `voice-footer state-idle` are unaffected.

## Current honesty
As of this commit, **no approved realistic VRM asset is included**. This change builds a controlled asset pipeline and quality gate; it does **not** manufacture a human likeness from the reference photograph.
