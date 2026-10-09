# MiraAI photoreal 3D avatar — asset selection and acceptance (9 October 2026)

## Current state — not yet photoreal
The repository's VRoid characters are deliberately not approved as the public Mira character. `public/avatars/realistic/manifest.json` is pending and the target `mira-human-v1.vrm` does not exist in the repository. Thus **Production does not yet render a photorealistic human Mira**. Camera, room and voice remain functional independently. Do NOT mark a random anime VRM approved or recolor its hair and describe it as real.

VRM is a humanoid file format, not an anime-only rendering technique. Both approved PBR VRMs and rigged GLBs must pass runtime and CI checks:
- actual 3D skinned mesh with at least 30K vertices and no >1.25M-triangle overload;
- independent textured material layers for skin/face, hair and garments; surface normal mapping, identifiable head rig and lit physically based shader;
- compatible pose/humanoid rig for seated placement (Mixamo-style GLB supported);
- same-origin provenance, an appropriate redistribution license and **human visual approval** comparing five views with the approved concept. A technical pass alone does not prove face fidelity.

## CC0 sources to evaluate — candidates only, not deployed assets
1. MakeHuman / MPFB community assets, whose released asset set is CC0. Human character generation permits more realistic anatomy and UV skin textures. Documentation: https://github.com/makehumancommunity/mpfb2 and https://github.com/makehumancommunity/makehuman
2. Innerscene **Nora — woman in casual clothes**, GLB (~17MB), attributed to MakeHuman/MPFB CC0 assets: https://www.innerscene.com/tools/library/3d-parts/nora-3d-person-woman-casual-with-bag-ab002aeb
3. Innerscene **Sage — woman walking**, GLB (~20MB), MakeHuman/MPFB CC0: https://www.innerscene.com/tools/library/3d-parts/sage-3d-person-woman-walking-a458e4c3
4. Innerscene **Harper — business-suit woman**, GLB (~15MB), MakeHuman/MPFB CC0: https://www.innerscene.com/tools/library/3d-parts/harper-3d-person-woman-business-suit-standing-9fde7f08

These references are **not** approved for Mira yet. Before staging, retrieve the actual archive, verify it really contains skin/hair/garment texture maps and rig bones, check source license, and confirm whether the author baked a non-seated pose. Unrigged walking or static figures cannot be made naturally seated by simply rotating their parent mesh.

## Procedure
1. Produce or obtain a licensed photoreal, facially consistent female asset (prefer rigged GLB/VRM), separate black hair, cream cardigan, face and skin PBR textures. Keep sculpt/texture original files for edits.
2. Stage using `node scripts/stage-realistic-avatar.mjs --help` and the supported CLI format; do not invent a remote URL to bypass the pipeline.
3. Run `node scripts/validate-realistic-avatar.mjs`; inspect 5 actual WebGL render screenshots, closeups, lighting, hair shader and eyes. Adjust the seated skeleton, feet/seat collisions, camera and rig scale.
4. Once reviewed, explicitly mark the same-origin realistic asset approved. The loader validates BOTH VRM and GLB at runtime; a malformed file falls back safely rather than silently displaying the stylized model.
5. Validate voice-footer remains unchanged and 3D scene shows no subtitles, annotations or old 2D character layer.

**Remaining blocker:** no accepted photoreal asset has been uploaded. Staging guidelines and stricter code do not create a lookalike model from the single 2D reference.
