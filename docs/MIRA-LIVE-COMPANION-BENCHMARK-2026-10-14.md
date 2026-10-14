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

## Follow-up verified production recovery — 2026-10-14

- Root of the **HTTP 504** observed during diagnosis: Vercel production runtime log explicitly stated `Vercel Runtime Timeout Error: Task timed out after 30 seconds` on `/api/chat`. The bounded free-model fallback could legitimately use up to 48 seconds plus quota work.
- Added `vercel.json` with `functions.api/chat.js.maxDuration=60` and a CI assertion to permit the existing fallback to finish. Provider keys, persona, response quality budgets, and ElevenLabs voice/model were not modified.
- [Real production companion benchmark](https://github.com/minhduchd-mds/miraai/actions/runs/38499868496): **SUCCESS**, five synthetic turns, `provider=gemini`, `p50=7,869ms`, `p95=21,648ms`. Every turn returned nonempty output; synthetic recall, boundary adherence, and technical task switching heuristics were positive. No personal data was supplied or logged.
- This **does not prove** browser Memory persistence, automatic emotional inference accuracy, real-device speech-to-first-audio, or subjective romantic naturalness.
- Earlier independent synthetic [ElevenLabs check](https://github.com/minhduchd-mds/miraai/actions/runs/38442240754) generated 35,570 bytes of actual audio in 3,782ms round trip. Voice generation was intentionally not rerun in the recovery benchmark to avoid unnecessary credits.
- On detecting a scenario where an explicit user's romantic boundary fell outside the last 16 history turns, boundary scanning was extended to all provided USER turns. This makes no lasting relationship claim and stores no extra user data.

## Brain latency iteration — 2026-10-14

- Retained Gemini 3.8 Flash as the first-choice model and existing low thinking level, system instructions, short-answer minimum token budget, and ElevenLabs configuration.
- Removed an unnecessary retry alias: on October 8, 2026, Google announced `gemini-3.7-flash` API requests redirect to `gemini-3.8-flash` ([official release notes](https://ai.google.dev/gemini-api/docs/changelog)). Retrying 3.7 after a failed 3.8 request did not change the underlying model and could add another 12s timeout.
- Legacy `GEMINI_MODEL=gemini-3.7-flash` is canonicalized to 3.8 rather than rejected. 3.5 Flash-Lite remains only an existing fallback when the primary is unavailable, not the normal route.
- Rate-limit responses (`429`) enter a **90-second process-local cooldown** rather than retrying the exhausted model for each dialogue turn; model-validation failures use a 5-minute cooldown. No personal memory or per-user metadata is stored in cooldowns.
- The synthetic benchmark now reports per-turn wall-clock durations and allowlisted model identifiers (no AI reply content, prompts, credentials or private records).
- **Verified real production follow-up:** [GitHub Actions 38502295336](https://github.com/minhduchd-mds/miraai/actions/runs/38502295336) PASS, five synthetic turns; p50=8,199ms, p95=18,144ms, individual turn times=[18,144, 14,657, 8,199, 2,470, 1,402]ms. The prior production benchmark was p50=7,869ms, p95=21,648ms, hence **P95 improved by 3,504ms (~16.2%) while P50 worsened by 330ms (~4.2%)**. This small, non-controlled sample is not statistical evidence that future response times will always improve.
- **Quality disclosure:** this follow-up reported actual model `gemini-3.5-flash-lite` (fallback), **not the primary `gemini-3.8-flash`**. Both still follow the same existing route/prompt/thinking settings, but no equivalence of model quality is claimed. Primary-model timeout and free-tier access remain a focus for further research. No new billable model/credentials and no auto-upgrade were enabled.
- The follow-up CI for the final runtime/test edits: [run 38502427795](https://github.com/minhduchd-mds/miraai/actions/runs/38502427795) PASSED on Node 24/26, 692 tests passed, 0 failed on Node 26, with 0 vulnerabilities in the audited dependency checks.
