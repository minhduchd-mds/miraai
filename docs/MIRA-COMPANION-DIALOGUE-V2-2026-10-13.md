# Mira Companion Dialogue v2 — 2026-10-13

## What changed
- Rework lightweight intent classifier for Vietnamese partner/close persona
  to prioritize: explicit boundaries → correction/repair → concrete task →
  supported continuity → emotional support → celebration → affection.
- Avoid accidental triggers by substring phrases like "UI" embedded in "vui".
  A task still receives practical help even when the user says "stress".
- Introduce a correction pathway for "em chưa hiểu ý anh", "em trả lời sai",
  "nói máy móc" etc. Acknowledge specifically once, correct, no romantic filler.
- An explicit *per-turn* request to roleplay a romantic partner also works
  when the saved global persona is gentle. It never alters local preferences.
- For continuity, only user-authored history can serve as established facts;
  the model must not hallucinate shared offline experiences from assistant text.
- Dynamic guidance is imported only for partner/close/explicit invitations,
  in parallel with memory/host; any import error falls back to the ordinary
  Brain route. No model downgrade, storage mutation, or TTS model changes.

## Evidence/limits
- Deterministic tests cover intents, user agency, multi-turn continuity
  and critical boundaries. These tests validate routing, not subjective
  romantic-dialogue quality or real-provider live-output benchmarks.
- AI should respond warmly only when appropriate; never enforce exclusivity,
  discourage real people, misrepresent real marriage or infer intimate status.

- Follow-up hardening: task keyword 'lỗi' now requires technical context, so ordinary affectionate references to 'lời' cannot hijack the router. Accentless roleplay invitations are supported as a *per-turn* request.
