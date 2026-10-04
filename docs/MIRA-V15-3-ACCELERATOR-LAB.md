# Mira v15.3 — Accelerated Auxiliary Perception

## What is real in this version

Mira now contains an on-demand ONNX Runtime Web lab that can execute the official SqueezeNet 1.1 ONNX model through real browser execution providers:

- WebGPU
- WebNN NPU
- WebNN GPU
- WASM

The runtime is pinned to ONNX Runtime Web 1.30.0. The model is pinned to a specific ONNX Model Zoo commit.

This is deliberately a **Labs capability**, not an automatic production download.

Enable:

`?accelerator=1`

Run provider comparison:

`?accelerator=1&accelerator-benchmark=1`

## Why Labs first

The ONNX model is about 4.7 MB and ONNX Runtime Web adds additional runtime/WASM network cost. Loading that for every user would make the normal Mira startup worse.

Production continues to use:

- MediaPipe Holistic GPU -> CPU fallback;
- MediaPipe EfficientDet Lite0 GPU -> CPU fallback;
- worker post-processing;
- adaptive camera profiles.

The accelerator lab is downloaded only when explicitly requested.

## Real-device benchmark

Provider comparison performs:

1. session creation;
2. warm-up inference;
3. repeated 224×224 classification;
4. p50/p95 inference latency;
5. p50/p95 end-to-end latency;
6. failure accounting;
7. measured provider selection.

A provider is not selected when it produced only one lucky fast run or repeated failures.

## Product optimization included

Object-awareness no longer polls continuously at display refresh rate.

The scheduler now:

1. sleeps until the next detector cadence is due;
2. requests the next real video frame with `requestVideoFrameCallback` when supported;
3. falls back to `requestAnimationFrame`;
4. increases auxiliary detector cadence when the primary Holistic pipeline is under inference pressure.

This reduces unnecessary wakeups on 120/144 Hz displays and avoids the secondary detector competing aggressively with face/hand/pose inference.

## Privacy boundary

The ONNX lab processes the current canvas/video frame locally in the browser.

Mira sends no camera pixels to an inference API.

Network requests are only for:

- pinned ONNX Runtime Web static assets;
- pinned SqueezeNet model;
- pinned label file.

The classifier result is auxiliary telemetry only. It does not override the stable EfficientDet world model or claim object identity.

## Promotion gate

The accelerator path should leave Labs only when real-device traces show:

- at least 20% p95 end-to-end improvement over the current auxiliary path for its chosen task;
- no accuracy regression on the target benchmark;
- stable fallback after WebGPU device loss / WebNN unsupported operators;
- acceptable model/runtime download cost;
- no increase in initial production bundle budget.
