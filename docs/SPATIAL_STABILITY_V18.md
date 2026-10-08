# Spatial Interaction v18 — temporal identity / privacy guards

Status: source and synthetic validation; **not** certified for real camera tracking.

## New in v18

1. Stable **primary hand**: keep selected hand through detector-order flips, pause for a short missing-frame window and reject a pinch carried over from a lost/replaced hand. A new pinch requires observing a release.
2. **Two-hand temporal gate**: Left/Right pair must remain consistent for 180 ms before scale/rotate can begin. Abrupt jumps, duplicated labels, low-confidence hands, long frame gaps and missing hands invalidate the pair.
3. **Background safety**: when the browser tab is hidden, disarm grabbing and bimanual sessions; do not process new gesture events while hidden.
4. **Single-activation** guarantee: a simultaneous face nod and hand pinch for the same focused action emits one activation, not two.
5. Existing v17 gates remain (confidence, modal cancellation, invalid ray rejection, lazy camera runtime). No hidden OS clicks or changes to memory ownership.

## Performance budget

Keep initial JS <=160 KiB and Deferred AppV2 <=300 KiB. If exceeded, split additional spatial modules behind camera activation; do not raise budget just for this feature.

## Real camera acceptance (not completed by CI)

- Physical camera drop and reconnect with pinch held, then release to rearm.
- Primary hand Left -> Right swap and both hands appearing in different detector orders.
- Two-hand rotate/scale at 1366×768; reproduce 20 attempts under mixed light; tally false-positive and missed gestures.
- Browser background/foreground, Settings modal while grabbing and sustained 30-minute session.
- Webcam z is relative depth, **not metric 3D**. WebXR requires separate real-device validation.

No Vercel redeploy was requested for this change; GitHub CI and Visual QA do not prove the Production site is current.
