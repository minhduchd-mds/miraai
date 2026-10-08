# MiraAI Spatial v31–v33 — race-safe camera/model lifecycle

## v31: Cancelled GPU/CPU model startup
- Holistic startup now serializes concurrent initialization promises, using monotonically increasing startup generations.
- Manual stop invalidates in-flight GPU and CPU load; late model assets are closed rather than attached to a newly created session.
- New start waits for canceled initialization to settle before creating another MediaPipe graph, avoiding duplicate graph startup.
- Recoverable GPU→CPU failover also checks the same generation token to reject a stale CPU graph.

## v32: Camera acquisition and UI transport session safety
- A late getUserMedia result cannot schedule inference after user stop. The existing shared camera manager's lease invalidation remains authoritative.
- Transport start and reconnection promises can only clear booting state if their generation is still current; manual stop/unmount release the in-flight flag.
- These changes preserve explicit camera permission, hidden-tab restrictions, the 3-attempt watchdog cap and 15-second healthy-stream hysteresis.

## v33: Deterministic race regression and soak
- New Node VM-based tests execute the real transpiled Holistic start/stop functions using deferred fake GPU graph and camera promises.
- Cover stop while model loads, start after cancellation, camera acquisition races and 250 synthetic start-stop cycles (close/release checks).
- Pure simulation only: no physical webcam, CPU utilization, power use, or 30-minute device stability is asserted.

## Release gates
- One direct-main batch and focused follow-up fixes when CI finds regressions; Node 24/26, TypeScript, all runtime tests, functional/camera benchmarks, architecture, bundle ≤300 KiB, Visual QA and Pages build.
- No collection or upload of camera frames, landmarks, biometric identity or device labels.