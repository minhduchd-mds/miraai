# MiraAI Spatial v25–v27 — camera-frame bimanual correctness

v25 — Single-hand window movement: UI-only damped transforms (XY gain .72 and Z gain .55). Original bounds and gesture freshness remain enforced; no synthetic pinches.

v26 — Camera-frame-based two-hand sessions: window, object and group transform handlers previously matured a second 240ms dwell through repeated UI polls even when the inference frame was frozen. All now accept frameAt separate from wall-clock now, track last accepted frame and do not advance dwell or transform a duplicate. Wall-clock remains authoritative for physics and event timing.

v27 — Deterministic regression: executable tests simulate frozen frames, two-hand window/object/group dwell, duplicate-transform rejection, grab easing/clamping, release and modal/hidden guards. Synthetic tests do not establish actual webcam FPS, physical hand-tracking accuracy or energy efficiency.

Release gate: Node 24 and 26 CI, TypeScript, runtime regression, benchmarks, bundle budget (AppV2 under 300 KiB), Visual QA, and desktop release workflows. Physical camera soak and macOS/Windows occlusion testing remain separate acceptance work. All changes are committed as one main-branch update without a PR.

Bundle isolation: expensive bimanual geometry imports are now re-exported through the camera-only vision-runtime module and invoked via the loaded visionModulesRef. This reduces deferred AppV2 graph weight without changing the 300 KiB threshold or enabling camera access early.
