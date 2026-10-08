# Spatial Performance v20 — real-frame scheduling and hand cache

Scope: client-side webcam inference path, no new permissions or persisted camera content.
Built on v19 anti-replay/freshness without changing XR metric coordinates.

## Implementation

- **Decode-frame identity:** use requestVideoFrameCallback presentedFrames; when absent, use the video media clock. Drop duplicate/reordered frames **before** synchronous MediaPipe inference. Unknown/zero timestamps fall back to the existing cadence governor.
- **Background suspension:** no Holistic inference while document is hidden. Visibility and v19 gesture reset rules continue to disarm stale input.
- **One hand-kinematics update per inference frame:** a session-only cache ties mapped hand landmarks, pointer rays and kinematics to the actual handData.lastFrameAt. UI polling no longer recomputes hand velocity on old data.
- **Fail-closed recovery:** 350ms freshness remains enforced. When a hand frame expires, clear the cached hands and reset kinematics. A camera stop resets both caches; the next real frame rebuilds the gesture state.
- **Existing adaptive cadence:** preserve tier-aware VisionPerformanceGovernor, GPU-to-CPU fallback, worker postprocessing and WebXR separation. No automatic promotion of webcam Z into XR metric space.

## Verification and limits

Run \`node --test scripts/spatial-v20-performance.test.mjs\`, existing v18/v19 spatial regression tests, \`npm run check:architecture\`, \`tsc --noEmit\`, full \`npm test\`, \`npm run build\`, and artifact budgets in CI.

Expected result: less duplicate inference on browsers using the animation-frame fallback and less repeated hand-frame computation during UI polling. **No FPS, latency or battery percentage improvement is claimed without physical-device benchmarks.**

Still required for release acceptance: 30-minute soak, camera loss/reconnect, two-hand scaling under mixed lighting, Node 24/26 CI, 1366×768 UI, macOS/Windows camera paths, and real-device WebXR tests. This version does not change backend, voice/TTS or Production Vercel.
