# Mira Security & Privacy Boundaries

Mira is a voice-first companion with optional cloud providers, persistent memory and host integrations. Security depends on preserving clear boundaries between browser, cloud gateway, local voice runtime and embedding host.

## Secrets

- Production OpenAI/Anthropic/Gemini credentials live server-side.
- `/api/chat` is the production Brain Gateway.
- Direct browser BYOK is restricted to Vite DEV / Developer Labs.
- Never commit real API keys or put them in `VITE_*` production variables.

## Memory

Current identity is an **anonymous browser scope**:
- legacy `device_id` seeds existing memory once;
- server pins the scope in an HttpOnly, SameSite=Lax cookie;
- profile/history/memory APIs resolve ownership from that cookie.

Users can disable memory and can edit, forget, export or delete stored facts/history from Settings.

This is not equivalent to authenticated account ownership. A multi-user/team deployment should replace/link the anonymous scope with authenticated user/org identity and enforce authorization server-side.

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

As of 2026-08-15, `npm audit --omit=dev` reports a moderate advisory affecting transitive `protobufjs` 7.5.0–7.6.4 (GHSA-j3f2-48v5-ccww / CVE-2026-59877). The patched 7.x version is 7.6.5.

The advisory requires parsing attacker-influenced `.proto` schema text through reflection parsing APIs. Mira does not currently expose a user-controlled `.proto` parsing path, so the known vulnerable precondition is absent in the application flow. The dependency should still be upgraded when the lockfile can be regenerated and validated; do not suppress or mislabel the advisory as resolved before that happens.

CI blocks **critical** runtime advisories and surfaces lower-severity advisories for review.

## Reporting / review checklist

Before adding a new provider, sensor, memory field or skill:
1. identify where secrets/data live;
2. define whether the action is read/write/sensitive;
3. define consent/confirmation behavior;
4. ensure logs do not contain secrets/raw audio;
5. add a failure-path test;
6. confirm the initial bundle does not accidentally import Labs/heavy code.
