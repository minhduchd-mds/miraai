# Mira cloud memory v2 — signed anonymous scopes

**Security boundary**: Each browser receives a server-minted random 192-bit `m2_...` scope in a signed, HttpOnly, SameSite=Strict session cookie; on Vercel the cookie is `__Host-mira_session` with Secure. The server ignores old device IDs from request URLs/bodies and refuses unsigned `mira_scope` cookies.

Required: `MIRA_MEMORY_SESSION_KEY` of at least 32 bytes, held only in the server's production/preview environment. Missing key makes private-memory routes respond 503 instead of accepting caller-controlled identifiers. Never inject this secret into Vite's `VITE_*` namespace.

**This is not account authentication.** It isolates an anonymous browser session; it does not support verified cross-device ownership, compromise recovery or multi-user account authorization. Account-based auth remains a distinct P0 requirement before a multi-user public cloud memory launch.

**Legacy data safety:** v1 memory records remain unmodified in the database. Automatic transfer is *intentionally disabled*: old browser device identifiers and unsigned cookies cannot prove ownership of a record. Users with a preexisting exported Mira Identity Capsule can explicitly import that file into their new signed session. If no trusted local backup exists, recovery requires a separate authenticated owner verification process; **do not reactivate arbitrary device-ID queries**.

**Compatibility:** Mira Desktop and GitHub Pages remain local-only for memory. Browser clients no longer send `device` IDs in URLs or JSON bodies; the server's signed cookie is sole anonymous-scope authority.

**Deployment QA:** Confirm session key present in each target environment. Test first visit, refresh, two isolated browsers, forged cookie, cross-origin POST, export, delete-all, and capsule import. Keep an explicit data migration sign-off prior to rollout if previously stored server-side memories are in active use.
