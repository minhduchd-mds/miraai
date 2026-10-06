# Mira Companion Runtime

## Implemented runtime

- ElevenLabs neural Vietnamese TTS through a server-side gateway. Browser code never receives the provider API key; gateway failure is surfaced instead of silently switching voice providers.
- Real local LLM on compatible WebGPU browsers with WebLLM + Qwen 2.5 1.5B. No LLM API key is required for the Pages build.
- Long-term local memory in IndexedDB with a persistent-storage request when supported, while the existing Neon/API memory path remains available on server deployments.
- MediaPipe face landmarks with facial activity map, head pose, gaze, nod/shake, explicit facial gestures (smile, frown, wink, brow raise, mouth open, squint) and existing hand gestures.
- Camera affect estimate: happy, sad, tired, tense/angry, surprised and neutral. It is treated as an uncertain visual signal, never a diagnosis.
- Affect adaptation: speech rate, visual energy, prompt context and conservative proactive prompts.
- Proactive companion loop for stable expression signals, long silence, resume/wake events and late-night context.
- PWA + Screen Wake Lock + visibility/focus recovery for the strongest background behavior available to a web app.
- Capability-policy gate for skills. Existing read paths stay backward-compatible; write/sensitive skills still require per-skill approval and can additionally be constrained by a runtime capability allow-list.
- Host-action authorization boundary: write/sensitive actions fail closed unless the embedding host explicitly authorizes the exact invocation; hosts may also deny reads.
- Session-local runtime audit trail records only action/skill ids, policy outcomes, capability names and host ids — never raw prompts, secrets or user input.

## Capability boundary

Mira treats skill execution as a capability decision rather than a direct registry call.

- Capabilities are explicit when a skill declares them and conservatively inferred for legacy skills.
- A runtime policy can allow-list host, storage, network and sensitive capabilities.
- Write/sensitive capabilities use a two-key gate when a runtime policy is active: the skill itself and the concrete capability must both be approved.
- `denyNetwork` is an emergency circuit breaker and overrides the capability allow-list.
- Omitting the runtime policy preserves current behavior, so existing UI/voice flows do not break while stricter hosts adopt the boundary incrementally.

Host actions are separately gated because they bypass the native skill registry. Read actions keep backward compatibility, while write/sensitive actions require an explicit host `authorizeAction` decision before `executeAction` can run. Authorization failure or exceptions fail closed.

The runtime audit trail is RAM-only and bounded. It is intended for diagnostics and security review, not conversation memory; raw user input and model prompts are deliberately excluded.

This is a policy layer, not an operating-system sandbox. Desktop/server hosts should enforce the same decision at the actual process/network boundary as a second line of defense.

## Privacy

Raw camera frames are processed in the browser and are not persisted. Only small numeric affect observations may be written to local IndexedDB when memory is enabled.

## Browser boundary

A normal web page or installed PWA cannot keep microphone/camera capture alive after the operating system has explicitly locked the device or suspended the browser. Mira requests a screen wake lock while 24/7 mode is active and resumes the voice loop when the page becomes visible again.

True locked-screen microphone capture requires a native/desktop host. GitHub Pages cannot honestly provide that capability by itself.
