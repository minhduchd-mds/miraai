# Mira Spatial Controller Calibration & Benchmark (2026-10-13)

- Open **Cài đặt → Hiệu chuẩn tay**, explicitly start camera with a button.
- Read-only guided test: left, right, pinch, open palm, left+right pinch, and idle.
- Progress requires >=240ms of fresh, consecutive camera frames; old/stale/
  duplicated frames, out-of-order inference and confidence below .75 do not pass.
- Idle detects unexpected pinch/open-palm classifications. When no hand is
  present, it counts camera-active UI observations rather than hand-inference
  frames, because the hand timestamp is naturally zero. This proves neither
  camera FPS nor OS-level click false positives. Settings disables UI gesture
  action dispatch.
- Reports show per-trial success and session success rate, explicit detection
  time from trial-button click (human reaction INCLUDED), P50/P95, and existing
  camera-inference-to-UI measured P50/P95. No sensor-to-photon claim.
- No webcam video/landmarks/audio, personal data, or device identifiers stored.
  Results remain in memory; optional user-triggered JSON download includes only
  numeric counts and stage identifiers, no upload or background recording.
- Camera/MediaPipe performance uses existing runtime graph; no heavier model or
  3D render downgrades. Benchmarking itself only mounts when tab is opened.
- Hardware qualification still requires multiple real devices, lighting
  conditions, baseline false-action observation outside settings and user
  testing. Guided pass rate is NOT statistical precision or general accuracy.
