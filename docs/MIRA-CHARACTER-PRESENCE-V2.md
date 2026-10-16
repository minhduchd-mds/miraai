# Mira 3D — Gaze and viseme smoothing v2 (16 Oct 2026)

## Implemented

- Replaces permanently camera-locked VRM lookAt with a camera-relative, gently blended eye-target director.
- Talking/listening keep eye contact with tiny fixation drift; thinking allows a brief lateral gaze. No gaze motion is sent to a server, and the renderer never activates the camera or microphone.
- Adds a deterministic viseme envelope across existing output-audio spectral mouth shapes: smooth onset, small release lag, faster return to closed on silence.
- Works with both approved VRM and rigged GLB viseme paths. Gaze is VRM-only until a licensed GLB with an audited eye control mapping is available; the module does not invent skeleton conventions.
- Preserves the previous Character Director body/head animation, authored pose, provenance checks, release gates and device-adaptive render DPR.
- Reset expression/gaze state whenever the selected rig changes.

## Rights and technical boundaries

All algorithms and source code in this update were independently written for Mira. No external 3D asset, character likeness, Weelife program code, reverse-engineered animations or shaders have been imported.
The production human avatar manifest remains pending. Running CI demonstrates structural correctness, not actual 3D visual fidelity or Vietnamese phoneme-perfect lip-sync.

## Validation

- `node --test scripts/character-presence-v2.test.mjs`
- `npm run check`
- Inspect VRM gaze under camera rotate/zoom and 5 views; verify eyes look toward the viewer and do not jitter.
- Test TTS quiet/loud/silence and 20fps demand-render output; verify mouth closes during playback pauses.
- Benchmark CPU/GPU frame time on desktop/mobile before changing render cadence.
