# Mira Security & Privacy Boundaries

Mira is a voice-first companion with optional cloud providers, persistent memory and host integrations. Security depends on preserving clear boundaries between browser, cloud gateway, local voice runtime and embedding host.

## Secrets

- Production OpenAI/Anthropic/Gemini credentials live server-side.
- `/api/chat` is the production Brain Gateway. It requires an explicit `Origin` (browser or Tauri);
  requests without one are refused so the endpoint is not an anonymous LLM proxy. This raises the bar,
  it is **not** authentication — quotas (`lib/ai-quota.js`) remain the cost control.
- Every model prompt starts with the server-owned `SAFETY_POLICY_VI` (`lib/crisis-safety.js`); the
  client-assembled persona/context follows it as lower-priority data.

## Mira Live (realtime voice)

- The browser never receives `GEMINI_API_KEY`. `POST /api/chat?route=live-token` mints a **single-use**
  Gemini Live ephemeral token (30 min lifetime, 1 min to start a session) via `lib/live-token.js`.
- The token is constrained (`liveConnectConstraints`) to one model and to a system instruction built on
  the server from a whitelisted persona id; the partner role is downgraded unless the client sends the
  18+ confirmation. Client memory context is bounded to 2,400 characters and framed as data.
- Quota lane `live`: 6 sessions / 10 min / client, 150 globally. `MIRA_LIVE_DISABLED=1` turns it off.
- Audio is streamed, not stored. Transcripts follow the normal history/Memory path.

## Crisis safety

- A self-harm disclosure (`detectCrisis`, high level) gets a deterministic reply with 115 and Vietnamese
  hotlines on every runtime — server (`/api/chat`) and client (`useMira`), even when every provider is down.
- Crisis turns are kept out of Memory persistence; a persistent help banner is shown until the user closes it.
- Detection is phrase-based and conservative; it is a safety net, not a diagnosis, and the text is never logged.
- Direct browser BYOK is restricted to Vite DEV / Developer Labs.
- Never commit real API keys or put them in `VITE_*` production variables.

## Memory

### Browser/server

Current identity is an **anonymous browser scope**:
- legacy `device_id` seeds existing memory once;
- server pins the scope in a signed HttpOnly, SameSite=Strict cookie (`__Host-mira_session` on Vercel);
- profile/history/memory APIs resolve ownership from that cookie.

Users can disable memory and can edit, forget, export or delete stored facts/history from Settings.

This is not equivalent to authenticated account ownership. A multi-user/team deployment should replace/link the anonymous scope with authenticated user/org identity and enforce authorization server-side.

### Desktop local

Desktop dùng SQLite `mira.db` cho local turns, structured memory, affect, permissions và music history.

- durable structured memory chỉ được distill từ text người dùng tự nói;
- “đừng nhớ/đừng lưu” chặn raw turn + distillation tương ứng;
- affect là observation, không phải personal fact;
- local music indexing là opt-in và root-scoped;
- native media permission được kiểm tra lại ở Rust trước execution.

Desktop signing/notarization vẫn là release hardening work; local storage chưa được mô tả là encrypted-at-rest cho tới khi encryption layer thực sự được bật.

## Voice and sensors

- Mic activates only through the conversation controls/live mode.
- Camera/gesture are not active on the default production UI.
- Camera, hand tracking, Splat and simulator remain in explicit Labs/Legacy mode.
- Voice-generated/synthesized output is disclosed in Settings.

## Host actions

A host app may expose actions through `HostBridge`.

- `read`: may execute when routed.
- `write` / `sensitive`: Mira runtime does not auto-execute; host confirmation is required.
- The host remains responsible for RBAC, license checks, audit trail and domain-specific authorization.

Never let a voice command bypass the host's existing permission model.

## Provider privacy

OpenAI Responses requests are sent with `store: false`. Mira owns its own conversation/memory layer instead of relying on provider-side conversation state.

Provider/network failure falls through to configured server providers; if no provider is available the client retains its canned fallback rather than exposing a secret or failing open.

## Dependency status

As of 2026-09-28, the previously tracked protobufjs advisory is resolved in this repository: the lockfile pins protobufjs 7.6.6, newer than the patched 7.6.5 release. Its `postinstall` was reviewed at tag `protobufjs-v7.6.6`: it only inspects the parent package dependency range and emits a compatibility warning. `package.json` therefore approves install scripts only for the exact `protobufjs@7.6.6` version, not future versions.

The frontend toolchain is aligned on Vite 8.3.1 + @vitejs/plugin-react 6.1.1. CI continues to block critical runtime advisories with `npm audit --omit=dev --audit-level=critical`; lower-severity findings remain review items rather than being silently suppressed.

## Reporting / review checklist

Before adding a new provider, sensor, memory field or skill:
1. identify where secrets/data live;
2. define whether the action is read/write/sensitive;
3. define consent/confirmation behavior;
4. ensure logs do not contain secrets/raw audio;
5. add a failure-path test;
6. confirm the initial bundle does not accidentally import Labs/heavy code.
