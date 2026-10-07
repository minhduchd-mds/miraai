# Mira — Expert Code Audit

> Snapshot: `4217073` · audit tập trung vào correctness, maintainability, dead-code hygiene, runtime weight và release safety.

## Tổng quan

| Hạng mục | Điểm | Nhận định |
|---|---:|---|
| Architecture boundaries | **8/10** | Runtime/Memory/Skills/Host đã tách tương đối rõ; AppV2 còn quá nhiều orchestration |
| Runtime safety | **8.5/10** | Permission gate, memory boundary, TTS health/circuit breaker và fail-safe khá tốt |
| CI/CD | **9/10** | Node 24 + 26, typecheck, tests, benchmark, bundle/artifact/dependency gates |
| Bundle/performance | **8.5/10** | Finance lazy-load; production media prune; initial budget đang xanh |
| Code organization | **6.5/10** | `AppV2.tsx` là monolith lớn nhất |
| Dead-code hygiene | **8.5/10** | TTS legacy/Python backend/UI orphan đã loại; architecture guard khóa regression |
| Desktop hardening | **7/10** | Local-first tốt; release signing/notarization còn thiếu |
| Testability | **8/10** | Nhiều pure runtimes có unit test; AppV2 coupling làm integration test khó hơn |

**Đánh giá tổng thể: 8.1/10 — nền tảng kỹ thuật tốt, technical debt chính nằm ở orchestration/UI monolith chứ không phải dependency rác.**

## Cleanup đã xác minh

### Đã loại bỏ

- TTS adapters đã retire: WebSpeech/Piper/Edge/VieNeu/direct ElevenLabs/Google Translate.
- Python Edge/VieNeu TTS prototype và stale scaffold.
- compatibility state-machine re-export không còn consumer.
- UI prototypes không có consumer: `Composer`, `ConversationHistory`, `VoiceOrb`.
- legacy `public/looks/*.png` và `public/scenes/home.png|office.png`.
- legacy browser TTS endpoint override.
- source/reference media khỏi production `dist`.

### Tác động đo được

- UI/legacy file removal: **17.18 MiB** khỏi current checkout.
- Runtime artifact pruning: **123.89 MiB → 84.16 MiB**, giảm **39.73 MiB**.
- Initial bundle: **140.9 KiB JS + 9.9 KiB CSS**.
- Deferred AppV2 graph: **292.2 KiB JS**, dưới budget 300 KiB.

## Phần cố tình giữ

| Thành phần | Lý do giữ |
|---|---|
| MediaPipe | Vision runtime dùng thật và phần nặng được lazy-load |
| Three / R3F / VRM | Labs/3D vẫn reachable |
| Gaussian Splat | Labs vẫn có viewer thực |
| Silero VAD | Voice interruption dùng thật, lazy-load |
| Neon client/config | Memory/server + Neon deployment dùng thật |
| Vision/XR runtimes | Experimental nhưng AppV2/architecture guard vẫn tham chiếu |
| VRM/Splat assets | Desktop Labs còn dùng; Pages đã prune |
| PNG scene/expression source | Source-of-truth trong git; production artifact đã prune |

Không xóa module chỉ vì “experimental”. Điều kiện xóa: **không có consumer runtime + không có deployment contract + không được architecture guard cố ý giữ**.

## P0 — không còn blocker đã biết

Sau cleanup:
- Node 24 CI ✅
- Node 26 compatibility ✅
- TypeScript ✅
- Runtime tests ✅
- Functional/camera benchmark ✅
- Bundle budget ✅
- Deploy artifact smoke ✅
- Critical dependency audit ✅
- GitHub Pages ✅

## P1 — refactor cần làm có kiểm soát

### 1. Tách `AppV2.tsx`

Hiện tại:

- **2,113 dòng**
- **88.4 KB source**
- **50 imports**
- **47 refs**
- **25 effects**
- **18 states**
- **11 callbacks**

Đây là rủi ro maintainability lớn nhất. Không nên tiếp tục nhét thêm Vision/XR/Companion logic trực tiếp vào component.

Target:

```text
AppV2
├─ useVisionRuntime()
├─ useSpatialInteraction()
├─ useWebXRRuntime()
├─ useCompanionSocialContext()
├─ usePresenceSceneLifecycle()
├─ useVoiceSessionLifecycle()
└─ UI composition
```

Refactor phải **không đổi hành vi**, mỗi extraction đi kèm behavior tests và bundle check.

### 2. Sensor capability lazy boundary

Các sensor/XR module đã có nhiều boundary tốt, nhưng AppV2 vẫn static-import nhiều pure orchestration module. Bước sau nên tải capability theo:
- camera enabled;
- hand tracking enabled;
- XR session requested.

Mục tiêu: giảm deferred AppV2 graph mà không phá startup reliability.

### 3. Chuẩn hóa gateway/shared policy

Mira có Vercel/Render/Neon gateway alternatives. Policy CORS/rate-limit/provider metadata nên tiếp tục hội tụ về contract chung để tránh drift giữa deployment targets.

## P2 — release/product hardening

- Authenticode cho Windows.
- Apple Developer ID + notarization cho macOS.
- Tách Labs khỏi production installer nếu sau này không cần ship 3D research assets.
- UI inspect/edit cho structured memory graph.
- Semantic local embeddings + bounded pruning.
- Real-device matrix cho camera/affect/XR.

## Quy tắc cleanup

1. Git tree/blob SHA là nguồn chuẩn khi audit; không dựa vào cache Contents API nếu có mâu thuẫn.
2. Không tăng bundle budget để “làm CI xanh”; ưu tiên lazy-load/prune.
3. Source asset có thể giữ trong git nhưng không được mặc định ship trong production artifact.
4. Không xóa fallback/research path nếu vẫn reachable hoặc có deployment contract.
5. Mỗi đợt cleanup phải giữ Node 24/26 + tests + benchmark + artifact smoke xanh.


## AppV2 refactor progress

Đã tách các boundary ít rủi ro trước, không đổi behavior:

- `src/app/spatial-ui-helpers.ts` — DOM target collection, spatial styles, anchors, joint mapping;
- `src/app/app-preferences.ts` — theme, affect-follow và presence-return persistence;
- `src/app/usePresenceReturnLearning.ts` — minute clock + local learning khi người dùng quay lại;
- `src/app/useVoiceSessionLifecycle.ts` — audio unlock, voice handshake, Space shortcut, resume/focus và background companion lifecycle;
- `src/app/useSpatialDomFeedback.ts` — DOM-only feedback cho focused/selected/contact/press, tách khỏi sensor math và XR runtime;
- `src/app/useAppPresentationState.ts` — theme/affect-follow state, persistence và body dataset sync;
- `src/app/useVisionTransport.ts` — lazy camera runtime import, start/stop, error/boot state và preview stream binding;
- `src/app/useWebXRTransport.ts` — WebXR capability detect, session start/stop và snapshot polling;
- `src/app/useSpatialLayoutLifecycle.ts` — session layout restore/capture và explicit capture trước khi reset Vision;
- `src/app/vision-perception-normalizer.ts` — chuẩn hóa face/posture/rPPG/environment/spatial defaults;
- `src/app/useFaceSocialLifecycle.ts` — face social cue + presence continuity lifecycle;
- `src/app/useFaceHeadControlLifecycle.ts` — debounce/cooldown cho nod/shake voice control;
- `src/app/useVisionWorldContext.ts` — scene graph → object interaction → action sequence → causal graph → short-term world model + prompt context;
- `src/app/useVisionHandInput.ts` — webcam hand normalization + gesture-intent tracking;
- `src/app/vision-hand-interaction.ts` — contact/intent/direct-touch/ray-hit resolver;
- `src/app/spatial-selection-gesture.ts` — Victory/Open Palm selection behavior;
- `src/app/spatial-object-manipulation.ts` — object grab/move/release/cancel lifecycle;
- `src/app/spatial-window-control.ts` — one-hand window grab/move/release lifecycle;
- `src/app/spatial-window-bimanual.ts` — two-hand window scale/rotate lifecycle.

Kết quả hiện tại: `AppV2.tsx` còn khoảng **2,113 dòng / 88.4 KB source**. Các bước tiếp theo phải tiếp tục theo nguyên tắc extraction nhỏ + behavior tests + Node 24/26 + bundle/artifact gates; không refactor sensor loop lớn trong một commit.
