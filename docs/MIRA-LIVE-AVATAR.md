# Mira LiveAvatar — gương mặt nói chuyện thời gian thực (v1, 24/10/2026)

LiveAvatar là lớp hiện diện mặc định: một chân dung gốc có hồ sơ ([`MIRA-LIVE-AVATAR-FACE-PROVENANCE.md`](MIRA-LIVE-AVATAR-FACE-PROVENANCE.md))
được biến dạng trên GPU mỗi khung hình, như một người dẫn đang livestream. Cùng hướng với HeyGen LiveAvatar
(audio → video mặt người), nhưng chạy hoàn toàn trong trình duyệt: không phí theo phút, không gửi hình đi đâu.

## Kiến trúc

```
Gemini Live / ElevenLabs audio ──► AnalyserNode ──► ttsLevel {value, bands}
                                                        │
conversation state ──► AvatarMotion (motion.ts) ──► FaceParams (jaw, round, spread, smile,
                         blink · gaze · head · breath    blink, gaze, brow, yaw/pitch/roll, breath)
                                                        │
rig.json (582 đỉnh) ──► deformRig (rig-deform.ts) ──► LiveAvatarRenderer (WebGL1, 2 pass)
                                                        └► canvas phủ sân khấu; ảnh tĩnh làm nền/fallback
```

| File | Vai trò |
| --- | --- |
| `scripts/live-avatar/build-rig.py` | Offline: MediaPipe Face Mesh 478 điểm + halo + viền, Delaunay, topology môi tường minh |
| `src/presence/live-avatar/rig-deform.ts` | Biến dạng thuần (test bằng Node): miệng dạng thấu kính, chớp mắt đơn điệu, ánh mắt, đầu có parallax theo độ sâu |
| `src/presence/live-avatar/motion.ts` | Hành vi: khẩu hình chỉ theo giọng Mira, chớp mắt 2,2–5,8 s, liếc mắt, gật theo năng lượng giọng, nghiêng đầu khi nghe |
| `src/presence/live-avatar/live-avatar-gl.ts` | Renderer: khoang miệng (răng/lưỡi thủ tục) rồi lớp da; màn rộng hiển thị khung dọc kiểu livestream |
| `src/presence/live-avatar/LiveAvatarPresence.tsx` | Component lazy; badge LIVE khi gọi Live; nhãn "Nhân vật AI" luôn hiện |
| `scripts/live-avatar/qa.html` | Harness dev (vite dev) để chụp tư thế cố định |

Chọn kiểu hiện diện: Cài đặt → Giao diện → "Mira LiveAvatar". Các URL QA (`visual-test`, `room3d`, `humanLab`…) tự dùng ảnh cảnh cũ.

## Vòng kiểm thử (AGENTS.md: test → ảnh → BA → sửa → test lại)

Chromium headless (SwiftShader), harness `qa.html`, desktop 1280×800 và mobile 390×844.

| # | Phát hiện (Test 1) | Mức | Sửa | Test 2 |
| --- | --- | --- | --- | --- |
| 1 | Mở miệng rách thành răng cưa, lỗ đen khi ngậm (Delaunay quanh môi gần thẳng hàng) | P0 | Dựng lại vùng môi bằng dải môi trên/dưới + dải khoang miệng; kiểm tra phủ kín 1,00002 | Đạt |
| 2 | Khoang miệng hình hộp, mép miệng mở thẳng đứng | P1 | Biên độ dạng thấu kính `1 − 0,92·d²`, da cạnh mép thuôn theo | Đạt |
| 3 | Dải răng trắng gắt | P2 | Răng ngà, bóng môi trên, khe răng mờ | Cải thiện, còn mức "thủ tục" |
| 4 | Tư thế "o" lộ khe đen ở khóe | P1 | Da má cạnh khóe đi theo khi chu/kéo môi | Đạt |
| 5 | Tam giác góc môi trái lật khi há (test tự động) | P1 | Chia tứ giác góc theo điểm môi ngoài | Đạt |
| 6 | Chớp mắt + liếc gây 18 tam giác lật | P1 | Chớp = ép dọc đơn điệu theo cột (không thể lật); giới hạn biên độ liếc | Đạt (0 lật) |
| 7 | Màn ngang cắt mặt quá to | P2 | Khung dọc vừa chiều cao + nền mờ hai bên | Đạt |
| 8 | Mobile: nhãn "Nhân vật AI" sát pill trạng thái | P2 | Dời nhãn sang trái, dưới header | Đạt |

Test tự động `scripts/live-avatar.test.mjs` (10 test) khóa: rig hợp lệ, tư thế trung tính = ảnh gốc, miệng thấu kính,
chớp mắt khép mi, chu/kéo môi, **0 tam giác lật ở 9 tư thế cực đại**, viseme, miệng không cử động khi không nói,
nhịp chớp tự nhiên, reduced-motion, ngân sách ảnh ≤ 180 KiB.

## Giới hạn hiện tại (trung thực)

- Đây là biến dạng 2,5D từ một ảnh: đầu xoay tối đa vài độ, không quay nghiêng hẳn; răng/lưỡi là shader thủ tục.
  Chất lượng thấp hơn mô hình diffusion/neural (HeyGen, MuseTalk). Có thể thay renderer bằng backend GPU sau,
  giữ nguyên `FaceParams`/`ttsLevel`.
- Khẩu hình theo năng lượng/dải tần, không theo âm vị tiếng Việt chính xác.
- Ảnh mặt ở trạng thái `review_required` cho tới khi có người ký duyệt quyền (xem hồ sơ nguồn gốc).
