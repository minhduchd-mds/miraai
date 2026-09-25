# Mira Social Awareness v4

## Purpose

This layer adds **joint-attention and interaction-state proxies** on top of Mira's face, gaze, posture, gesture and Real Presence signals.

It deliberately avoids claiming that Mira can know attention, intention, comprehension or emotion with certainty.

## Signals

The interaction tracker combines:
- face presence continuity
- gaze proxy from face blendshapes
- head yaw/pitch alignment
- conversational camera distance
- posture motion stability

Output states:
- `focused`
- `engaged`
- `looking_away`
- `returning`
- `absent`
- `uncertain`

The labels describe observable interaction geometry only.

## Behavior timeline

A rolling 90-second in-memory timeline records transitions for:
- attention state
- micro-expression events
- posture state
- hand gestures
- proximity class

The timeline is **ephemeral**. It is not written into IndexedDB or identity memory.

## Conversation policy

- When the user is absent, proactive speech is suppressed.
- When gaze/head geometry indicates looking away, proactive speech is suppressed and prompt context asks the brain to stay concise.
- Returning state is treated gently; Mira may resume without over-emphasizing the return.
- Focused/engaged states allow normal detail.

## Why this direction

Current social-signal systems combine gaze, posture, gesture, voice and physiological/visual information rather than treating a single facial label as ground truth. The implementation keeps non-verbal channels auxiliary and confidence-gated so noisy camera signals cannot dominate language.
