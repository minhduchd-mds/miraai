# DESIGN.md — Hợp đồng trải nghiệm Mira V2

> Nguồn chân lý cho diện mạo, hành vi và cảm giác của **Mira — Voice-first AI Companion**.
> UI mới phải ưu tiên cuộc hội thoại; avatar là lớp hiện diện, không phải bản thân sản phẩm.

## 1. Bản sắc

Mira là một người đồng hành AI có giọng nói, trí nhớ và hiện diện trực quan.
Tinh thần: **điềm tĩnh · gần gũi · tập trung · riêng tư · voice-first**.

Mira không được trông như một bảng điều khiển kỹ thuật. Người dùng phải cảm thấy họ đang nói chuyện với một thực thể trợ lý duy nhất, còn model, STT, TTS, camera, debug và provider là hạ tầng phía sau.

Định vị UI V2:

- **Conversation first** — lời nói/caption và trạng thái hội thoại là thông tin chính.
- **Presence second** — VRM/2D tạo cảm giác hiện diện nhưng không cản trở nội dung.
- **Tools last** — cấu hình nâng cao, sensor, simulator và thử nghiệm nằm trong Labs/Developer.

## 2. Tính cách & giọng văn

- Xưng **"em"**, gọi người dùng **"anh"** (hoặc "chị" khi ngữ cảnh rõ).
- Tiếng Việt là ngôn ngữ chính.
- Voice-first: câu trả lời mặc định ngắn, tự nhiên, dễ đọc thành tiếng.
- Tránh markdown/emoji/ký tự lạ trong phần được TTS đọc.
- Không tự xưng là AI/mô hình trừ khi được hỏi trực tiếp.
- Thể hiện sự ấm áp nhưng không giả vờ có cảm xúc/consciousness như con người.

## 3. Màu & theme

Nền tối sâu, một màu accent phát sáng + accent2 bổ trợ. Không hardcode màu trong component; luôn dùng token CSS.

| Theme | `--accent` | `--accent2` | Khí chất |
|---|---:|---:|---|
| **nova** | `#38E1FF` | `#B66BFF` | tương lai, mặc định |
| **aura** | `#9A7BFF` | `#5FE7C4` | dịu, mơ |
| **ember** | `#2FD9C9` | `#FFB23E` | ấm, năng lượng |
| **iris** | `#7C8CFF` | `#C9B6FF` | êm, thanh |

Token chung: `--bg`, `--bg2`, `--text`, `--dim`, `--faint`, `--warn`, `--glass`, `--stroke`.

## 4. Typography

- **Be Vietnam Pro**: thương hiệu, heading.
- **Inter**: body, điều khiển.
- **JetBrains Mono**: telemetry nhỏ, latency, trạng thái kỹ thuật.

Telemetry không được chiếm ưu tiên thị giác trên màn hình chính.

## 5. Presence Layer

Production mặc định hỗ trợ:

1. **VRM 3D** — lip-sync, blink, breathing, mood, look-at.
2. **2D fallback** — khi WebGL/model không sẵn sàng hoặc người dùng chủ động chọn.

Avatar phải được coi là `Presence`, không phải `App`. Sau V2, avatar pack nên được tải theo manifest/lazy-load thay vì buộc toàn bộ asset vào trải nghiệm đầu tiên.

**Không còn Orb trong production core.** Nếu thử nghiệm Orb quay lại, đặt trong `labs/` và không nhập từ entry production.

Gaussian Splat, hand gesture và face/emotion sensing là **Labs/Sensors**. Chúng có thể tồn tại nhưng không hiện trên primary surface.

## 6. Chuyển động

- Motion phản ánh state: `idle · listening · thinking · speaking · interrupted · error`.
- Ưu tiên biên độ âm thanh thật từ mic/TTS khi có nguồn AnalyserNode.
- Barge-in phải phản hồi thị giác ngay khi người dùng ngắt lời.
- Không dùng motion chỉ để trang trí nếu làm chậm phản hồi hội thoại.
- Tôn trọng `prefers-reduced-motion`.

## 7. App Shell V2

Primary surface chỉ gồm:

- Mira brand + trạng thái.
- Presence stage.
- Caption/transcript.
- Mic / hands-free conversation.
- Kết quả trực quan khi skill trả về view.
- Một lối vào Settings/Labs.

Không đặt Camera, Hand, 2D/3D, Splat, provider, API key, state simulator thành nút ngang hàng trên header production.

Legacy/Labs trong giai đoạn migrate được truy cập bằng `?legacy=1` để không làm mất các prototype hiện có.

## 8. Conversation UI

Mọi trạng thái phải có cả tín hiệu màu/chuyển động **và text**:

- Idle → “Sẵn sàng”.
- Listening → “Đang nghe anh”.
- Thinking → “Đang suy nghĩ”.
- Speaking → “Đang trả lời”.
- Interrupted → “Đã ngắt lời”.
- Error → thông báo nguyên nhân và đường thoát.

Voice-first không đồng nghĩa voice-only. Text composer là hạng mục V2 tiếp theo và là fallback bắt buộc khi STT/mic không dùng được.

## 9. Settings & Developer boundary

Settings cho người dùng:

- Voice / speed / conversation mode.
- Personality.
- Appearance.
- Memory & Privacy.
- Integrations.

Developer/Labs:

- Provider/API key BYOK.
- TTS server diagnostics.
- State simulator.
- Camera emotion tracking.
- Hand gesture.
- Gaussian Splat.

Production không yêu cầu người dùng hiểu những khái niệm kỹ thuật trên.

## 10. Privacy

- Mic/camera luôn phải có trạng thái quyền rõ ràng.
- Camera/sensor là opt-in.
- Không lưu raw audio mặc định.
- Memory phải có khả năng xem, chỉnh, quên và xoá.
- API key production phải ở server/secure runtime; localStorage BYOK chỉ là developer mode.

## 11. Accessibility

- Tương phản chữ ≥ WCAG AA.
- `:focus-visible` rõ ràng.
- Caption dùng `aria-live` hợp lý.
- Nút icon phải có `aria-label`/tooltip.
- Không dùng animation/waveform làm tín hiệu trạng thái duy nhất.
- Mobile tôn trọng safe-area và `100dvh`.

## 12. Không làm

- Không đưa prototype/Labs trở lại primary navigation chỉ vì code đã tồn tại.
- Không hardcode provider/model vào UI chính.
- Không biến avatar customization thành luồng chính của sản phẩm.
- Không gọi LLM production trực tiếp từ browser bằng API key người dùng nếu có thể qua gateway.
- Không hoán mặt/deepfake người thật để mạo danh.
- Không thêm feature mới trực tiếp vào `App.tsx` hoặc `useMira.ts` nếu có thể tách domain/runtime/component.
