# MiraAI Spatial Performance v22–v24 — batched release

## v22: Adaptive screen-space pointer
- Camera-frame-based, confidence-gated 2D index tip smoothing. Slow jitter is suppressed; quick intentional movement receives a faster response.
- One-frame >0.24 normalized-coordinate jumps are ignored. Two consistent distant observations re-anchor. A 260 ms gap or lost hand clears the track.
- Hand pointers are independent. Depth, WebXR anchors and 3D hand-ray geometry remain unchanged; no metric Z is inferred.

## v23: Web Worker freshness
- Reject duplicate/stale worker output before cloning a landmark payload. Worker results keep the original model-completion timestamp, never the later consumption time.
- Prevent late worker results from overwriting fresher main-thread hand data. Keep 350 ms freshness and one-time warmup fallback.
- A worker that stalls for more than 1500 ms without a fresh accepted reply falls back to synchronous geometry safely; failed postMessage releases pending state.

## v24: Regression and synthetic soak
- Node tests cover jitter, real movement, teleport/outlier, both hands, timestamp reversal, lifecycle reset, source timestamp checks and 15,000 synthetic frames.
- All changes load with the camera, protecting the deferred AppV2 300 KiB budget. No stored frames, landmark datasets, biometric identity or network telemetry.

## Required checks
Node 24/26 CI, TS typecheck, runtime tests, benchmark, build and bundle checks, Visual QA. A physical 30-minute soak, macOS/Windows camera reconnect and 1366x768 bimanual tests remain separate real-device acceptance. Synthetic tests do not establish real FPS or tracking accuracy improvement. No manual Vercel deployment.
