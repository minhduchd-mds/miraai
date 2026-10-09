# Photorealistic human asset integration — MiraAI

- MiraAI must use a **realistic 3D human**. Existing five VRoid / anime VRM files are for developer preview ONLY. Use `?avatarPreview=1` to inspect the old model; by default the scene is not allowed to quietly label anime as realistic Mira.
- A reviewed model can be `.vrm` (VRM 0/1 humanoid) **or** `.glb` (rigged glTF 2.0 human). Many realistic models use GLB. Runtime and CI validate metadata, provenance, rig, geometry density, textured PBR skin/clothes/hair and normal map. Human visual approval of front/left/right/quarter views is compulsory.
- Place licensed asset as `public/avatars/realistic/mira-human-v1.vrm` or `mira-human-v1.glb`, review the model license, edit `public/avatars/realistic/manifest.json`: `status=approved`, the asset filename, `license`, HTTPS `sourceUrl`, `visualApproval=approved`, scale/position/rotation. Until then status remains `pending`.
- CI check: `node scripts/validate-realistic-avatar.mjs`. Metadata alone cannot prove identity or photorealism; use browser render comparison. No redistribution of uncertain third-party files.
- Missing or rejected assets must not silently load stylized VRM. The default room remains an actual WebGL room with an unoccupied hero chair until the required approved avatar exists; the voice assistant continues working.
- Existing UI remains clean: `voice-footer` controls only, no 3D instructions.

Potential licensed sources for bespoke assets: MakeHuman/MPFB core CC0 (<https://github.com/makehumancommunity/mpfb2>), but a bare anatomical base is NOT itself an approved finished photoreal Mira. Review realistic human model materials and bespoke cardigan/hair, and license terms before redistribution. Avoid assuming third-party Avaturn/MetaHuman model downloads are Apache or CC0.
