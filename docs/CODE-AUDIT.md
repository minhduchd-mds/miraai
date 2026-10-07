# Mira — Expert Code Audit

> Snapshot: `5109830` · audit tập trung vào correctness, maintainability, dead-code hygiene, runtime weight và release safety.

## Tổng quan

| Hạng mục | Điểm | Nhận định |
|---|---:|---|
| Architecture boundaries | **9/10** | Vision/WebXR/spatial orchestration đã tách khỏi AppV2; component chính chủ yếu còn composition + state wiring |
| Runtime safety | **8.5/10** | Permission gate, memory boundary, TTS health/circuit breaker và fail-safe khá tốt |
| CI/CD | **9/10** | Node 24 + 26, typecheck, tests, benchmark, bundle/artifact/dependency gates |
| Bundle/performance | **8.5/10** | Finance lazy-load; production media prune; initial budget đang xanh |
| Code organization | **8.5/10** | `AppV2.tsx` đã giảm mạnh; runtime nặng nằm ở các boundary chuyên trách |
| Dead-code hygiene | **8.5/10** | TTS legacy/Python backend/UI orphan đã loại; architecture guard khóa regression |
| Desktop hardening | **8.5/10** | Hardened runtime + optional Authenticode/Developer ID/notarization workflows đã có; trạng thái signed thật phụ thuộc release secrets |
| Testability | **8.5/10** | Runtime/helper có contract tests; AppV2 coupling lớn đã được gỡ đáng kể |

**Đánh giá tổng thể: 8.9/10 — runtime boundaries, TTS gateway policy và desktop release hardening đã rõ; phần còn lại chủ yếu là release credential validation và real-device matrix.**

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
- Deferred AppV2 graph: **298.1 KiB JS**, dưới budget 300 KiB sau khi lazy-load Face/Hand/Spatial overlays.

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

## P0 — validation status

Current code validation đã có GitHub Actions thực tế:
- CI run `37598973647` tại commit `4a1677ab`: **SUCCESS** ✅
- Node 24 + Node 26: architecture/skill guards, `tsc --noEmit`, runtime tests, functional benchmark, camera trace benchmark, media budget, Vite build, bundle budget, deploy-artifact smoke và critical dependency audit đều **PASS** ✅
- Runtime tests: **344 tests**, không còn stale XR/selection ownership assertion.
- Initial bundle: **140.9 KiB JS + 9.9 KiB CSS**.
- Deferred AppV2 graph: **298.1 KiB JS / budget 300 KiB**.
- Visual QA run `37598941529`: **SUCCESS** trên 5 viewport profiles ✅
- GitHub Pages build cho commit `4a1677ab`: **SUCCESS** ✅

Production Vercel đã có build **READY** trong chuỗi TTS/runtime mới và runtime error scan gần nhất: **0 lỗi**. Vercel HEAD mới hơn vẫn có thể bị daily build-rate-limit; không đồng nhất CI success với production deployment nếu Vercel chưa build đúng SHA.

## P1 — refactor cần làm có kiểm soát

### 1. Tách `AppV2.tsx`

Hiện tại:

- **942 dòng**
- **~37.9 KB source**
- Vision 120ms frame loop đã nằm trong `useVisionSpatialRuntime`
- WebXR projection/manipulation/anchors/rigid-body loop đã nằm trong `useWebXRSpatialRuntime`

AppV2 hiện chủ yếu là composition root + session state/ref wiring; không còn là nơi thực thi trực tiếp sensor frame hay XR physics loop.

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

Runtime orchestration đã tách khỏi AppV2. Bước tối ưu tiếp theo chỉ còn là **performance hardening**: cân nhắc lazy-load sâu hơn theo camera/XR capability nếu bundle measurement cho thấy cần thiết. Đây không còn là blocker kiến trúc.

### 3. Gateway/shared policy — hoàn tất

Vercel/Render/Neon hiện dùng cùng `server/tts-contract.mjs` cho:
- ElevenLabs v4 Text-to-Dialogue;
- voice/model/output format cố định phía server;
- giới hạn 2.000 ký tự;
- CORS own-origin/Tauri/allowlist;
- rate limit 48 request / 5 phút / client với tối đa 2.048 bucket;
- health metadata thống nhất.

Architecture/runtime guards khóa các gateway không quay lại `text-to-speech`, `eleven_multilingual_v2` hoặc policy cục bộ lệch nhau.

## P2 — release/product hardening

- Windows workflow đã **Authenticode-ready**: có PFX secret thì import/sign/verify; thiếu secret vẫn build và báo unsigned.
- macOS workflow đã **Developer ID/notarization-ready**: có Apple certificate thì ký, có đủ Apple credentials thì bắt buộc stapling validation.
- Việc còn lại cho desktop release là cung cấp credential thật và xác nhận artifact signed/notarized trên runner.
- Tách Labs khỏi production installer nếu sau này không cần ship 3D research assets.
- Structured Memory Graph inspector/edit + capsule portability + bounded derived-link pruning đã hoàn tất.
- Còn lại: local semantic embedding model thật cho Desktop recall; không dùng feature-hash rồi gắn nhãn embedding.
- Device Check read-only + Device Lab contract/capture CLI/matrix đã có; còn **thu thập kết quả thực nghiệm thật** trên nhiều thiết bị.

### Structured Memory Graph

Mira Desktop hiện có inspector/edit UI, Tauri commands để list/update/delete node, bounded graph (24 link/node; semantic link yếu quá 45 ngày được dọn), và Identity Capsule merge-only portability tối đa 240 node / 600 link. Không tự xoá structured-memory node trong maintenance.

### Real-device preflight

`src/runtime/device-diagnostics.ts` + Settings Device Check đọc secure context, camera/mic permission state, immersive-AR, WebGPU/WebNN và product mode mà không gọi `getUserMedia()`. Sau đó `src/runtime/device-lab.ts` + `device:lab:capture` + `device:lab:matrix` ghi nhận observation thật theo schema v1 và tổng hợp PASS/WARN/FAIL. Cả hai lớp đều dùng allow-list, không lưu camera/audio/transcript/user-agent/device ID/vị trí.

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
- `src/app/spatial-window-bimanual.ts` — two-hand window scale/rotate lifecycle;
- `src/app/spatial-object-bimanual.ts` — two-hand object/joint/group scale, rotate, translate;
- `src/app/spatial-object-world-step.ts` — webcam inertia, collision, auto-stack, attachment follow và auto-snap world step;
- `src/app/useWebXRSpatialRuntime.ts` — XR hand projection, surface/contact, anchor sync, window/object manipulation và rigid-body/collision RAF loop;
- `src/app/useVisionSpatialRuntime.ts` — complete 120ms Vision frame orchestration: perception → hand/spatial → social/world context → affect → face control.

Kết quả hiện tại: `AppV2.tsx` còn khoảng **942 dòng / 37.9 KB source**, giảm từ 2,873 dòng ban đầu. Không còn sensor/XR frame loop lớn nằm trực tiếp trong component.

> Validation note: source-contract/architecture guards đã cập nhật cho boundary mới. Commit code `4a1677ab` đã pass full CI Node 24/26 và Visual QA; Vercel deployment vẫn được đánh giá riêng vì daily build-rate-limit có thể chặn HEAD.
