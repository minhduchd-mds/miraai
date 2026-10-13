# Mira production companion benchmark — 2026-10-14

## Scope
- CI-independent one-shot probe of the **deployed API gateway**, not a user's browser session.
- Five synthetic Vietnamese user turns and AI replies test basic context continuity, an explicit romantic-address boundary, and task-switching. The API keeps context through request history; it **does not** exercise real persistent user memory, the camera emotion model or the browser's dynamic TurnManager guidance.
- One short synthetic ElevenLabs TTS request verifies a valid server-generated audio response and records round-trip latency and byte count. It does **not** measure perceived naturalness, live STT, playback or device first-audio time.
- Automated heuristics are basic red flags, not a human-scored naturalness benchmark.
- No private user content, identity, real user accounts, credentials, cookies, transcripts, generated audio or AI reply text are saved/logged by the benchmark.
- Model/provider and voice IDs are not overwritten. Both paid checks require flags. The one-time push run is gated by an exact reviewed commit message; future paid runs require manual explicit workflow dispatch confirmation.

## How to run
Readiness only: `node scripts/live-companion-benchmark.mjs`

With explicit authorization: `node scripts/live-companion-benchmark.mjs --allow-paid-call --allow-voice-call`

## Interpretation
Report `brain.configured` and `voices.configured` indicate provider configuration only. `liveChat` means live answers returned; `liveVoice` means actual audio bytes returned. If production is protected or unreachable, report that failure rather than claiming success.

## Independent follow-up and safe diagnostics
- Brain inference failures do not skip the separate explicitly authorized ElevenLabs TTS probe.
- Backend diagnostics log only allowlisted provider names and HTTP status categories, never raw errors, transcripts or credentials.
- First live test reached production: configured Brain and ElevenLabs, but HTTP 502 from /api/chat. Voice was not reached in that first run.
