# Implementation Plan: Mira Live — hội thoại thời gian thực + lớp hiện diện 3D

> Định dạng theo ECC `planner` (everything-claude-code). Bản đồ code: `graphify-out/GRAPH_REPORT.md`
> (3.476 node · 7.826 cạnh, commit nền `9ed040a`). Báo cáo đánh giá chuyên gia ngày 23/10/2026 là đầu vào.

## Overview

Mira bỏ hướng nhúng vào Soi và tập trung làm một companion giọng nói độc lập. Thêm chế độ **Live**:
giọng người dùng đi thẳng tới mô hình speech-to-speech (Gemini Live API) qua WebSocket, âm thanh trả về
phát ngay và điều khiển khẩu hình của lớp hiện diện (2D photoreal hiện tại, avatar 3D khi đã được duyệt).
Cùng đợt này xử lý các P0 có thể làm bằng code từ báo cáo: health báo sai, `/api/chat` nhận system prompt
tùy ý, thiếu xử lý khủng hoảng, thiếu cổng 18+, cảnh mặc định nhạy cảm, và các lỗi UI lệch DESIGN.md.

## Requirements

- Live: người dùng nói, Mira trả lời bằng giọng trong một phiên song công; nói chen (barge-in) dừng ngay audio.
- API key không bao giờ ra trình duyệt: server phát **ephemeral token** dùng 1 lần, khóa model + system instruction.
- System instruction do server dựng (persona whitelisted + lớp an toàn); client chỉ gửi ID persona và ngữ cảnh ký ức giới hạn.
- Lip-sync: âm thanh Live đi qua `AnalyserNode` và cập nhật `audioLevel`/`ttsLevel` — cùng nguồn mà `PhotorealMira`, `RoomMiraVRM`, `OriginalMiraLabAvatar` đang đọc.
- Transcript hai chiều vào lịch sử + Memory như hội thoại thường.
- Không vượt Hobby plan: tối đa 12 Serverless Function → token endpoint dùng chung `api/chat.js` (`?route=live-token`).
- Giữ nguyên cổng `check:avatar-release` và manifest `status=pending` (AGENTS.md quy tắc 4, 7).
- Bundle: initial ≤ 150 KiB, AppV2 graph ≤ 300 KiB (hiện 299,9) → engine Live phải lazy-load.

## Architecture Changes

- `lib/crisis-safety.js` (+ `.d.ts`): nhận diện rủi ro tự hại tiếng Việt, phản hồi an toàn, danh bạ hỗ trợ, chính sách an toàn server.
- `lib/live-token.js`: dựng system instruction, gọi `POST /v1beta/auth_tokens`, trả token + model; quota lane `live`.
- `lib/ai-quota.js`: thêm lane `live`.
- `api/chat.js`: dispatch `route=live-token`; bắt buộc header Origin; tiền tố chính sách an toàn server; chặn sớm thông điệp khủng hoảng.
- `api/brain-health.js`: `ok=false` khi không có model khả dụng.
- `src/core/live/live-protocol.ts`: PCM16 encode/decode, base64, downsample, parse server message (thuần, test được bằng Node).
- `src/core/live/live-session.ts`: WebSocket + AudioWorklet mic 16 kHz + phát 24 kHz + analyser + barge-in + session resumption.
- `src/core/live/useLiveConversation.ts`: hook nhỏ, `import()` động `live-session` khi người dùng bấm Live.
- `src/core/useMira.ts`: thêm `recordTurn()` và `recallContext()` để Live ghi lịch sử/ký ức.
- `src/app/AppV2.tsx`: dọn header (camera/XR/chân dung/đổi màu vào Cài đặt), nút Live, ô nhập văn bản, banner hỗ trợ khủng hoảng.
- `src/settings/SettingsPanel.tsx` + `src/core/voice-prefs.ts`: cổng xác nhận 18+ cho persona `partner` và cảnh thân mật.
- `src/presence/presence-scene.ts`: cảnh `welcome-home`/`bedtime` chỉ khi bật cảnh thân mật.
- `src/presence/PhotorealMira.tsx` + CSS: Việt hóa nhãn trạng thái, sửa pill chồng nhau trên mobile.

## Implementation Steps

### Phase 1: An toàn & server (4 file)
1. **Crisis safety module** (File: lib/crisis-safety.js)
   - Action: `detectCrisis(text)`, `CRISIS_RESOURCES`, `crisisReplyVi()`, `SAFETY_POLICY_VI`
   - Why: P0-5 — companion cảm xúc phải có đường an toàn cố định, không phụ thuộc model
   - Dependencies: None
   - Risk: Medium — false negative với cách nói gián tiếp; dùng danh sách cụm từ + chuẩn hóa dấu
2. **Chat hardening** (File: api/chat.js)
   - Action: Origin bắt buộc (trừ Tauri), chính sách server đứng trước system client, chặn sớm khủng hoảng
   - Why: P0-3 — giảm lạm dụng proxy mở và prompt injection qua `system`
   - Dependencies: Step 1
   - Risk: Medium — script smoke không gửi Origin → cập nhật script
3. **Live token** (File: lib/live-token.js, lib/ai-quota.js)
   - Action: ephemeral token 1 lần, hết hạn 30 phút, phiên mới trong 1 phút, `liveConnectConstraints` khóa model + system
   - Why: Không lộ GEMINI_API_KEY, server làm chủ prompt
   - Dependencies: Step 1
   - Risk: High — chưa gọi thật được từ sandbox; test bằng fetch giả lập, xác minh sau deploy
4. **Honest health** (File: api/brain-health.js)
   - Action: `ok` = có provider và (không free-only hoặc router có ≥1 model)
   - Why: P0-2
   - Dependencies: None
   - Risk: Low

### Phase 2: Live engine (3 file)
5. **Protocol utilities** (File: src/core/live/live-protocol.ts)
   - Action: float→PCM16, downsample tuyến tính, base64 hai chiều, `parseServerMessage`
   - Why: Phần thuần, test được không cần trình duyệt
   - Dependencies: None
   - Risk: Low
6. **Live session** (File: src/core/live/live-session.ts)
   - Action: kết nối, setup, stream mic (AudioWorklet, fallback ScriptProcessor), lịch phát, `interrupted` → dừng nguồn, `goAway` → resume
   - Why: Lõi realtime
   - Dependencies: Step 3, 5
   - Risk: High — AEC/echo trên loa ngoài; dùng `echoCancellation` + không phát mic ra loa
7. **Hook** (File: src/core/live/useLiveConversation.ts)
   - Action: state/caption/who, lazy import, ghi turn qua `recordTurn`
   - Why: Giữ AppV2 dưới ngân sách
   - Dependencies: Step 6
   - Risk: Medium

### Phase 3: UI & presence (5 file)
8. **App shell** (File: src/app/AppV2.tsx) — nút Live, ô nhập văn bản, header gọn, banner khủng hoảng. Risk: Medium (test regex nguồn cần cập nhật)
9. **Settings** (File: src/settings/SettingsPanel.tsx) — camera, chân dung, giao diện, cổng 18+. Risk: Low
10. **Scenes** (File: src/presence/presence-scene.ts) — cảnh thân mật opt-in. Risk: Low
11. **Photoreal labels** (File: src/presence/PhotorealMira.tsx, photoreal-mira.css) — Việt hóa, sửa chồng lấn. Risk: Low
12. **Lip-sync wiring** — Live playback cập nhật `audioLevel`/`ttsLevel`; avatar 3D không đổi hình học. Risk: Low

### Phase 4: Kiểm chứng & tài liệu
13. Test hành vi mới: `scripts/crisis-safety.test.mjs`, `scripts/live-token.test.mjs`, `scripts/live-protocol.test.mjs`
14. Chạy `tsc`, `npm test`, `check:architecture`, build, `check:bundle`; chụp màn hình trước/sau (Chromium headless)
15. Cập nhật `SECURITY.md`, `README.md`, `DESIGN.md`; `graphify update .`; push `main`

## Testing Strategy
- Unit tests: `lib/crisis-safety.js` (cụm từ có/không dấu, câu trung tính), `lib/live-token.js` (thiếu key → 503, persona không hợp lệ → mặc định, partner không xác nhận 18+ → hạ cấp, body gửi Google đúng hình dạng, không trả key), `live-protocol.ts` (PCM round-trip, downsample độ dài, parse các loại message)
- Integration tests: `api/chat.js` thiếu Origin → 403; thông điệp khủng hoảng → phản hồi an toàn không gọi provider
- E2E tests: Chromium — màn chính có ô nhập văn bản, nút Live, không còn nút camera trên header, mobile không chồng pill

## Risks & Mitigations
- **Risk**: Tên model Live đổi theo thời gian
  - Mitigation: `MIRA_LIVE_MODEL` env, mặc định theo tài liệu hiện hành (`gemini-3.8-live`)
- **Risk**: Chi phí Gemini Live trên key trả phí
  - Mitigation: quota lane `live` 6 phiên/10 phút/IP, 150 toàn cục; token 1 lần; phiên tối đa 30 phút
- **Risk**: Chưa có avatar 3D được duyệt quyền → production vẫn hiển thị 2D
  - Mitigation: không bypass cổng; Live điều khiển khẩu hình 3D ngay khi manifest chuyển `approved`; `?room3d=1` để QA
- **Risk**: Hàng nghìn assert regex trên mã nguồn sẽ đỏ khi đổi AppV2
  - Mitigation: cập nhật test theo hành vi mới, ghi rõ trong commit

## Success Criteria

Trạng thái sau triển khai (bằng chứng: [`MIRA-LIVE-QA-2026-10-23.md`](../MIRA-LIVE-QA-2026-10-23.md)).

- [x] `/api/chat?route=live-token`: 503 khi thiếu key, 403 khi thiếu Origin (test handler thật); trả token khi có key (test với fetch giả lập)
- [ ] Phiên Live thật: nói → nghe trả lời bằng giọng; nói chen dừng audio — **cần kiểm trên production sau deploy**
- [x] Transcript Live đi qua `recordTurn` → lịch sử + Memory (lượt khủng hoảng không lưu)
- [x] Câu có ý định tự hại luôn nhận phản hồi an toàn + số hỗ trợ, kể cả khi Brain lỗi (đã chạy trên Chromium)
- [x] Persona `partner` và cảnh thân mật cần xác nhận 18+
- [x] `brain-health.ok=false` khi catalogue mới và `available=0`; catalogue chưa tải báo `configured_unverified`
- [x] Màn chính có ô nhập văn bản; header chỉ còn thương hiệu, trạng thái, cài đặt
- [x] `tsc` 0 lỗi, toàn bộ test xanh, initial 141,2 KiB, AppV2 graph 299,6 KiB
- [x] Không thay đổi `public/avatars/realistic/manifest.json` (vẫn `pending`)
