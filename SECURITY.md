# Mira Security & Privacy Boundaries

Mira is a voice-first companion with optional cloud providers, persistent memory and host integrations. Security depends on preserving clear boundaries between browser, cloud gateway, local voice runtime and embedding host.

## Secrets

- Production OpenAI/Anthropic/Gemini credentials live server-side.
- `/api/chat` is the production Brain Gateway.
- Direct browser BYOK is restricted to Vite DEV / Developer Labs.
- Never commit real API keys or put them in `VITE_*` production variables.

## Memory

### Browser/server

Current identity is an **anonymous browser scope**:
- legacy `device_id` seeds existing memory once;
- server pins the scope in an HttpOnly, SameSite=Lax cookie;
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

As of 2026-09-28, the previously tracked protobufjs advisory is resolved in this repository: the lockfile pins protobufjs 7.6.6, newer than the patched 7.6.5 release.

The frontend toolchain is aligned on Vite 8.3.1 + @vitejs/plugin-react 6.1.1. CI continues to block critical runtime advisories with `npm audit --omit=dev --audit-level=critical`; lower-severity findings remain review items rather than being silently suppressed.

## Reporting / review checklist

Before adding a new provider, sensor, memory field or skill:
1. identify where secrets/data live;
2. define whether the action is read/write/sensitive;
3. define consent/confirmation behavior;
4. ensure logs do not contain secrets/raw audio;
5. add a failure-path test;
6. confirm the initial bundle does not accidentally import Labs/heavy code.
