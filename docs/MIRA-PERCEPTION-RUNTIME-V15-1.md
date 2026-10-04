# Mira Perception Runtime v15.1

## Scope

This upgrade adds three foundations without pretending experimental browser ML backends are already production-ready:

1. **Perception provider planning and health circuit**
2. **Object Identity Hypothesis**
3. **Camera trace replay benchmark**

## Provider strategy

Mira Holistic remains on the current MediaPipe GPU -> CPU production fallback.

The new provider plan can expose experimental auxiliary-model candidates in this order when explicitly enabled:

- WebNN NPU
- WebGPU
- WebNN GPU
- WASM

Experimental providers are visible to diagnostics and tests but are not silently activated for Holistic.

A provider health registry adds failure counters and cooldown behavior so future ONNX/WebNN adapters can fail over without retry storms.

## Object Identity Hypothesis

World-model continuity must remain a hypothesis, not physical identity recognition.

The scorer combines:

- same-label evidence;
- center-distance continuity;
- box IoU;
- scale consistency;
- temporal recency;
- scene return/relocation events;
- candidate uniqueness;
- optional appearance similarity;
- optional segmentation-mask IoU;
- optional causal-action support.

Output is always one of:

- `accept`
- `ambiguous`
- `reject`

Far same-label matches are never accepted when multiple candidates remain ambiguous.

## Camera trace benchmark

`npm run benchmark:camera` replays a normalized camera trace contract.

The committed dataset is intentionally marked `synthetic-normalized-trace`. It is only a CI fixture and must not be reported as real-camera accuracy.

The same schema is designed to accept future browser-exported traces from recorded sessions. Real-camera benchmark claims should only begin after traces cover:

- lighting changes;
- motion blur;
- camera shake;
- hand/object occlusion;
- duplicate same-label objects;
- detector ID switching;
- partial hand visibility;
- mobile thermal throttling.

## Technology alignment

The provider abstraction follows the 2026 browser inference direction:

- WebGPU for GPU compute;
- WebNN for hardware-agnostic neural acceleration;
- GPU/NPU-resident tensor paths where supported;
- WASM as the portable fallback.

Mira should add an actual ONNX Runtime Web adapter only after a target model is chosen and measured. Adding the dependency before a validated model would increase bundle cost without improving the current Holistic path.

## Definition of done for the next step

The next perception milestone is complete only when:

1. at least one auxiliary model runs behind this provider contract;
2. real recorded traces are checked into an approved benchmark dataset or artifact;
3. Precision / Recall / F1 are reported separately per capability;
4. p50 / p95 / p99 inference and end-to-end latency are measured on a device matrix;
5. provider fallback is exercised under forced WebGPU/WebNN failure.
