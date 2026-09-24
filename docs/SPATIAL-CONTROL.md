# Mira Spatial Control

Spatial Control builds on Mira's shared Vision Runtime and MediaPipe hand landmarks.

## Interaction model

- One hand:
  - index finger = Air Cursor;
  - pinch = select / grab;
  - open palm swipe = theme;
  - open palm hold = interrupt;
  - victory = live voice.
- Result Surface:
  - pinch on panel = grab;
  - keep pinching + move hand = move;
  - release = drop;
  - double pinch = reset position, scale and rotation.
- Two hands:
  - show two open palms for ~260 ms to enter Spatial Transform;
  - move hands apart/together = depth-like scale;
  - rotate the axis between hands = panel rotation;
  - leaving two-hand mode preserves the transform.

## Stability and performance

- GestureRecognizer supports two hands but inference is throttled to about 24 fps on mobile and 33 fps on desktop.
- Air Cursor uses exponential smoothing.
- Scale and rotation use separate smoothing and hard limits.
- Result Surface is clamped by interaction logic and cannot be transformed through Settings.
- Existing safe-action whitelist remains active.

## Limits

This is 2D camera-derived spatial interaction, not real metric depth. Scale is inferred from hand separation. A future depth camera / WebXR adapter can replace this input without changing the upper interaction model.
