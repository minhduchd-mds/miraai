# Mira Benchmark & Validation Layer v15

## Why this exists

Mira already has broad deterministic unit coverage across voice, affect, gesture, spatial interaction, WebXR, world-model logic and runtime policy. The missing layer was a benchmark contract that reports measurable behavior instead of only pass/fail examples.

This layer intentionally separates two concerns:

1. **Correctness gates** — deterministic synthetic scenarios that are stable enough to block CI.
2. **Performance telemetry** — p50/p95/p99 and ops/sec measurements that are reported for regression analysis but are not hard-gated across heterogeneous GitHub runners.

The benchmark must never present synthetic contract scores as real-camera accuracy.

## Functional gates

### Gesture / intent

- Stable hold recall for Victory, Open Palm, Closed Fist, Pointing and Thumb Up.
- Alternating high-confidence gesture noise must not fire a hold action.
- Persistent low-confidence detections must not fire a hold action.
- Pinch down/up must emit exactly one edge each.

Synthetic contract target: Precision 1.00, Recall 1.00, F1 1.00.

### World model v14

- Short detector loss preserves object permanence.
- Confidence decays while an object is missing.
- Unresolved memories expire.
- A single unambiguous same-label relocation can rebind detector identity.
- Ambiguous multi-object far rebind is suppressed.

### Action Sequence v12

- hand approach -> object missing -> stable reappearance elsewhere produces only a *possible* reposition sequence.
- Coherent camera motion blocks sequence advancement.
- Detector ID switch near the previous location does not fabricate an occlusion.

### Vision performance governor

- Heavy inference increases frame interval.
- Recovery is gradual and never overshoots the quality-tier floor.
- Hidden-tab cadence remains throttled.
- Telemetry remains finite.

### Spatial physics

- Fast release can enter inertia mode.
- Damping settles the object.
- Scene bounds are preserved.
- Boundary collisions remain contained.

### Conversation timing

- Slow previous turns get an earlier backchannel.
- An interrupted user gets more floor time.
- Emotionally sensitive turns avoid synthetic filler.
- Questions reopen the mic faster than long statements.
- Barge-in recovery stays bounded.

## 2026 technology alignment

### WebGPU + WebNN

WebGPU is the practical browser GPU compute path today. WebNN has matured to Candidate Recommendation and adds a hardware-agnostic neural-network abstraction with CPU/GPU/NPU device selection. Mira should keep its current MediaPipe path while introducing an execution-provider abstraction:

\`MediaPipe Tasks -> ORT Web/WebGPU -> WebNN when available -> WASM fallback\`.

Do not remove the current fallback path until browser coverage and operator coverage are measured on the target device matrix.

### WebNN/WebGPU interop

The standards work in September 2026 added WebNN/WebGPU interoperability work, including device-sharing/zero-copy direction. Mira should design tensor ownership so camera preprocessing, inference and postprocessing can stay on-device and minimize CPU/GPU copies when supported.

### Streaming video memory

Modern video segmentation systems such as SAM 2 and SAM 3 use temporal memory to follow objects through video and occlusion. Mira's short-term world model is conceptually aligned, but its current evidence is still 2D detector geometry. The next perception upgrade should add an optional segmentation/tracking validation lane rather than pretending detector IDs are physical identity.

### Egocentric interaction benchmarks

Ego4D/Ego-Exo4D 2026 evaluates short-term object-interaction anticipation, temporal action localization and 3D body/hand pose. These are better external references for Mira than generic image classification accuracy. Mira should eventually maintain a small licensed validation subset and report contact/action anticipation separately from UI gesture recognition.

### WebXR

Native WebXR hand input plus hit-test/depth-aware interaction should remain the metric spatial path where hardware exposes those capabilities. Authored 2.5D depth effects should stay explicitly separated from metric XR geometry.

### Realtime voice

Realtime voice systems are converging on WebRTC, low jitter, fast first audio, VAD-aware interruption and output truncation. Mira already has turn timing and interruption logic; the next benchmark phase should measure microphone-to-first-audio latency, interruption stop latency and recovery time on real network/device profiles.

## Next engineering phase

1. Keep this benchmark mandatory in CI.
2. Add a browser/device lab runner with recorded camera clips.
3. Build a labelled Mira validation corpus:
   - positive and negative gesture sequences;
   - hand/object approach without contact;
   - actual move vs detector flicker;
   - coherent camera shake;
   - temporary occlusion;
   - duplicate same-label objects;
   - low light and motion blur.
4. Report Precision / Recall / F1 by capability, not one global score.
5. Add latency histograms for:
   - camera -> landmarks;
   - landmarks -> intent;
   - VAD -> STT final;
   - STT final -> first model token/audio;
   - interruption -> audio stop.
6. Only then tune thresholds or replace models.

## CI rule

\`npm run benchmark:functional\` is a hard correctness gate.

Performance numbers are diagnostic. CI must not fail just because a shared runner is slower than a previous machine.
