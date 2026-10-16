# Mira AI — Persistent 3D production acceptance loop

**Owner requirement (2026-10-17):** Continue iteration until the original Mira avatar has evidence of production readiness. Do not close quality issues after code-only fixes. Every future improvement must follow the same *real-screen* feedback cycle.

## Mandatory cycle — repeat, never skip

1. **TEST 1 / capture baseline:** At the exact main commit under test, run Chromium/WebGL and capture the six genuine 3D camera views (front, left 45°, profile, right 45°, rear and face close), resolution 1366×768. Also capture speaking/listening/idle expressions, hand–chair contact and mobile/device views as needed. Publish an identifiable GitHub Actions artifact and run URL.
2. **REVIEW / UX expert:** Inspect the screenshots, not only test exit codes; flag hair occlusion, eye/pupil coherence, skin and hair materials, anatomy, posture, collisions, facial expression, six-view continuity and usability. Record before/after evidence and distinguish factual observation from judgment.
3. **BA ANALYSIS:** Convert every finding into P0/P1/P2 GitHub issue criteria, including reproduction, expected result, objective acceptance test, priority and who has approval authority. Current tracking issue: [#17](https://github.com/minhduchd-mds/miraai/issues/17). An automated AI review is **not** a human BA sign-off.
4. **DEV:** Correct causes in the owned source and rig, not just hide symptoms, without copying third-party models or violating existing rights. Preserve voice, memory, privacy, production defaults and stable deployment. Push changes to `main` after review of diff and test commands.
5. **TEST 2 / real re-capture:** On the **new commit**, repeat **the same camera views, environment and target viewport** and test additional affected views. Compare screenshots to the baseline. Run TypeScript, Node.js CI 24/26, asset-rights gates, artifact checks and, where available, browser/device benchmarks. Link to exact commits, QA artifacts and logs.
6. **BA RE-REVIEW:** Record `resolved / improved-but-open / new regression / unresolved` for each defect, with references to the second screenshots. Update the issue. If any P0/P1 acceptance criterion fails, return to step 3; do not mark the avatar production-ready.

## Blockers to production (current)

| Severity | Criterion | Current status |
| --- | --- | --- |
| P0 | Original high-fidelity human mesh with plausible anatomy, continuous face, limbs, fingers, feet and seated pose | FAIL — current prototype is separate primitive volumes |
| P0 | Hair exposes eye, nose, mouth and preserves plausible silhouette from 6 cameras | *Lab* P0 central-face occlusion improved/passed in Test 2; full high-fidelity hair not approved |
| P0 | Real arm rig, elbow/wrist/finger continuity and demonstrable hand–chair contact without interpenetration | FAIL |
| P0 | Six genuinely rendered images at same viewport and independent visual review of face/profile/rear | Lab screenshots captured; aesthetic approval missing |
| P0 | Asset copyright, author/creator permission, exact binary SHA256, source/license/likeness review | FAIL for replacement realistic asset; existing rights gate remains pending |
| P1 | Skinned humanoid, facial rig, blink + gaze + TTS lipsync without detached facial geometry | Partial prototype only |
| P1 | PBR skin/hair/eyes, consistent lighting and quality under camera rotation | FAIL photoreal target |
| P1 | CI, WebGL render smoke, six-view regression, audio/brain/memory/privacy, device GPU/frame-time and resource use | Code CI passed previously; full device benchmarks and visual acceptance incomplete |

**Critical distinction:** passing automated CI, bundling, static test regexes, or Playwright screenshots means a test executed; it does **not** imply that the character looks realistic or production-ready. A screenshot inspection must be performed and documented separately.

## Production approval rule

Only mark the *original avatar* ready when:
- all P0 and P1 items have actual reproducible passing evidence on the release candidate commit, including visual human assessment;
- model/animation/texture rights are verified and independently signed off, with safe distribution conditions;
- `public/avatars/realistic/manifest.json` passes the technical/rights/visual approval gates as designed, without bypassing them;
- voice, memory and device performance regressions are addressed and signed off;
- a release note names the commit, CI runs, screenshot artifact links, remaining P2 issues and explicit human owner approval.

**No artificial deadline, no auto-approval, no false success report.** If a truly photoreal result cannot be achieved by iterative primitive meshes, stop polishing primitives and move to an independently authored original sculpt/rig in Blender, then stage GLB/VRM with evidence. Never claim capabilities not witnessed by QA.

## Minimum reporting format for every subsequent Mira 3D update

`Baseline commit → baseline screenshots → UX/BA findings → fixes and commit → second screenshots → tests and regressions → pass/fail per finding → open issues → next iteration`.

Use the GitHub issue as handoff and permanent decision trail. Continue this loop until approval or a specific resource/legal/technical blocker is transparently reported.
