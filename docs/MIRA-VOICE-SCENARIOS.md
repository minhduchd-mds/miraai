# Mira — xử lý tình huống voice (24/10/2026)

Hai đường voice: **Mira Live** (Gemini Live, song công, tự ngắt lời) và **rảnh tay** (nút mic: Web Speech STT →
model → TTS). Bảng dưới là ma trận tình huống, hành vi hiện tại và bằng chứng test.

## Ma trận

| # | Tình huống | Hành vi | Bằng chứng |
| --- | --- | --- | --- |
| 1 | Live: mic gửi audio lên | AudioWorklet nối tới destination qua gain 0 (trước đây không nối nên Chrome không chạy → **không có audio nào tới Gemini**) | E2E S1 |
| 2 | Live: `addModule` treo (không có thiết bị âm thanh, trình duyệt nhúng) | Giới hạn 2,5 s rồi chuyển ScriptProcessor; trước đây kẹt "Đang kết nối…" | E2E S1, unit |
| 3 | Live trên iOS Safari | AudioContext tạo **đồng bộ trong cú chạm** (trước `await`), dùng chung cho thu và phát | unit |
| 4 | Live: server reset kết nối (~10 phút / `goAway`) | Nối lại bằng `sessionResumption.handle`, giữ token còn hạn | E2E S2 |
| 5 | Live: phiên > 30 phút (token hết hạn) | Xin token mới rồi resume (handle có hạn 2 giờ) | E2E S5 |
| 6 | Live: mạng chập chờn | Thử lại 3 lần (0,3 s · 1,2 s · 3 s) rồi báo "Mất kết nối… bấm LIVE để nối lại" | E2E S6 |
| 7 | Live: ẩn tab / khoá màn hình | Gửi `audioStreamEnd`; quay lại thì `resume()` AudioContext | E2E S3 |
| 8 | Live: rút tai nghe / mic bị tắt | Bắt sự kiện `ended` → báo "Mất tín hiệu micro" và dừng | E2E S4 |
| 9 | Live: im lặng 3 phút | Tự dừng, báo cách bật lại (không giữ mic mở vô hạn) | unit |
| 10 | Live: mic bị chặn | Báo rõ, **không tốn token** | E2E S7 |
| 11 | Live: người dùng ngắt lời | Gemini VAD gửi `interrupted` → xoá hàng đợi audio ngay | có sẵn |
| 12 | Rảnh tay: bấm mic | **Không bật camera** (trước đây nút mic tự bật camera, trái với cam kết "chỉ bật khi anh cho phép") | E2E S8 |
| 13 | Rảnh tay: STT lỗi mạng | Thử lại 1 lần sau 1,2 s, rồi báo rõ | unit |
| 14 | Rảnh tay: không có micro / không hỗ trợ tiếng Việt | Thông báo riêng, gợi ý dùng LIVE; caption không kẹt "Đang nghe…" | E2E S9 |
| 15 | Rảnh tay: im lặng kéo dài | Sau 8 lượt nghe rỗng (~1 phút) tự dừng, báo trong caption | unit |
| 16 | Rảnh tay: ẩn tab | Dừng mic, giữ chế độ rảnh tay; quay lại thì nghe tiếp | unit |
| 17 | Rảnh tay: STT trả về toàn tiếng ồn / dấu câu | Bỏ qua, không gửi model ("ừ" vẫn được tính) | unit |
| 18 | Trình duyệt không có Web Speech (Firefox…) | Gợi ý dùng LIVE (chỉ cần mic + WebSocket) | unit |

## Camera nhận diện cảm xúc (opt-in)

| # | Tình huống | Hành vi | Bằng chứng |
| --- | --- | --- | --- |
| 19 | Bật camera | Chỉ từ Cài đặt → Giao diện; nút mic không còn bật camera | E2E S8, camera E2E |
| 20 | Camera đang chạy | Nút camera chấm đỏ luôn hiện trên header, chạm để tắt (video track dừng) | camera E2E |
| 21 | Không tải được model MediaPipe (CDN bị chặn/offline) | Báo "chưa đọc được biểu cảm", trạng thái "Bật · chưa nhận diện được"; trước đây im lặng ghi "Đang quan sát" | camera E2E |
| 22 | Có biểu cảm + bật "Phản ứng" | Cảm xúc đi vào lời nhắc model, tốc độ nói, câu chủ động; LiveAvatar đáp lại nhẹ (vui → cười ấm hơn, buồn/mệt → mày lo lắng, giận → điềm tĩnh, ngạc nhiên → nhướn mày) | unit (live-avatar) |

Giới hạn: nhận diện thật cần tải model từ `cdn.jsdelivr.net` và `storage.googleapis.com`; môi trường test của Claude bị chặn hai host này nên chưa chạy được nhận diện khuôn mặt thật đầu-cuối.

## Chưa làm / khuyến nghị

- **Ngắt lời bằng giọng ở chế độ rảnh tay** cần Silero VAD (mặc định tắt vì phải tải model và dễ tự ngắt khi loa to).
  Để nói chuyện song công tự nhiên, dùng **LIVE**: Gemini xử lý ngắt lời phía server.
- Đánh dấu lượt bị ngắt ("Mira mới nói được đến đây") trong lịch sử gửi model.
- Chưa test trên thiết bị thật: iPhone Safari (âm thanh Live), tai nghe Bluetooth, mạng 4G yếu.

## Test

- Unit/guard: `scripts/voice-scenarios.test.mjs` (trong `npm test`).
- E2E: Chromium thật + mic giả + server giả lập giao thức BidiGenerateContent (S1–S9), chạy 24/10/2026: 9/9 PASS.

Nguồn: [Gemini Live session management](https://ai.google.dev/gemini-api/docs/live-session),
[Gemini Live guide (VAD, audioStreamEnd, interrupted)](https://ai.google.dev/gemini-api/docs/live-guide),
[Ephemeral tokens](https://ai.google.dev/gemini-api/docs/ephemeral-tokens),
[7 voice AI edge cases (Hamming)](https://hamming.ai/blog/7-common-voice-ai-edge-cases-and-how-to-test-them),
[Voice UX: latency, turn-taking, barge-in (Picovoice)](https://picovoice.ai/guide/voice-agents/voice-ux-latency-turn-taking/),
[iOS Web Speech tips](https://lilting.ch/en/articles/ios-webspeech-api-tips).
