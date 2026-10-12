# Mira Female Presence · Production v1

## Scope
Production-grade, **photograph-based** female presence for the existing Mira AI. Keeps the consistent Asian-looking female photography already in the scene asset pipeline, with a restrained portrait breathing/gaze treatment tied only to existing UI/audio state. No new camera permissions, third-party endpoint, impersonation, face-swap or 3D realism claim.

## UX
A dedicated, accessible header button toggles **Chân dung** (default) and **Toàn cảnh**. The setting is stored locally under `mira.female.presentation.v1`; `?appearance=portrait|scene` overrides at load. Both modes retain the current Voice, Vision, XR, subtitles and automatic daypart scenes. Voice state only changes small CSS motions; the rendered still is NOT viseme lip sync.

## 3D boundary
The 3D GLB/VRM human remains gated by the pre-existing licensed/manual visual approval manifest, unchanged. Vitruvian Human Lab is a research asset and must not be advertised as approved. To obtain the reference design from the concept board as a real production 3D female Mira requires creating a matching licensed character mesh, hair cards, skinned body, seated pose and expression morph targets. A generated static board cannot be converted into a faithful, animatable 3D humanoid by front-end code alone.

## Verification
Playwright tests: presence default, authored scene asset loaded, mode toggles without camera, voice controls intact; all existing unit/visual checks apply. Respect reduced-motion and Lite devices, avoid heavy WebGL where not needed.
