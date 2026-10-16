# Working agreement for coding agents — Mira AI

## Avatar/3D changes (mandatory)
The user's non-negotiable workflow is **real TEST → screenshots → UX review → BA defect/acceptance analysis → DEV fix → same-scene TEST AGAIN → BA sign-off/repeat** until *production criteria actually pass*. This instruction applies to every subsequent Mira 3D update, including work resumed in another conversation or agent session.

Before changing 3D code, read:
- `docs/MIRA-3D-PRODUCTION-ACCEPTANCE-LOOP.md` (authoritative acceptance checklist and report format)
- `docs/MIRA-ORIGINAL-HUMAN-PIPELINE.md` (original source/rig/rights pipeline)
- `docs/MIRA-IP-RIGHTS-AUDIT-2026-10-16.md` and `ASSET-LICENSING.md` (asset copyright risks)
- GitHub [issue #17](https://github.com/minhduchd-mds/miraai/issues/17) and the most recent **actual screenshot artifact**.

Rules:
1. Inspect six WebGL screenshots **before** deciding what to change, and again **after** changing it. If screenshots do not exist for the candidate commit, **say visual QA is incomplete**.
2. Make each P0/P1 defect measurable in a BA record. Do not call it done unless before/after images and actual tests substantiate improvement; continue unresolved work in the next iteration. No fictional human BA approval.
3. Keep original procedural Lab distinct from photoreal production. The current sphere-based prototype cannot become human-quality purely by passing CI. Prefer independently owned Blender GLB/VRM with continuous anatomy, PBR maps, proper skeleton and contact-aware pose when needed.
4. Never bypass `check:avatar-release`, asset-rights inventory or visual approval, and never copy proprietary Weelife animation/assets or other external character likenesses.
5. Preserve existing production voice, Memory, camera consent, privacy and fallbacks; run the relevant Node 24/26 CI, real Chromium/WebGL and release artifact checks. Do not invent GPU FPS measurements or successful test statuses.
6. Record the exact baseline SHA, Test 1 artifact, BA criteria, fix SHA, Test 2 artifact, CI status, remaining blockers and production/no-go disposition in the issue and final report.
7. Keep the issue open and `manifest.status=pending` until all documented P0/P1, rights, performance and human acceptance conditions are satisfied.

Do not interpret "keep improving until production" as permission to forge approvals, silently change dependencies/persona, or exceed the model's available execution capabilities. Always be precise about blockers.
