# Mira security and reliability upgrade (2026-10-08)

## Implemented
- Atomic memory wipe covers chat_messages, user_facts and identity_capsules.
- Origin/Fetch Metadata guards prevent known cross-origin browser writes. These are **not** user authentication.
- Cancelled HTTP TTS turns cannot overtake current playback.
- Billable Brain, TTS, fact extraction and snapshot generation use bounded per-client and global quotas.
- When DATABASE_URL exists, shared quota is persisted by atomic Neon UPSERT; database failures fail closed. With no DATABASE_URL, bounded process-local fallback is weaker (not safe as a production distributed limiter).
- Set MIRA_AI_QUOTA_MODE=require-neon to reject billable requests unless shared storage exists.
- Set MIRA_QUOTA_HMAC_KEY to a long random server-only key so quota telemetry uses HMAC rather than a predictable client-IP hash. Rotate with care.
- Quota-window records require scheduled TTL pruning after a measured retention period (e.g., 7 days).

## Not released as complete
- Legacy user memory-scope is **not proof of ownership**; migrate only with a signed user/session mechanism and verified owner claim, never silently reassign records.
- ElevenLabs v4 HTTP whole-blob playback remains the stable default. WebSocket streaming requires server-authenticated proxy, incremental decoder and actual audio metrics before production enablement.
- Tauri CSP, signed installers, native integration/device tests and release gates need platform-specific validation.
