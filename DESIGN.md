# DESIGN.md — Hợp đồng thương hiệu Mira

> Nguồn chân lý cho diện mạo & cảm giác của **Mira** (trợ lý giọng nói 3D) và là chuẩn để
> **Soi** audit giao diện đối chiếu. Mọi UI/asset mới phải tuân theo file này.
> Token sống trong `src/ui/styles.css` (`:root` + `[data-theme]`); file này diễn giải *ý đồ*.

## 1. Bản sắc

Mira là **hologram anime phát sáng** trong không gian tối, tối giản, công nghệ cao nhưng ấm áp.
Tinh thần: *điềm tĩnh, tập trung, voice-first* — giao diện nhường chỗ cho nhân vật + giọng nói.
Tham chiếu cảm giác: chế độ voice của Grok (orb sống động) × VTuber hologram.

## 2. Tính cách & giọng văn

- Xưng **"em"**, gọi người dùng **"anh"** (hoặc "chị" nếu rõ). Thân thiện, gọn, tự nhiên.
- **Voice-first:** câu trả lời để ĐỌC LÊN → rất ngắn (1–3 câu), không markdown/emoji/ký tự lạ,
  đọc số thành chữ ("ba lỗi" không phải "3 lỗi"). Từ đệm nhẹ: dạ, nhé, ạ, à — đúng chỗ, không máy móc.
- Không tự xưng là AI/mô hình trừ khi được hỏi thẳng.
- Tiếng Việt là ngôn ngữ chính của sản phẩm.

## 3. Màu (4 theme — token CSS)

Nền tối sâu, một màu **accent** phát sáng + **accent2** bổ trợ. Đổi theme nhuộm cả hologram.

| Theme | --accent | --accent2 | Khí chất |
|---|---|---|---|
| **nova** (mặc định) | `#38E1FF` lam điện | `#B66BFF` tím | mặc định, tương lai |
| **aura** | `#9A7BFF` tím | `#5FE7C4` ngọc | dịu, mơ |
| **ember** | `#2FD9C9` xanh ngọc | `#FFB23E` hổ phách | ấm, năng lượng |
| **iris** | `#7C8CFF` chàm | `#C9B6FF` oải hương | êm, thanh |

Token dùng chung: `--bg`/`--bg2` (nền gradient), `--text` `#eaf2ff`, `--dim` `#8b97c4`,
`--faint` `#56608c`, `--warn` `#ff7a9c` (lỗi/ngắt lời), `--glass` (nền kính), `--stroke` (viền kính).
**Quy tắc:** không hardcode màu — luôn dùng `var(--…)` + `color-mix(... var(--accent) …)` để theo theme.

## 4. Typography

- **Be Vietnam Pro** (700–800): wordmark, tiêu đề. Có dấu tiếng Việt đẹp.
- **Inter** (400–600): body, nút, UI.
- **JetBrains Mono** (400–500): telemetry, nhãn trạng thái, số liệu (chữ HOA, letter-spacing rộng).

## 5. Avatar & Orb (sân khấu trung tâm)

- **Avatar VRM hologram** (mặc định): trong suốt phát sáng theo `--accent`, váy trắng, da sáng, môi hồng;
  nhìn theo chuột/đầu thật, chớp mắt, thở, mood. Fallback ảnh 2D khi WebGL/VRM lỗi.
- **Orb** (chế độ thay th, nút 🔮): cầu shader fresnel + simplex-noise, hai tông (lõi accent2 → rìa accent),
  additive glow — kiểu voice-orb của Grok.
- **Hào quang**: halo + 4 vòng sàn xoay + footglow dưới chân, nhuộm theo accent.

## 6. Chuyển động (nguyên tắc cốt lõi)

- **Phản ứng theo ÂM THANH THẬT** (AnalyserNode), không sóng giả: orb mic, waveform, footglow nảy
  theo giọng Mira (TTS) và giọng người dùng (mic). Đây là "linh hồn" của trải nghiệm — luôn ưu tiên.
- **Theo trạng thái**: idle · listening · thinking · speaking · interrupted · error — mỗi trạng thái có
  nhịp/sắc riêng (xem `body[data-state]`). interrupted/error → chuyển `--warn`.
- Tôn trọng `prefers-reduced-motion` (tắt animation).

## 7. UI — nguyên tắc

- **Tối giản kiểu Grok:** sân khấu (avatar/orb) + caption + orb mic + nút "Trò chuyện trực tiếp" là
  trung tâm; công cụ phụ (debug, theme) ẩn sau nút **⋯**.
- **Nút mic = orb thuỷ tinh** phát sáng, nảy theo âm (không phải nút phẳng).
- Kính mờ: `--glass` + `--stroke` + `backdrop-filter`. Bo góc lớn (9–16px). Glow bằng `box-shadow` accent.
- **Mobile/iPhone:** layout `position: fixed; inset: 0` (ổn với thanh công cụ iOS); tôn trọng safe-area
  (notch/home-indicator); ẩn telemetry & phụ trợ ở màn hẹp; chạm là hành vi chính.

## 8. Khả dụng (a11y)

- Tương phản chữ ≥ AA trên nền tối. `:focus-visible` viền `--accent`.
- `aria-live` cho caption; nhãn `aria-label` tiếng Việt cho nút.
- Mọi tính năng giọng nói có lối thoát không cần mic (đang bổ sung ô nhập text).

## 9. Không làm

- ❌ Hoán mặt/deepfake người thật lên avatar (mạo danh — dùng VRM/orb thay thế).
- ❌ Màu hardcode ngoài hệ token. ❌ Emoji/markdown trong văn bản ĐỌC.
- ❌ Animation gắt khi `prefers-reduced-motion`. ❌ Chữ < 11px cho nội dung đọc.
