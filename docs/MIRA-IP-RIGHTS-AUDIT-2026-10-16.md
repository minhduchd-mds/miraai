# Mira AI — Intellectual property and media provenance audit
Date: 2026-10-16

## Decision: NOT YET CLEARED for an unconditional copyright-safe claim

Engineering review of the public `minhduchd-mds/miraai` repository. This is not a legal opinion. **Absence of a discovered violation is not proof of ownership or valid distribution rights.** Root Apache-2.0 LICENSE does not relicense third-party images, characters, audio, UI artwork or VRoid presets.

### Scope and measured evidence

- Enumerated 135 existing media files / encoded media fragments in `docs/MIRA-ASSET-RIGHTS-INVENTORY.json`, with per-file Git blob SHA-1 and recorded byte length. Hashing proves integrity, **not licensing**.
- Categories: 25 encoded media fragments, 17 VRoid/legacy avatar assets, 15 Vitruvian Lab assets, 1 Gaussian Splat, 2 concept references, 18 scene media, 24 expression artworks, 31 effects/poses/gestures/UI media, 1 bedroom WebP, 1 application icon.
- All remain `review_required` or `declared_cc0_lab_only`, **none is declared rights-verified**.
- `scripts/audit-asset-rights.mjs` now detects newly added, missing, symlinked or silently replaced media and requires review of all inventory changes. It does **not** automatically approve modified art.
- `scripts/prune-runtime-assets.mjs` now excludes unverified VRM preview models, `splat.ply`, Vitruvian Lab derivatives and reference portraits from normal **compiled** release output. See `check-deploy-artifact.mjs` assertions.
- Source files and history are still in the public GitHub repository. Build pruning is not erasure from Git history and does not cure preexisting distribution obligations.

### Rights findings and actions

| Area | Finding | Severity | Required next action |
| --- | --- | --- | --- |
| Procedural animation / gaze / visemes | New in-repo algorithms based on general animation techniques; no Weelife assets or code imported by these changes | Low based on inspected diffs | Preserve original source and change history |
| VRoid preview | Character source, pixiv preset and third-party clothing/texture rights undocumented for each exported VRM | High | Retrieve avatar metadata and creator records, determine redistribution terms; replace unproven models |
| Gaussian Splat | Source scene/capture permission and likeness releases not recorded | High | Establish creator, underlying source photos/scan rights, subject permission |
| Vitruvian Lab | Declared CC0 character/textures and MIT code at upstream; Mixamo animations in upstream governed separately by Adobe | Medium | Match local binaries to upstream commit, inspect animations, follow attribution and all non-CC0 terms; keep Lab only |
| Main WebP scenes / facial expression images | No per-file generation provenance, originating reference rights or model releases | High | Establish generating account, prompts/source inputs, third-party image permissions and rights to identifiable likenesses |
| Reconstructed bedroom media | Build SHA256 attests restored bytes, **not** image ownership | High | Validate original author or generation source |
| UI artwork and desktop icon | No creator/source statement pinned | Medium | Confirm design ownership and any third-party icon licenses |
| Dependencies | 115 package-lock entries: 79 MIT, 13 BSD-3-Clause, 8 Apache-2.0, 3 ISC and 12 MPL-2.0 (Lightning CSS platform binaries) | Medium | Preserve required copyright notices, produce distribution SBOM, recheck versions on upgrade |
| ElevenLabs / other services | API service rights and generated speech conditions not proved by npm license data | Needs service-specific review | Check voice, likeness, output and plan terms separately |

### Official service-license checks (16 October 2026)

- **ElevenLabs** official terms updated 9 October 2026: paid service outputs may be commercially used subject to rights and prohibited-use policy; free-tier outputs are non-commercial only, and the free publishing attribution rules apply. The user's actual generating plan and voice identity permissions are not confirmed by this source audit. See https://elevenlabs.io/terms-of-use and https://help.elevenlabs.io/hc/en-us/articles/13313564601361-Can-I-publish-the-content-I-generate-on-the-platform
- **Adobe Mixamo** official FAQ allows royalty-free personal/commercial project usage of characters/animations, but redistribution of raw standalone animation/character files is a separate restriction clarified by Adobe community guidance. Do not add raw FBX or baked extractable action clips to the open repo before reviewing the license. See https://helpx.adobe.com/creative-cloud/faq/mixamo-faq.html and https://community.adobe.com/questions-696/mixamo-faq-licensing-royalties-ownership-eula-and-tos-589400

### Key precautions

1. Do not copy Weelife binary, character mesh, animation clips, shaders, textures, voice packs, code or distinctive character likeness. General rigging, shading, blending and animation-state concepts can be independently implemented, subject to applicable law.
2. VRoid Studio allows many commercial usages under its own terms, but pixiv's presets are **not** CC0 and third-party assets need their own permissions. Never infer a blanket redistribution grant.
3. Upstream VitruvianGodot declares the character CC0 and code MIT. Do not infer that bundled Adobe Mixamo animations are CC0. A lab manifest with a license label alone cannot verify an individual binary.
4. MPFB core **assets** are CC0; the **tool's code** has another license. Modelling with CC0 base meshes does not give you rights to external hair, clothes, scanned images or copied textures.
5. Respect open-source notices and license texts in distributed web/desktop bundles. In particular, MPL-2.0 has obligations applicable to covered files if distributed; treat the package-lock metadata as a starting point only.
6. If an asset is generated with AI, record the generator's output terms and the source/reference inputs. Generation alone does not assure exclusivity or that a third party's protected material was not reproduced.

### What is shipped now

Standard deployment continues to ship core 2D/WebP experience, which **still has unverified image provenance**. Excluding 3D Lab binaries does not create full copyright clearance. The experimental URL modes may lack unapproved 3D previews on production; this is deliberate, and local Labs still use checked-in files.

### Approval checklist before commercial release

For each media file, record: author/owner, date, source URL or creation log, unedited original, license and redistribution terms, model release/consent where applicable, downstream attribution, third-party dependencies, transformations, hash, reviewer and signed approval. Verify that actual deployed output contains only permitted assets. If in doubt, replace unknown art with fully original commissioned work or independently verified CC0 material. Legal counsel should assess disputed or third-party assets.

### Primary sources

- https://vroid.com/en/studio/guidelines
- https://vroid.pixiv.help/hc/en-us/articles/4405813333657-Can-I-use-the-models-created-with-VRoid-Studio-Stable-Ver-for-commercial-purposes
- https://github.com/ibrews/VitruvianGodot
- https://github.com/makehumancommunity/mpfb2/blob/master/LICENSE.md
- https://threejs.org/license/
