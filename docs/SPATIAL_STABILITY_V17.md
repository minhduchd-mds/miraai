# Mira Spatial Interaction v17 — stability and intent gates

## Implemented

- Action pinch requires a **current detected hand**, confidence and a ready focus dwell. A stale pinch event cannot activate a control after the camera loses tracking.
- Switching focus source (face gaze vs direct hand) resets the dwell clock; it cannot inherit another modality's pre-armed target.
- A running grab is cancelled if its DOM target disappears or if pinch/hand tracking has been missing for more than 180 ms. `pinch_up` remains the normal completion gesture.
- Hidden, inert, disabled or off-viewport controls are excluded from spatial focus.
- Hand rays with malformed/nonfinite landmarks/targets are rejected.
- These controls only modify the interaction intent and geometry layer; they do **not** bypass the existing permission boundary or add automatic OS actions.

## Boundaries

A webcam's gaze, z and velocity are non-metric approximations. These guards protect against *some* synthetic accidental activations; they do not establish false-activation rates or spatial tracking accuracy on real users. Validate on 1366×768 and 390×844, at least three real devices; test camera unplug, occlusion, hand switching, multi-hand pinch, slow drag and pinch cancellation. The Visual QA workflow now triggers on spatial core and Settings edits.

## Gates

Run `npm test`, `npm run check`, Playwright Visual QA, and real Device Lab before enabling a release. Camera and sensor data stay local.

## Bimanual safety gate

- Require two independent, confident, finite hands with a measurable >=0.08 viewport-width-normalized separation before scaling/rotation starts.
- Sort stable handedness to prevent frame-order swapping.
- Pause selection, grouping and two-hand window transforms when Settings is open.
- Verify both normal drag and intentional two-hand scale/rotate on real devices; synthetic tests do not validate recognition accuracy.
