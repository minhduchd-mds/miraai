# Mira — Original Human v1 pipeline (16 October 2026)

## Original procedural human lab — working 3D prototype

An entirely new, code-authored **stylized humanoid prototype** is now available on the native Three.js room, with no imported geometry/texture/animation or third-party character likeness. It is a fully volumetric seated figure with face, sclera/iris, nose, cheeks, separate eyelid meshes, PBR-like skin materials, layered hair strands, torso and limbs. It uses Character Director, natural gaze drift, a viseme envelope and only the existing outgoing TTS signal.

Open a capable desktop browser at:

`/?room3d=1&originalHumanLab=1`

Use existing room controls `1`–`6` for camera viewpoints; mouse drag to rotate. This sets avatar status to `review`, not `approved`. Production's default approved-avatar gate and unoccupied-chair behavior remain intact.

**Current visual quality is stylized procedural geometry, not photorealism**. The prototype gives a wholly owned motion/lighting/effect test fixture while the properly sculpted, separately reviewed high-fidelity original human is authored in Blender. It should not be silently promoted as the production Mira likeness. See `src/presence/OriginalMiraLabAvatar.tsx` and `scripts/original-human-lab.test.mjs`.

## Next authoring checkpoint

Record five true visual captures of the original prototype, particularly hair silhouette, eyes, chair intersection and expression movements. Use findings to sculpt an original realistic female avatar in Blender, then run the preflight and the SHA256-bound release rights gate described below.


**Status:** production avatar still PENDING. This describes a reproducible and copyright-conscious route, not a claim that Mira already owns or ships a photoreal human. No Weelife models, animations, clothing, hair, texture, proprietary shaders or branding may be incorporated.

## 1. Author the asset

Use Blender and **your own** original sculpt or a CC0 base with independently checked provenance. If using MakeHuman/MPFB, check the license of each additional skin, hair, clothing and shader asset individually: the base asset license does **not** license every third-party add-on.

Create one independently recognizable adult female character, her own face topology and wardrobe. Save:
- Blender `.blend` editable source and a rights ledger (creator, base source, receipt or CC0 reference, commercial/redistribution terms)
- Humanoid armature with head, neck, torso, shoulders, upper/lower arms and upper/lower legs; skinning weights tested
- Separate PBR face/skin, eye/iris, hair and clothing texture maps, including skin normal map
- Facial shape keys named `eyeBlinkLeft`, `eyeBlinkRight`, `jawOpen`, `mouthSmile`; VRM `aa/ih/ou/ee/oh` or equivalent visemes recommended
- Rig authored neutral and seated poses without chest/hair/hand–chair intersections
- Five test renders (front, left 45°, right 45°, side profile, back) plus eye/face close-up
- Low/mid/high geometry levels as permitted by actual hardware QA; do not claim photorealism based on triangle count

## 2. Blender local source gate

```bash
blender --background /path/to/mira-original-human.blend \
  --python scripts/blender/mira_human_preflight.py \
  -- --output /tmp/mira-original-preflight.json
```

This checks armature/bone naming, skin binding, geometry count, source image presence, region-tagged PBR materials and facial shapes. Custom material property `miraRegion` may be set to `skin`, `eyes`, `hair` or `outfit`. It does not inspect plagiarism, legal rights, accurate ethnicity/identity, visual realism or GPU FPS.

Correct issues in Blender, export rigged glTF 2.0 binary (`.glb`) with baked or source texture images and the real exported shape keys. If the asset is VRM, ensure it has valid humanoid metadata. Avoid separately licensed animation assets unless redistribution rights are explicit.

## 3. Stage locally without production activation

```bash
node scripts/stage-realistic-avatar.mjs \
  --file /path/to/mira-human-v1.glb \
  --asset mira-human-v1.glb \
  --license PROPRIETARY-OWNED \
  --source-url https://source-author.example/path/to/artwork
```

When authoring Mira's own bespoke character, use `PROPRIETARY-OWNED` and retain the commission/source contract and exclusive ownership records. The name is an internal rights category, **not** an SPDX license or independent proof of ownership. If an externally licensed CC0/CC-BY base is used, verify whether attribution and derivative obligations apply to the actual distributed art.

The staged binary must pass existing `qualityReport()` and `auditHumanAssetRig()`; staging writes an SHA256-bound `mira-human-v1.glb.rights.json` with **all approval fields intentionally blank/false**, and leaves `manifest.json` at `pending`. The source URL shown is a placeholder: use the *real* author URL in practice.

Only the development build's established `?room3d=1&avatarReview=1` path may display a pending candidate for QA. Do not turn on production before quality, legal and likeness review. Any new binary committed to GitHub must be registered in `MIRA-ASSET-RIGHTS-INVENTORY.json` with its actual SHA and authentic provenance; do not force it into a verified status.

## 4. Rights and release approval

The rights dossier must bind to the **exact binary SHA256**, license, origin, commercial/redistribution/modification permissions, creator, rights holder and a genuine HTTPS evidence record. CC BY requires attribution and a license notice URL. Visual evidence requires front/left45/right45/profile/back review URLs; rights and visual reviewers plus dates must be recorded.

Only after independent rights + visual review should `manifest.json` be changed to `status: approved`, `visualApproval: approved`. The build gate calls:
```bash
npm run check:avatar-release
npm run check:avatar
npm run check:rights
npm run check:licenses
npm run check
```

The release gate cross-checks actual bytes with dossier and existing rig/PBR validators. A forged record is still possible; automated checks are **not** a legal title certificate or photorealism judgment. Real approval requires examination of raw source and creator records.

## 5. Packaging and regression

`scripts/prune-runtime-assets.mjs` removes pending human VRM/GLB and old experimental models from compiled artifacts; `scripts/check-deploy-artifact.mjs` rejects leaks. Brain, Memory, TTS and the new state-blended character director remain independent of this pipeline.

Perform device/browser QA: 5+ views, face closeups, chair contact, silent and active TTS, 95th percentile frame time, GPU memory, thermal budget and visual quality before declaring this complete.

## Known limitations

- No fully approved photoreal model is currently part of this release.
- Code-level gates cannot guarantee copyright ownership or predict whether a model resembles a third-party protected character.
- Pending WebP scene and expression copyright evidence must still be obtained.
- Public Git history still contains legacy unreviewed model assets: filtering `dist` is not removal from Git history.
