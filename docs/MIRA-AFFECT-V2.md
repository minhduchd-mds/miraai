# Mira Affect Engine v2

## Goal

Mira no longer treats one camera frame as a factual emotion label. Affect Engine v2 maintains a temporal, privacy-preserving set of **observed behavioral signals** and uses friendly labels only as conservative interaction hints.

This is not a medical, psychological or identity system.

## Face channel

MediaPipe Face Landmarker already supplies 478 landmarks, head transformation and ARKit-style facial blendshapes.

`src/core/face/facs-proxy.ts` maps selected blendshapes into FACS-like proxies:
AU01, AU02, AU04, AU05, AU06, AU07, AU09, AU10, AU12, AU14, AU15, AU17, AU20, AU23, AU25, AU26 and AU45.

These are deliberately named **proxies** because MediaPipe blendshapes are not a validated FACS/OpenFace measurement pipeline.

## Voice channel

While Mira is listening, the existing local microphone analyser also derives:
- normalized energy
- voice activity
- silence ratio
- approximate fundamental frequency
- pitch variability
- confidence

Raw microphone audio is not persisted by this layer.

## Continuous affect vector

The primary representation is:
- `valence`: -1..1
- `arousal`: 0..1
- `engagement`: 0..1
- `fatigue`: 0..1
- `tension`: 0..1

Camera and acoustic cues are fused conservatively. Voice primarily influences arousal/engagement; face remains dominant for expression labels.

## Personal baseline

`AffectTracker` learns a lightweight local baseline from low-intensity frames. After enough samples, facial activations are interpreted relative to the user's own typical resting behavior rather than fixed thresholds alone.

Only aggregate feature means are stored in localStorage under `mira.affect.baseline.v2`. No raw frame, face embedding or identity template is stored.

## Temporal behavior

A label must remain stable before Mira adopts it:
- tired signals require the longest persistence
- sad/tension-like expressions require a longer confirmation window
- happy/surprised transitions are faster
- continuous dimensions are smoothed every update

## UI

The Vision panel exposes:
- VAL / ARO / ENG / FAT / TEN
- AU12 and AU04 proxy activity
- facial gesture
- face mesh
- Real Presence distance

## Memory

Long-term local memory can keep the vector with timestamps. Recall language explicitly describes it as an observed signal and not as a fact about the person's feelings or health.

## Next experiment

Camera rPPG can be added later behind explicit opt-in as a **low-weight signal-quality/BPM trend experiment**. It should never be used for diagnosis because motion, illumination, skin visibility and camera processing can materially distort the estimate.
