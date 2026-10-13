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

## Camera-interruption hardening
- A frame inferred before pressing **Bắt đầu kiểm tra** cannot earn a pass.
- Backgrounding the page, switching the camera off, losing the underlying live
  video track, or losing the inference snapshot cancels the pending trial
  without adding it to the success/failure denominator.
- Video preview follows a recovered **existing authorized** MediaStream;
  it neither reopens camera permissions nor records frames.
- No change to the 240ms gesture hold, 75% confidence threshold, 3D render,
  or quality of AI inference. All hardware accuracy claims remain unverified.

## Evidence-based idle evaluation
- No-action calibration samples genuine empty-hand inference timestamps from the
  holistic hand tracker, never timestamps invented by the React polling interval.
- A neutral pass requires six distinct frames and coverage near both the start
  and end of the four-second trial; repeated UI polls or frozen workers fail.
- Without sufficient evidence, the trial is marked inconclusive and excluded
  from the success-rate denominator. This is not proof of active click precision.
