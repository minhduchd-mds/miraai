# Mira 3D visual quality — 2026-10-12

## Evidence
Visual QA artifact `mira-visual-qa-ee91a398...` contained a Vitruvian human LAB five-view render with unnaturally opaque/white eyelids, dithered scalp hair and externally extended hands. These visual defects are not caught by WebGL render-success tests; the "photoreal human" production Playwright scenario was skipped because the approved model manifest is still pending.

## Production behavior
- Automatic desktop room3d is disabled until `chooseRoomAvatar()` validates an explicitly approved and licensed human manifest. This avoids an empty 3D room and ensures the standard cinematic companion is visible.
- Explicit `?room3d=1` remains available for experimental 3D inspection. `?humanLab=1&room3d=1` remains an experimental CC0 LAB only; these are not proofs of production likeness.
- Existing original photo/voice/vision paths are left intact and a Playwright test checks pending-manifest fallback.

## Experimental Vitruvian refinements
- Local warm fill for face readability and reduced eyelid overlay severity; retained the dequantized, measured iris/sclera clearance.
- Rebalanced off-white sclera and natural roughness.
- Removed software rasterizer alpha-to-coverage stippling from hair, warmed/darkened strands.
- Relaxed seated forearms toward thighs rather than stretching wrists off the chair.

## Acceptance remaining
Manual specialist review of actual 3D model quality across five views, healthy eyes, skin normals, eyelid contact, hair opacity and hairline, physical body proportions, chair and arm intersection, and lower-end GPU framerate. Visual QA success is only technical evidence, not photorealistic approval. An appropriately authored/licensed asset or Blender corrective edit may still be necessary; no automatic flag will turn the LAB into production.

## 12 Oct follow-up — experimental eye-visibility repair
The five-view 3D screenshot still showed featureless bright white eyes at the original calibrated iris offset, implying the full opaque sclera primitive masks the iris in rendered space. In the Lab-only renderer, preserve the original eye geometry but disable the front sclera material; use the source rear eye disc as a warm eye-white underlay and reduce the iris diffuse multiplier so a real pupil/iris can be seen. This is an **unreviewed hypothesis** pending fresh visual QA. Denser hair cutout uses a lower alpha test threshold (0.07), still without software-unfriendly alpha-to-coverage. Production manifest stays pending.

## Follow-up — physical scalp underlay and face-close QA
A new crown-only, low-poly hemispherical underlay is parented to the original source head in the experimental Lab. It covers hair-card perforation without recoloring or flattening the source hair. A reversible `?scalp=original` switch allows source-vs-underlay comparison. The sixth keyboard camera preset (`6`) adds a close frontal head inspection to Visual QA; the default view and the five established room presets remain unchanged. None of this approves the candidate for production.

## Close-up evidence: rejected floating scalp dome
The first experimental underlay used vertical scale 0.11 m and visibly floated above the scalp in the 6th camera view despite WebGL tests passing. Reduced its vertical radius to 0.038 m and lowered the centre; repeat five-view and close-up QA before any visual approval. Source hair, eyes and room are otherwise unchanged.

## QA final disposition — scalp candidate rejected
The second close-up screenshot still showed a **floating flattened plate** above the hairline. This violates the geometry review even though the render pipeline passed. The entire ad-hoc scalp underlay has been removed from the experimental renderer and its geometry-only test deleted. Keep the actual corrected iris layering, warmer eye material and 6th close-up QA view. A proper hair mesh/UV/opacity rebake is a prerequisite for production-level photorealistic likeness; the lab is still explicitly unapproved.
