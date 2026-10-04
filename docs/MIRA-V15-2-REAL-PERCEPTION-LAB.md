# Mira v15.2 — Real Perception Lab & Product Optimization

## Applied now

| Technology / technique | Mira v15.2 status | Production decision |
| --- | --- | --- |
| requestVideoFrameCallback | Applied | Primary camera scheduling when supported; rAF fallback remains |
| Adaptive camera profile | Applied | Resolution/FPS selected from device class before camera start |
| Long Animation Frames (LoAF) | Applied as aggregate observability | No script URLs or user content are stored |
| WebGPU capability | Detected + provider contract | No new model silently enabled |
| WebNN capability | Detected + provider contract | Experimental; no production inference claim |
| VideoFrame / WebCodecs capability | Detected | Ready for future worker video transport |
| MediaStreamTrackProcessor | Capability-gated only | Not production-required because browser availability remains uneven |
| OffscreenCanvas | Detected | Existing worker postprocess remains the stable off-main-thread path |
| WebXR depth / hand path | Existing, hardware gated | Keep separate from authored 2.5D depth |
| Normalized perception trace | Applied | RAM-only normalized signals; no camera pixels or frames |

## Why requestVideoFrameCallback first

Mira previously scheduled Holistic reads with requestAnimationFrame. On 60/120/144 Hz displays this can wake more often than the camera produces frames.

requestVideoFrameCallback follows actual video-frame presentation cadence. Mira still applies the VisionPerformanceGovernor, so a new camera frame does not automatically mean a heavy inference.

Fallback remains requestAnimationFrame for older browsers.

## Adaptive camera profile

The camera manager now selects one of:

- quality: 960×540 @ up to 30 fps;
- balanced: 640×480 @ up to 30 fps;
- battery: 480×360 @ up to 24 fps.

The goal is not maximum resolution. It is stable end-to-end interaction latency.

## Real Perception Lab trace

The trace recorder stores only:

- timestamps;
- inference duration;
- landmark count;
- face/hand presence booleans;
- gesture label/score;
- pinch boolean;
- scheduler mode;
- frame lateness;
- video dimensions.

It deliberately does **not** store camera frames, face crops, embeddings, audio or raw landmarks.

This creates the first safe path for real-device benchmark collection without turning Mira into a surveillance recorder.

## Technologies not yet honestly “applied”

### ONNX Runtime Web + WebGPU/WebNN model

Provider architecture is ready, but Mira does not yet ship an auxiliary ONNX model. Adding the runtime without a measured model would increase bundle/network cost with no product benefit.

### MediaStreamTrackProcessor worker camera pipeline

This can move frame processing into a worker and uses transferable VideoFrame objects, but support is still not uniform enough to make it mandatory. Mira should introduce it as an optional fast path after testing Chromium desktop/Android plus Safari/iOS fallback behavior.

### WebNN NPU

WebNN is now a W3C Candidate Recommendation, but browser/runtime support and operator coverage still require capability detection and model-specific validation. It remains experimental in Mira.

## Next acceptance criteria

1. Collect normalized traces on Windows Chrome/Edge, Android Chrome, macOS Chrome/Safari, iPhone/iPad Safari.
2. Compare rVFC vs rAF fallback for inference wakeups, p95 inference latency and LoAF count.
3. Select one small auxiliary model and benchmark WASM vs WebGPU vs WebNN where available.
4. Only promote an experimental provider after measured latency, memory and accuracy improve over the stable path.
