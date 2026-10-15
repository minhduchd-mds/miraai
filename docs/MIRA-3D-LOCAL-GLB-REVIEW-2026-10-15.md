# Mira 3D local-file review upgrade — 15 October 2026

This revision fixes a preview blocker: the lab's two optional GLB files may not have
been published alongside the deployed app. Researchers can now open the native 3D
room with `?humanLab=1&candidate3d=sample` (or `white`), then **drag-and-drop
a local GLB onto the 3D canvas**. While the canvas has focus, press **U** to choose
a local GLB file with the file picker.

The browser makes an object URL for the selected file after checking the GLB
header, glTF 2.0 JSON, embedded-only resources, maximum 16 MB file, and reasonable
mesh complexity. No upload and no remote GLB URL is accepted. Object URLs are
revoked when the file changes or the component unmounts.

The lab automatically scales an imported figure to standing height and places
the feet on the room's floor; pointer drag and the existing six viewpoint presets
remain available. No new renderer is created, and all normal Mira settings,
consent boundaries, voice and memory behavior are unchanged.

**Important**: the two user-supplied scans have no skeleton or facial blend
shapes. This is an honest static visual comparison, NOT 3D conversational
animation. Human identity is not inferred from the scanned model. Manual image
review, licensing, facial rigging and WebGL device QA are required before
Production activation. The production manifest is unchanged.

Regression test: `scripts/candidate-local-glb.test.mjs`.
