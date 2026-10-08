# Spatial Performance v21 — frame-confirmed bimanual input and performance evidence

- The 180ms two-hand intent gate now uses the **actual hand inference timestamp**. Re-reading cached hands does not count as new evidence, but an authorized pair can remain active while its source frame is still fresh (up to 350ms).
- \`visionSnapshot().spatialPerformance\` includes bounded numeric diagnostics: inference-completion to first hand UI poll, inference-completion to hand action dispatch, UI callback duration, P50/P95/max, repeated poll and unique hand frame counts.
- Optional \`jsHeapMiB\` is an approximate Chromium-only JS heap estimate and is null if unsupported. No camera frames, landmarks, identity or target IDs are retained or transmitted. Stopping camera and hiding tab clear the profiler.
- All three timing metrics use at most 128 samples each. These are **not glass-to-glass latencies**: sensor acquisition, GPU presentation, OS input and monitor refresh are not measured. No absolute FPS improvement has been validated on physical devices.
- CI checks include v17–v20 regression, new synthetic v21 temporal cases, node type-check, build and bundle ceilings. Physical 30-minute soak, occlusion, lighting, CPU/GPU performance and WebXR remain separate release acceptance work. No manual Vercel deploy.
