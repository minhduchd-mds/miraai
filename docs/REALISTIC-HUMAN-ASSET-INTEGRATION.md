# Photorealistic human asset integration — MiraAI

- MiraAI must use a **realistic 3D human**. Existing five VRoid / anime VRM files are for developer preview ONLY. Use `?avatarPreview=1` to inspect the old model; by default the scene is not allowed to quietly label anime as realistic Mira.
- A reviewed model can be `.vrm` (VRM 0/1 humanoid) **or** `.glb` (rigged glTF 2.0 human). Many realistic models use GLB. Runtime and CI validate metadata, provenance, rig, geometry density, textured PBR skin/clothes/hair and normal map. Human visual approval of front/left/right/quarter views is compulsory.
- Place licensed asset as `public/avatars/realistic/mira-human-v1.vrm` or `mira-human-v1.glb`, review the model license, edit `public/avatars/realistic/manifest.json`: `status=approved`, the asset filename, `license`, HTTPS `sourceUrl`, `visualApproval=approved`, scale/position/rotation. Until then status remains `pending`.
- CI check: `node scripts/validate-realistic-avatar.mjs`. Metadata alone cannot prove identity or photorealism; use browser render comparison. No redistribution of uncertain third-party files.
- Missing or rejected assets must not silently load stylized VRM. The default room remains an actual WebGL room with an unoccupied hero chair until the required approved avatar exists; the voice assistant continues working.
- Existing UI remains clean: `voice-footer` controls only, no 3D instructions.

Potential licensed sources for bespoke assets: MakeHuman/MPFB core CC0 (<https://github.com/makehumancommunity/mpfb2>), but a bare anatomical base is NOT itself an approved finished photoreal Mira. Review realistic human model materials and bespoke cardigan/hair, and license terms before redistribution. Avoid assuming third-party Avaturn/MetaHuman model downloads are Apache or CC0.

## Staging and reviewing a high-fidelity human (v42)

1. Obtain a licensed **realistic rigged human** GLB/VRM, with skin/face/hair/garment maps, a normal map, a recognized humanoid head joint and an appropriate seated pose. A technical validator does not establish facial realism; inspect actual renders against the approved reference.
2. Stage a local file WITHOUT automatically deploying it into Mira's public identity:

```bash
npm run avatar:stage -- --file /path/to/mira-human-v1.glb --license CC0-1.0 --source-url https://the-original-author.example/licensing --pose-mode authored
npm run check:avatar
```

Supported introductory redistributable licenses: CC0-1.0 and CC-BY-4.0 only (CC BY requires author attribution, which must be added alongside the model). Other licenses need separate legal review. The command refuses overwrites and invalid rig/texture budgets. Staging writes `status=pending, visualApproval=pending`. Production's normal route DOES NOT load pending assets.

3. Preview this same-origin candidate on a local build at `?room3d=1&avatarReview=1`. Check frontal, quarter, left, right, and back views with room furniture occlusion. This diagnostic URL never enables anime unless the separate explicit `avatarPreview=1` flag is used.
4. After a human has positively reviewed likeness and confirmed rights, manually change both `status` and `visualApproval` to `approved` in `public/avatars/realistic/manifest.json`. Run `npm run check:avatar` and the browser QA before pushing. Never auto-approve solely from the number of triangles.
5. If no suitable realistic human is owned, keep the pending manifest: showing an unoccupied chair is preferable to misrepresenting an anime avatar as a photoreal Mira.

