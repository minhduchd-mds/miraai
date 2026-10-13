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

## Verified run evidence — 2026-10-14 (Asia/Bangkok)

- Commit `648bb197`: [full CI](https://github.com/minhduchd-mds/miraai/actions/runs/38442240723) **PASS** on Node 24 and Node 26; **688 passed, 0 failed** in Node 26 unit suite; functional benchmark, camera-trace benchmark, TypeScript, Vite build, artifact checks and runtime audit completed.
- Initial real probe (commit `0ada289c`): [Actions run](https://github.com/minhduchd-mds/miraai/actions/runs/38441765703) reached production, Brain and ElevenLabs configuration were true, but the first `POST /api/chat` returned **HTTP 502**; Voice was not attempted in that revision.
- Independent live probe (commit `648bb197`): [Actions run](https://github.com/minhduchd-mds/miraai/actions/runs/38442240754) reported `brain.configured=true`, `configuredProviderCount=2`, `freeOnly=true`, `voices.configured=true`, and `elevenLabsOnly=true`. Brain `POST /api/chat` still returned **HTTP 502**. ElevenLabs `POST /api/tts` **succeeded** with **35,570 audio bytes** and **3,782 ms** runner-to-server round trip. The benchmark job itself is **FAIL** because the required Brain inference gate failed.
- Vercel runtime logs corroborate `[Mira Brain Gateway] provider chain unavailable` at `/api/chat`. Root cause upstream is **not yet established**; model quota, provider availability, gateway credentials and the verified-free catalog are hypotheses, not conclusions. No automatic promotion to billable fallback/model has been made.
- No real user memory, private conversation, camera feed, real microphone, user account or human auditory evaluation was used. Emotion sensing is covered by existing deterministic/local tests only. Five-turn live conversational quality and browser memory durability remain **blocked** until actual provider inference succeeds.
- Release: Vercel reported the production deployment for commit `648bb197` **READY**; configured domains `miraai-five.vercel.app` and `miraai-ten.vercel.app` have not been validated via interactive human browser session.

## Next root-cause isolation without reducing AI quality

1. With production now emitting sanitized provider/status categories, inspect the *next explicitly authorized* synthetic Brain request in Vercel logs to distinguish provider HTTP/auth/quota failures; do not record prompts or raw exceptions.
2. Check availability, free-tier quota and credentials of the two configured providers, and verify gateway model catalog zero-price eligibility. **Do not change persona, ElevenLabs voice/model or enable paid fallback automatically.**
3. Only after successful inference, run the five-turn live scenario plus Memory consent isolation, then a separate optional real-device listening/STT latency evaluation with explicit user permission.
