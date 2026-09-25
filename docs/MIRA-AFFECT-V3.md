# Mira Affect Engine v3 — body + micro-expression + experimental rPPG

This layer extends the existing Face/Voice Affect Engine with three local-only signals.

## Micro-expression timeline

`MicroExpressionTracker` watches short excursions in FACS-like AU proxies and emits only brief events:
- smile flash
- brow flash
- lip press flash
- surprise flash
- tension flash
- blink burst

These are temporal movement labels, not claims about hidden emotion or intent.

## Body posture

MediaPipe Pose Landmarker runs at a lower frame rate on the shared camera stream. Mira derives:
- upright score
- 2D lean
- shoulder slope
- visual slouch geometry
- gross body motion

"Slouched" is only a geometry label and is not a health assessment.

## Experimental rPPG

The camera samples forehead and both cheek regions from the existing face box. A CHROM-style color signal is analyzed in a 45–180 BPM search band.

The output contains:
- pulse trend
- signal quality
- relative activation versus a session-local baseline

No raw camera frame or pulse trace is persisted. The pulse trend is experimental, affected by motion and lighting, and must not be used for diagnosis or medical decisions.

## Fusion policy

- Face remains the dominant source for friendly expression labels.
- Voice contributes to arousal/engagement.
- Posture contributes lightly to engagement/fatigue.
- High-quality rPPG contributes only a small amount to arousal via relative change from the session baseline.
- A micro-expression can nudge a dimension but cannot independently determine a mood label.

## Privacy

All processing is in-browser. Long-term memory keeps only the existing aggregate affect vector. Physiological estimates are intentionally ephemeral and are not written to IndexedDB.
