# Mira V2 Architecture — Implemented State

> Product definition: **Mira — Voice-first AI Companion**.

Tài liệu này mô tả kiến trúc **đang chạy trên `main`**, không phải target giả định.

## 1. Product boundary

Mira không còn được định nghĩa là “demo trợ lý giọng nói 3D”. Lõi sản phẩm là conversation runtime + brain + memory + skills. 2D/3D/camera/gesture là các lớp presence/sensor tùy chọn.

```text
INPUT
├─ Voice
└─ Text
   ↓
CONVERSATION RUNTIME
├─ Conversation Machine
├─ Speech Queue
└─ Turn Manager
   ├─ Memory Service
   ├─ Host Context
   ├─ Skill Registry
   └─ Brain Gateway
      ↓
ASSISTANT TURN
├─ Speech → TTS → Presence
└─ ResultView → Result Surface
```

## 2. UI boundary

### Production

`src/app/AppV2.tsx`

- clean conversation-first shell;
- text composer;
- mic + live mode;
- caption/status;
- generic Result Surface;
- history drawer;
- Settings V2;
- production-safe avatar packs;
- focus-visible, skip link, dialog focus trap, reduced-motion support.

### Labs / compatibility

`src/App.tsx` is preserved behind `?legacy=1` and lazy-loaded from `main.tsx`.

Labs contains camera, hand gesture, Splat, simulator, raw telemetry and Developer Console. These capabilities do not belong on the default production surface.

## 3. Conversation Runtime

`src/core/useMira.ts` remains the React binding/compatibility API, but orchestration responsibilities have been moved behind explicit services:

- `src/runtime/conversation-machine.ts` — deterministic state graph.
- `src/runtime/speech-queue.ts` — serialized chunked TTS with cancellation token.
- `src/runtime/turn-manager.ts` — memory/context/skill/brain coordination.
- `src/intelligence/memory/memory-service.ts` — persistence/RAG boundary.
- `src/intelligence/skills/registry.ts` — capability registry + risk policy.

Voice and text both enter the same `handleUtterance` flow.

### State graph

```text
idle
 ├─ MIC_START → listening
 └─ TEXT_SUBMIT → thinking

listening
 ├─ STT_FINAL → thinking
 └─ INTERRUPT → interrupted

thinking
 ├─ SPEAK/BRAIN_DONE → speaking
 └─ INTERRUPT → interrupted

speaking
 ├─ TTS_DONE → idle
 └─ INTERRUPT → interrupted

interrupted
 └─ MIC_START → listening
```

Runtime tests lock the main lifecycle and barge-in behavior.

## 4. Skills and Result Surface

Canonical skill contract lives in `src/intelligence/skills/types.ts`.

Every skill declares:
- `id`, `description`;
- `risk` (`local-read | external-read | write | sensitive`);
- `requiresNetwork`;
- `supportsVoice`;
- pure `match()`;
- side-effecting `execute()`.

`write` and `sensitive` skills are blocked unless the interaction layer explicitly approves them.

Canonical view contract is `ResultView`:
- weather;
- image;
- card;
- list.

`core/content.ts` is now compatibility/utility code, not the product-level view architecture.

## 5. Host integration

Mira is standalone by default. Host apps can provide:

```text
HostBridge
├─ getContext()
├─ listActions()
└─ executeAction()
```

Soi can therefore tell Mira which project/screen is active and expose host actions without hardcoding Soi into the persona or core runtime.

Host action safety:
- `read` may execute after tool routing;
- `write` and `sensitive` are not auto-executed by Mira;
- confirmation, RBAC, license and audit trail remain responsibilities of the host.

See `docs/HOST-INTEGRATION.md`.

## 6. Brain Gateway

Production browser → `/api/chat` → `lib/brain-gateway.js`.

Supported server providers:
- Gemini;
- OpenAI;
- Anthropic.

Provider/model selection is env-driven. Failures are isolated and configured fallbacks are tried in order. Direct browser BYOK is restricted to Vite DEV.

The default provider adapters currently return conversational text; the `BrainReply.toolCalls` contract is optional and ready for custom/host-aware adapters that produce structured calls.

## 7. Memory & privacy

Memory consists of:
- recent turns;
- semantic recall via embeddings/pgvector;
- durable facts distilled from conversation.

Client preference can disable load/save/recall/distill.

Server scope migration:
1. legacy `device_id` seeds the first scope to preserve existing history;
2. server sets `mira_scope` HttpOnly + SameSite=Lax cookie;
3. subsequent APIs prefer server cookie over arbitrary browser-provided id.

`/api/profile` supports list/edit/forget/export/delete-all.

Limitation: this is anonymous browser identity, not authenticated multi-user account ownership yet.

## 8. Presence

`PresenceStage` renders the lightweight 2D poster immediately. If a selected production avatar has VRM and 2D-only mode is off, the heavy Three/VRM stage is dynamically imported after the shell settles.

Production Settings exposes a small safe avatar manifest. Experimental looks remain in Labs.

## 9. Backend boundaries

Two runtimes stay separate intentionally:

```text
Cloud Gateway (Vercel / JS)
├─ Brain providers
├─ Memory APIs
└─ cloud TTS proxy

Voice Runtime (FastAPI / Python)
├─ Edge TTS
├─ VieNeu
└─ self-host/local voice services
```

There is no reason to rewrite the Python Voice Runtime into Node solely for uniformity.

## 10. Quality gates

CI (Node 22 + 24):
- architecture guard;
- skill contract guard;
- TypeScript;
- runtime unit tests;
- Vite production build;
- initial bundle budget;
- runtime dependency audit at critical threshold.

The bundle guard traverses only the Vite initial import graph. Dynamic 3D/Labs/Vision chunks are intentionally excluded from the initial budget.

## 11. Known limits / next product work

These are not unfinished architecture migrations; they are future product capabilities:

1. authenticated user/org identity if Mira becomes multi-user;
2. richer structured tool-call adapters/evals for provider models;
3. account-level retention policy and encrypted export if required by deployment;
4. provider-specific voice quality benchmarks;
5. broader skill catalog (Soi, calendar, documents, search) as host/product requirements appear;
6. browser/device E2E voice testing, because CI cannot emulate every Web Speech implementation.

## 12. Files that stay intentionally

- `src/App.tsx`: Legacy/Labs compatibility.
- camera/gesture/Splat modules: Labs only.
- FastAPI voice runtime: self-host/local voice boundary.
- old adapter interfaces: compatibility and fallback value.

Cleanup is allowed only when callers are proven absent and CI remains green.
