# Mira Feedback v1 (13 October 2026)

- Opt-in feedback via Settings -> Góp ý Mira. Users submit a rating/reason; optional
  note is manually written. **No chat is shared by default.** Sharing only the
  latest question-answer pair requires a separate unchecked consent control and
  shows the excerpt preview.
- Explicit POST only on button press, no auto uploading conversation, mic/camera,
  face expression or personal memory to product analytics, no model retraining.
- A separate Neon feedback table with lazy schema, signed anonymous browser
  session scope, CSRF origin guard, private no-store headers, 20 entries per signed
  scope per 24h, strict 400-character note/1200-character transcript excerpt caps.
- GET returns only own feedback metadata; DELETE removes a specific row or all.
  Memory/profile export includes feedback and full memory wipe includes feedback.
- Expires after 90 days for access and storage (physical purge on feedback requests,
  not guaranteed to happen precisely at expiry without a scheduled retention task).
- No admin review interface or model training pipeline in v1. Product quality
  improvements require an explicit, audited review stage later.
