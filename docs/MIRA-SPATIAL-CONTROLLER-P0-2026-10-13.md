# Mira Spatial Control P0: monotonic hand input and gesture anti-replay

## Shipped invariants
- Hand inference-frame cache holds a timestamp high-water mark; a reversed
  worker result clears hand presentation once and cannot build landmarks or
  re-arm pointer events until a genuinely newer camera frame arrives.
- useVisionHandInput only advances gesture timing for recent, strictly increasing
  hand-frame timestamps. A dropout/rollback disarms tracked gesture candidates,
  while a duplicate UI poll never creates a fresh inferred gesture.
- SpatialUIController accepts pinch_down and pinch_up only when the intent ID is
  a newer positive safe integer and its provenance timestamp is from the last
  350 ms. Replays and future timestamps fail closed. Cancel on loss persists.
- No change to models, shader quality, hold thresholds or camera permission
  behavior. No audio, landmarks or facial data is uploaded.

## Verification scope and limitations
- Automated synthetic tests cover reordered frames, cached polls, pinch replay,
  stale/future timestamps, release replay and recovery. They prove logic
  invariants, NOT measured precision/recall, frame latency or camera hardware.
- Must still validate real webcams with lighting changes, people entering/exiting,
  two simultaneous hands, and speech while moving, before claiming high accuracy.
