# Mira V2 — Architecture & Migration Plan

## Product direction

Mira V2 is a **voice-first AI companion**, not a 3D avatar demo.

The product hierarchy is:

1. Conversation
2. Intelligence + memory
3. Skills/actions
4. Presence (VRM/2D)
5. Sensors and experiments

Avatar, camera, gesture and Gaussian Splat are optional capabilities. They must not define the production shell.

## Current production boundary

`src/main.tsx` now renders `src/app/AppV2.tsx` by default.

The former UI remains available through `?legacy=1` as a compatibility/Labs surface while functionality is migrated. This keeps experimental capabilities usable without allowing them to dominate the main product UX.

## Target architecture

```text
User
 ├─ Voice
 ├─ Text
 └─ Sensor events (opt-in)
        │
        ▼
Conversation Runtime
 ├─ ConversationMachine
 ├─ TurnManager
 ├─ InputController
 └─ SpeechQueue
        │
        ▼
Context Assembler
 ├─ Recent history
 ├─ Semantic memory
 ├─ User profile
 ├─ Host context
 └─ Available skills
        │
        ▼
Mira Brain
 ├─ Response
 ├─ Mood
 ├─ Intent
 └─ Tool calls
        │
   ┌────┴────┐
   ▼         ▼
 Speech    Skill Router
   │         │
   TTS       SkillResult
   │         ├─ speech
   │         ├─ view
   │         └─ data
   ▼         ▼
Presence   Result Surface
```

## Folder ownership

```text
src/
├─ app/                    # Product shell and top-level composition
├─ runtime/                # Conversation state, turn lifecycle, speech queue
├─ core/                   # Compatibility layer during migration
├─ intelligence/           # Target: brain, context, memory, skills
├─ adapters/               # Target: STT/TTS/LLM/sensors provider adapters
├─ presence/               # Target: VRM/2D, expressions, lip-sync
├─ settings/               # Target: user settings and privacy
├─ ui/                     # Presentational components/styles
└─ labs/                   # Target: Splat, gestures, sensor experiments, simulator
```

The migration is incremental. Existing files do not move until their dependency boundary is clear.

## Runtime state machine

The canonical machine now lives in `src/runtime/conversation-machine.ts`.

States:

- `idle`
- `listening`
- `thinking`
- `speaking`
- `interrupted`
- `error`

Events:

- `MIC_START`
- `MIC_STOP`
- `STT_FINAL`
- `BRAIN_DONE`
- `TTS_DONE`
- `INTERRUPT`
- `FAIL`
- `RESET`

`src/core/state-machine.ts` is a compatibility re-export. The next runtime migration step is replacing direct `setState(...)` calls in `useMira.ts` with event transitions while preserving current behavior.

## Production vs Labs

### Production shell

- Presence (VRM / 2D fallback)
- Voice conversation
- Transcript/caption
- Smart turn-taking
- Barge-in
- Brain + semantic memory
- Visual result surface
- Settings entry

### Labs / compatibility

- Face emotion tracking
- Hand gesture control
- Gaussian Splat viewer
- Manual state simulator
- Provider diagnostics
- Direct browser BYOK

Labs remain available through the legacy shell during migration.

## Cloud Gateway and Voice Runtime

Mira intentionally has two server responsibilities.

### Cloud Gateway — `api/*`, `lib/*`

Responsibilities:

- LLM proxy
- cloud TTS proxy
- history
- semantic memory
- durable facts
- Neon access

Target rule: production provider secrets remain server-side.

### Voice Runtime — `server/*`

Responsibilities:

- self-host/local TTS
- VieNeu
- Edge TTS
- local/on-prem voice services

Do **not** merge the Python runtime into the Vercel gateway just for architectural symmetry. Their deployment and latency requirements are different.

## Memory V2 target

Current `device_id` identity is acceptable for a personal MVP but not multi-user production.

Target model:

```text
User / Session
   │
   ▼
Memory Policy
   ├─ Recent turns
   ├─ Episodic memories
   └─ Durable profile facts
```

Required product controls:

- memory on/off
- inspect remembered facts
- edit/forget one fact
- clear all
- export data
- retention policy
- authenticated ownership before multi-user release

## Skills target

Weather and image rendering currently live in `core/content.ts`. They should migrate to a generic skill contract rather than accumulating more regex-based capabilities in `useMira.ts`.

Target:

```ts
interface MiraSkill {
  id: string;
  description: string;
  canHandle(input: string): boolean;
  execute(input: string, context: SkillContext): Promise<SkillResult>;
}

interface SkillResult {
  speech?: string;
  view?: unknown;
  data?: unknown;
}
```

Planned skills:

- Weather
- Image
- Search
- Soi bridge
- Calendar/reminders
- Documents/files

## Migration phases

### P0 — Foundation (this branch)

- Make App V2 the production default.
- Preserve old UI as `?legacy=1` Labs/compatibility.
- Remove unreferenced Mira Orb component.
- Remove committed IDE workspace state.
- Add architecture CI guard.
- Move canonical conversation machine to `src/runtime/`.
- Update design contract.

### P1 — Conversation runtime

- Split `useMira.ts` into runtime services.
- Wire the event state machine into the actual voice loop.
- Extract speech queue/chunking.
- Extract history/memory service.
- Keep `useMira()` as a compatibility facade.

### P2 — Conversation UI

- Add text composer (voice-first, not voice-only).
- Add compact conversation history.
- Introduce result surface contract.
- Separate user Settings from Developer/Labs.

### P3 — Skills

- Move weather/image out of core orchestration.
- Add SkillRegistry.
- Add host bridge and Soi actions.

### P4 — Brain gateway

- Remove production direct-browser provider calls.
- Add provider routing on server/runtime.
- Expand brain response to intent/tool calls.

### P5 — Memory & identity

- Authenticated identity.
- Memory scopes and consent.
- View/edit/delete/export memory.

### P6 — Presence & asset optimization

- Avatar manifest.
- Lazy-load avatar packs.
- Split Labs assets from production delivery.
- Keep 2D fallback.

## Guardrails

Do not add new production capability directly into `App.tsx` or the monolithic part of `useMira.ts`.

New capability must belong to one of:

- runtime
- intelligence/skill
- adapter
- presence
- settings
- labs

This rule prevents Mira from returning to a single demo component that owns the whole product.
