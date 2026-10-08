# Spatial v19 — camera frame freshness and event safety

Changes are batched as one feature commit. No Vercel redeploy.

- Legacy and holistic hand paths publish a monotonic inference timestamp.
- Hand presence, gestures, rays and pinch are invalid after 350 ms without completed inference. Polling does not refresh the timestamp.
- The React hand input suppresses repeated temporal gesture inference on the same camera frame.
- Pinch-down event identity is consumed once; repeated snapshots cannot synthesize a second click.
- A grab ends via pinch-up only while a hand is tracked; missing tracking follows cancellation.
- Hiding the browser clears hand gesture history, and global stale fallback rays are ignored.

This is not an empirical tracking accuracy claim. Real camera failure injection, three-device testing and long-running soak remain required. Preserve the 160 KiB initial and 300 KiB deferred JS limits.
