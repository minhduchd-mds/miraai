# MiraAI Spatial v28–v30 — camera recovery, pre-paint diagnostics and synthetic soak

## v28 — Reconnection watchdog
- Detect ended video tracks while the camera is user-enabled and the tab is visible. Check every 1,200ms without polling permission prompts while off.
- Stop old Vision workers/stream before restarting. A generation token fences late asynchronous results; manual stop and component unmount disable recovery.
- Retry at most 3 times per unstable episode, with 1s/2s/4s cooldowns. A continuously live stream for 15s clears prior failures; exhausting attempts leaves the camera off for a manual retry.
- Existing camera-manager multi-consumer cleanup and permission boundaries are retained.

## v29 — Inference to pre-paint latency
- Add inferenceToPrepaint p50/p95/max to in-memory v21 diagnostics: bounded 128 numeric samples, one callback per fresh model-completion timestamp.
- Browser requestAnimationFrame fires before a paint opportunity, not after actual display. These values are **not** sensor-to-photon latency, DOM commit latency, perceived input lag, or FPS measurements.
- Ignore invalid, future, hidden-tab or >350ms stale timestamps. Cancel pending callback on component cleanup.

## v30 — Deterministic regression/soak
- Node tests exercise retry caps and cooldowns, 15s health hysteresis, stop/hidden guard wiring, numeric latency windows and 54,000 synthetic timestamps (30 minutes × 30 FPS equivalent).
- The virtual soak does not occupy 30 minutes or use a real camera. A real-device 30-minute soak, dropout/reconnect exercise, and energy/CPU profiling remain pending.
- No image frames, raw landmarks, biometric identity, device labels or network traces stored by diagnostics.

## Release gates
Single main commit without PR. Require CI Node 24/26, TypeScript, runtime regression, functional/camera benchmarks, architecture/security checks, bundle budget AppV2 <=300 KiB, GitHub Pages build and Visual QA.