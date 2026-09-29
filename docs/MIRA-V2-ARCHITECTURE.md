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
- mic + live mode;
- no production text composer; text remains a runtime/host compatibility capability;
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

## 8.1 Vision world state

Production camera context now composes a conservative, ephemeral stack:

```text
Object detector
  ↓
Spatial Scene Graph
  ↓
Object Interaction proxy
  ↓
Action Sequence v12
  ↓
Causal Action Graph v13
  ↓
Short-term World Model v14
  ↓
Brain runtime context
```

World Model v14 provides short-term object permanence, confidence decay, near-return/relocation continuity and a bounded temporal event window. It is RAM-only and is explicitly blocked from long-term memory persistence by the architecture guard. It does not establish physical identity, ownership, touch, intent or human causality.

See `docs/MIRA-WORLD-MODEL-V14.md`.

## 8.2 Spatial UI control

Production vision input now includes a separate UI interaction plane:

```text
calibrated gaze/head ─┐
                      ├─ SpatialUIController → focused UI target
hand pointer/pinch ───┘                      → activate / grab / move
two pinched hands ──────────────────────────→ scale / rotate
```

Indirect mode keeps gaze/head as the focus source and uses pinch only as the commit gesture. A stable Pointing Up gesture switches to direct hand pointing. A nod is a face-only activation fallback; gaze alone never triggers a click.

The camera monitor and Result Surface are movable spatial windows. Hand landmark `z` is preserved through the input pipeline and a session-only depth anchor can add bounded translate-z after six low-jitter samples; otherwise movement remains x/y-only. A relative index-finger ray can hit targets that explicitly declare a depth plane. Metric world-space depth remains reserved for a future WebXR/device adapter.

See `docs/SPATIAL-INTERACTION.md`.

### Spatial v3 direct contact

`SpatialDirectTouchTracker` adds conservative fingertip collision over `SpatialAnchorVolume` targets. Contact requires x/y/z overlap, hand confidence, and a 90 ms stable dwell. Contact changes focus and visual feedback only; pinch is still required to commit an action or hold a window. The state remains session-only and is guarded against long-term persistence.

### Spatial v4 object manipulation

`SpatialObjectRuntime` introduces manipulable object poses independent of DOM window movement. The first wired object is `mira.core`. Direct contact or ray focus selects the object; pinch starts a grab; one hand changes bounded x/y/z position; two pinched hands change scale and rotation. A shake/cancel restores the pre-grab pose. Object state remains session-only.

### Spatial v5 world graph

`SpatialWorldRuntime` adds a bounded parent/child anchor graph above `SpatialObjectRuntime`. Runtime anchors currently include workspace, home/center docks, and dynamic Camera/Result surface docks. Grab detaches an object; release may snap it to the nearest eligible anchor; attached objects resolve their pose through the parent chain and therefore follow moving parent surfaces. Cycles are rejected and hierarchy resolution is capped at eight levels. World anchors and attachments remain session-only.

### Spatial v6 placement preview

`SpatialWorldRuntime` now exposes magnetic placement previews before release. Surface anchors can define bounded plane constraints, so candidate poses project to the nearest legal point on Camera/Result surfaces. Each spatial object may expose an object anchor for object-to-object parenting; self-parenting is excluded. Preview/attachment state remains ephemeral.

### Spatial v7 hand physics

`SpatialPhysicsRuntime` sits between hand manipulation and object pose. It estimates filtered pointer velocity, classifies release as place vs throw, integrates bounded inertia with damping/soft collisions, and supplies spring-like magnetic placement. Physics coordinates remain normalized interaction-space values rather than physical force/mass measurements. Physics state is session-only.

### Spatial v8 multi-object physics

The production spatial layer now contains `mira.core` and `mira.node`. Objects carry interaction-space collision radius and mass. `resolveSpatialObjectCollisions()` separates sphere-proxy overlaps and returns velocity impulses, while anchored/grabbed bodies can remain static. Per-object stack anchors build clusters through the existing parent/child world graph. Home anchors use `acceptsObjectId` to avoid cross-object snap conflicts. All collision/stack state remains ephemeral.

### Spatial v9 cluster constraints

`SpatialWorldRuntime` now exposes cluster roots/members and mutable attachment-local poses. `SpatialJointRuntime` layers fixed, hinge and slider constraints on those attachments. Fixed children move with the cluster root; hinge/slider children can be manipulated with two-hand input while remaining attached. Collision bodies carry cluster IDs so internal members do not collide with one another. All joint and cluster state remains session-only.

### Spatial v10-v13 final browser stack

The spatial browser architecture is now closed through four final layers:

- `SpatialSessionLayoutRuntime` and `SpatialSelectionRuntime` provide bounded RAM-only layout restoration and multi-cluster selection.
- `beginSpatialGroupTransform()` / `applySpatialGroupTransform()` provide centroid-based multi-cluster translation, scale and rotation.
- `SpatialDeviceAdapterRuntime` separates webcam-relative input from a future WebXR metric input source without auto-claiming metric tracking.
- long-session hardening caps world-model memories/event IDs, caps layout snapshots, and rejects cyclic object attachments.

The active production sensor remains webcam-relative unless a real XR/device adapter supplies metric poses. Browser-spatial state remains ephemeral.

### Spatial v14 real WebXR session bridge

`SpatialWebXRSessionRuntime` owns the explicit user-activated `immersive-ar` lifecycle. It negotiates optional hand-tracking, hit-test, anchors, depth sensing, local-floor and DOM overlay features, reads metric XRHand joints with `XRFrame.getJointPose()`, and exposes real-world hit-test poses when enabled. `SpatialDeviceAdapterRuntime` updates its feature flags only from `XRSession.enabledFeatures`; mode support alone does not imply optional XR capabilities. Webcam tracking remains the non-XR fallback.

Metric XR coordinates are intentionally not mixed with normalized DOM interaction coordinates until a dedicated projection/calibration layer is present.


### Spatial v15 XR projection bridge

`SpatialXRProjectionRuntime` maps metric XR-space points into DOM-normalized interaction coordinates using each frame's `XRView.transform.inverse.matrix` and `XRView.projectionMatrix`. Stereo projections are combined conservatively and a session-local calibration can recenter DOM overlay alignment from the viewer-ray hit-test. The resulting normalized point enters the existing `SpatialUIController`, preserving one focus/pinch state machine across webcam and WebXR input.

Metric XR depth remains distinct from webcam-relative depth. v15 uses XR metric data for projection and preserves the metric camera-space depth value without pretending the two depth models are interchangeable.


### Human Hand Interaction architecture

Mira now separates the hand-control stack into four boundaries:

1. **Sensor geometry** — MediaPipe normalized/world-shape landmarks or metric WebXR joints.
2. **Kinematics** — `SpatialHandKinematicsTracker` normalizes hand scale and derives palm/finger geometry, pinch, velocity and stability.
3. **Contact** — `SpatialHandContactRuntime` performs conservative multi-finger target-volume contact with dwell and an interaction-only pressure proxy.
4. **Intent** — `SpatialHandIntentRuntime` interprets temporal point/touch/press/grab/drag/release/push/pull/swipe/rotation semantics without automatically mapping arbitrary gestures to actions.

Webcam normalized coordinates and WebXR metric coordinates are never merged as if they had the same unit system. `bridgeXRHandTo21()` only normalizes topology; metric values stay metric. The App layer separately projects XR joints into DOM coordinates for target interaction.

The depth-aware hand overlay is a presentation layer over relative Z/interaction state. It does not assert reconstructed skin geometry, physical force, or verified physical touch.

All kinematics, contact, intent, XR hand bridge state and contact pressure remain ephemeral and outside long-term memory.

### Spatial v16 real-surface bridge

`SpatialWebXRSessionRuntime` now exposes bounded CPU depth samples and tracked XR anchors in addition to hands, viewer matrices and hit-test pose. `SpatialXRSurfaceRuntime` turns the sparse metric depth lattice into short-lived interaction patches and compares projected metric hand/object depth against environment depth for near/contact/occlusion classification.

Real-world placement uses `XRHitTestResult.createAnchor()`; tracked `anchorSpace` poses are reprojected into the DOM overlay each frame so browser-spatial objects visually remain attached to their real location as the viewer moves.

The system intentionally keeps three boundaries distinct:

- **metric XR environment state**: depth, hit-test and anchor poses;
- **DOM projection state**: normalized screen location used by browser controls;
- **webcam-relative state**: monocular normalized depth with no metric claim.

Persistent anchor handles may be requested from the XR system but are not automatically stored in browser persistence. Depth grids, real-surface patches, probes and anchor handles remain ephemeral by default.

### Spatial v17 metric manipulation boundary

`SpatialXRMetricManipulationRuntime` is the explicit unit boundary between metric XR depth and normalized browser-spatial object state. XR hand depth, real-surface depth and clearance remain in meters inside this runtime. It emits only a bounded `normalizedDepthDelta` plus a temporary visual perspective scale for the App layer.

This prevents the normalized `SpatialObjectRuntime` from becoming mixed-unit state while still enabling real metric Z manipulation, surface collision constraints and anchored perspective cues.

### Spatial v16 real-surface boundary

The real-device path now adds `SpatialXRSurfaceRuntime` above the WebXR depth/anchor APIs. The WebXR bridge samples bounded CPU depth using `XRFrame.getDepthInformation(view)` / `getDepthInMeters()`, tracks optional real anchors created from hit-test results, and exposes anchor poses from `anchorSpace`.

Depth samples and anchor poses remain metric XR data. The App layer projects them into DOM coordinates only for presentation/interaction; the data is not rewritten into webcam-relative depth units.

Real-surface contact, sparse surface patches, occlusion state, tracked anchors and persistent-handle metadata are session-only and must not enter long-term personal memory.

### Spatial v18 metric bimanual transform

Two-hand WebXR manipulation now has a dedicated `SpatialXRBimanualRuntime`. It consumes only real metric XR joint coordinates and derives pair-center translation, scale and bounded yaw/pitch/roll interaction deltas from two simultaneous pinch poses.

The runtime intentionally stays beside, not inside, `SpatialObjectRuntime`: metric center deltas remain metric and session-local, while only bounded presentation transforms are applied to the DOM spatial layer. One-hand X/Y dragging and v17 metric Z/surface constraints remain authoritative for object translation.

This separation keeps the normalized browser world graph, snapping and physics free from mixed-unit state while enabling a 3-axis two-hand manipulation cue in immersive XR.

### Spatial v19 XR window boundary

Camera and Result windows now participate in the immersive XR interaction stack. Their primary-hand path uses projected XR X/Y plus `SpatialXRMetricManipulationRuntime` for bounded metric Z, while `SpatialXRBimanualRuntime` supplies two-hand scale and yaw/pitch/roll presentation transforms.

Real WebXR anchors may be created for `window.camera` and `window.result` after a valid near-surface release. Tracked metric anchor poses are reprojected into the DOM overlay each frame and drive window position plus perspective depth scale.

The architecture keeps three coordinate domains separate:

1. metric XR hand/depth/anchor coordinates;
2. normalized/browser interaction state used by Mira's existing world model;
3. pixel/CSS presentation transforms for DOM windows.

Metric XR window state remains session-only and is not written into durable memory or browser persistence.

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
- deploy-artifact smoke check;
- GitHub Pages artifact smoke check before publish;
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
