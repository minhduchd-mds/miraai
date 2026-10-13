# Mira Companion Dialogue — opt-in close/partner profiles

## Gap fixed
Previously, Mira only had four generic tones. There was no role-specific
prompting or context-sensitive distinction between comfort, affection,
celebration, work and a user's explicit request to stop intimate language.

## Implementation
- Adds two opt-in profiles in Voice & Conversation settings:
  - **Thân thiết** (close): caring, not automatically romantic.
  - **Bạn đời · nhập vai** (partner): consenting, fictional companion roleplay;
    may follow the user's affectionate address, never claim a real marriage
    or encourage exclusive dependence.
- Default remains **Dịu dàng** (gentle). Mode is stored in the existing
  on-device Mira voice prefs; no new back-end profile or data collection.
- A tiny transient turn-guide detects explicit boundaries, supportive sharing,
  celebration, affection, work and conversational continuity. It supplements
  the prompt; it does not store inferred feelings or relationship status.
- Existing provider, ElevenLabs quality, memory permissions and consent controls
  are unchanged. Work questions continue to receive work answers.
- Voice prosody directions support both new profiles with natural pacing.
- On requesting normal speech, Mira must respect the user's latest turn even
  if a partner profile remains selected. Permanent choice is changed in Settings.

## Evidence and limits
- Unit tests verify exact behavioral instructions, option UI and no memory
  persistence changes. They are NOT live provider conversation-quality scoring.
- Real multi-turn Vietnamese/voice evaluations still needed to measure warmth,
  topic transitions, excessive affectionate nicknames and TTS latency.
