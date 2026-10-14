# Mira Companion Brain — final handoff (2026-10-13)

## Complete in this iteration
- Preset **Thân thiết** and **Bạn đời · nhập vai** remain opt-in. Their
  dynamic guidance is only loaded for invited/selected turns; standard
  professional/technical requests are still factual and action-first.
- A real user's explicit romantic boundary persists across the available
  conversation history supplied to the companion guide until that user explicitly invites
  the role back. Mira messages cannot give consent. No persistent relationship
  status is inferred or saved from these instructions.
- Durable memory episodes / fact extraction now receive **user words only**,
  not model reply, especially critical when romance roleplay uses imagined
  scenarios. User/assistant conversation history is still handled separately
  by its existing settings and privacy controls.
- The server's fact-distillation prompt rejects roleplay, hypothetical
  relationships, assistant narrative, camera-derived emotion guesses and
  unverified real-world marriage claims as biographical evidence.
- Existing ElevenLabs partner/gentle voice guidance, memory, affect engine,
  turn context, fallback-source labeling, feedback privacy and UI are preserved.
- Regression tests cover boundary precedence, resume on explicit invitation,
  user-only fact provenance, support vs practical intent, emotional honesty
  and lazy load.

## Not validated or promised
- Automatic online self-training, factual memory quality of every LLM response,
  subjective romantic naturalness, psychometric emotion sensing, 24/7 always-on
  speech, voice latency on actual user hardware, or real-world relationships.
- No inference from camera alone is proof of emotion; consent/privacy rules
  still apply. Only live qualitative evaluation can measure conversational
  naturalness. Browser/desktop memory consent is a separate setting.

## Starting a new chat
Ask: "Tiếp tục dự án Mira AI từ commit chính của repo
minhduchd-mds/miraai. Đọc docs/MIRA-COMPANION-BRAIN-HANDOFF-2026-10-13.md
trước; kiểm tra CI và production, rồi tập trung benchmark hội thoại thân
thiết nhiều lượt với Voice/Memory thực tế. Không tự đổi persona hay thu
thập hội thoại ngoài phạm vi đã đồng ý."
