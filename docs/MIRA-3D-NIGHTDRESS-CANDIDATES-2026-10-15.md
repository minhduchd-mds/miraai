# Mira AI — 3D nightdress scan research gate (15 October 2026)

Two user-uploaded GLBs were measured, reviewed and staged **locally** for a 3D lab, without relaxing the photoreal/rig/facial QA gates.

| Source | Triangles | Vertices | Material | Rig or facial animation |
| --- | ---: | ---: | --- | --- |
| white_mesh.glb | 129,650 | 64,825 | none | none |
| sample.glb | 5,628 | 4,069 | one baked atlas | none |

The lab asset names are `public/avatars/realistic/candidates/nightdress-sample.glb` (optimized 253,608-byte textured file) and `nightdress-white-mesh.glb` (untextured reference). **These GLBs are not committed here**: the source and redistribution rights are not yet verified, and the GitHub connector cannot import chat-uploaded binary files. An integration kit with both assets and local checks was prepared separately.

## Behavior and instructions
- The normal Mira room still loads `RoomMiraVRM` and uses its existing approval, runtime validator, fallback and voice code.
- `?humanLab=1&candidate3d=sample` or `?humanLab=1&candidate3d=white` displays the specified *static* local GLB inside the native 3D room, **only after the model file is placed under the whitelisted path**.
- When either asset is missing or corrupt, mark avatar status `rejected`; continue to render the room. No external asset URL is accepted from query params.
- No rig, blink blend shapes, eye steering or visemes exist in these uploads. They cannot stand in for an approved interactive 3D companion.
- To promote one to Production: verify rights, improve model appearance, construct an actual humanoid rig and facial expressions, produce multi-material PBR textures, validate multiple camera views and complete human QA. Do not replace the primary manifest with an unapproved candidate.

Regression coverage: `scripts/candidate-source.test.mjs` checks query gating and unchanged photoreal avatar validator. The binary integrity test ships with the local candidate asset kit.
