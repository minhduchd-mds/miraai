# Mira Action Sequence v12

## Goal

Action Sequence v12 connects short-lived visual events into a guarded temporal chain:

`hand_approach → object_occluded/lost detection → object_reappeared_elsewhere`

The output is still a **possible sequence proxy**, not proof of physical contact or intent.

## False-positive guards

### Camera motion guard

The tracker estimates common frame-to-frame motion from at least two matched scene anchors.
When multiple anchors move coherently by about 2.8% of the frame or more, sequence advancement is suspended for a short guard window.

This prevents camera shake, pan or sudden device movement from becoming fake object motion.

### Detector ID-switch guard

Target continuity does not rely on detector ID alone.
If a same-label box gets a new ID but stays close to the previous box or overlaps it strongly, v12 rebinds the target and ignores the apparent disappearance.

Ambiguous same-label candidates are not used to complete a sequence.

## Confidence decay

Sequence confidence decays with time rather than remaining latched:
- normal visual state: about 2.4 s half-life,
- camera-motion guard: about 0.9 s half-life.

Low-confidence or stale sequences are automatically dropped.

## Sequence stages

- `idle`
- `hand_approach`
- `object_occluded`
- `object_reappeared`
- `possible_reposition_sequence`

The reappearance must remain stable briefly before the final stage is emitted.

## Brain context

Only `possible_reposition_sequence` above the confidence threshold can enter Mira's transient prompt.

The prompt explicitly preserves uncertainty and never claims:
- touch,
- grasp,
- pickup,
- placement,
- ownership,
- intention.

## Privacy

All hand/object distances, target continuity state, camera-motion estimates and action-sequence state are RAM-only.
No camera frames or action sequences are written to long-term memory.
