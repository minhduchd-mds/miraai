# Mira — Trợ lý giọng nói 3D 🎙️✨

> Avatar VRM anime kiểu **hologram**, nói chuyện **tiếng Việt** real-time ngay trên trình duyệt.
> Vertical slice chạy thật bằng **Web Speech API** — không cần API key vẫn dùng được đủ vòng hội thoại.
> Thiết kế để tích hợp vào **Soi** (công cụ audit giao diện) — xem [docs/MIRA-KIEN-TRUC.md](docs/MIRA-KIEN-TRUC.md).

## Tính năng

| | |
|---|---|
| 🧍‍♀️ **Avatar VRM 3D** | three.js + React Three Fiber + `@pixiv/three-vrm`, style hologram phát sáng theo theme, váy trắng + da sáng, môi hồng |
| 🗣️ **Vòng voice đầy đủ** | Mic → STT tiếng Việt → Bộ não → TTS giọng nữ vi-VN, caption partial hiện trực tiếp khi đang nói |
| 🔁 **Trò chuyện trực tiếp** | Bật một lần, nói qua lại liên tục (half-duplex chống echo, tự dừng khi im lặng lâu) — bấm Dừng mới thôi |
| ✋ **Ngắt lời (barge-in)** | Mira đang nói, bấm mic/Space là dừng ngay và nghe tiếp |
| 👄 **Lip-sync + biểu cảm** | Miệng nhép theo lời, chớp mắt, thở, mood (vui/tò mò/suy nghĩ) đổi theo câu trả lời |
| 👀 **Nhìn theo chuột** | Mắt liếc + đầu xoay mượt theo con trỏ (hệ lookAt của VRM) |
| 🧠 **Bộ não cắm được** | Mặc định brain demo (miễn phí); mở **⌘ Developer Console** dán API key Claude/OpenAI là chạy LLM thật ngay, không cần reload |
| 🎨 **4 theme** | Nova / Aura / Ember / Iris — hologram avatar nhuộm màu theo theme |
| 🩹 **Fallback 2D** | Máy không có WebGL hoặc VRM đang tải → tự hiện ảnh 2D, không vỡ app |

## Chạy

```bash
npm install
npm run dev
```

Mở **http://localhost:5173** bằng **Google Chrome** (hoặc Edge).
Phải là `localhost` (secure context) — mở qua IP không có HTTPS sẽ bị chặn Web Speech STT.

- Nhấn **mic** (hoặc **Space**) → nói: *"Mira, tóm tắt phiên audit sáng nay"*, *"so sánh với Figma"*…
- Hoặc bấm **Trò chuyện trực tiếp** để nói qua lại liên tục.
- Không có mic? Bấm **▶ Mô phỏng hội thoại** xem 5 trạng thái chạy.

## Cắm bộ não LLM (tuỳ chọn)

Bấm **⌘ Developer Console** (góc phải trên) → chọn Claude/OpenAI → dán API key → **Lưu**.
Bộ não đổi ngay lập tức (hiện trên telemetry header). Key lưu trong `localStorage` của trình duyệt.

> ⚠️ Cách này gọi LLM **trực tiếp từ browser** → chỉ dùng máy cá nhân/dev.
> Production: gọi qua server/edge proxy (xem [docs/MIRA-KIEN-TRUC.md](docs/MIRA-KIEN-TRUC.md) §12).

Cũng có thể cấu hình qua `.env` (xem `.env.example`) — localStorage được ưu tiên hơn.

## Không nghe thấy tiếng?

Mở **⌘ Developer Console** → bấm **🔊 Đọc thử** và nhìn dòng chẩn đoán:
hiện **"ĐANG NÓI"** mà vẫn im → kiểm tra âm lượng máy, đúng thiết bị output, tab Chrome không bị mute.

## Kiến trúc

```
src/
├─ core/                    # ENGINE — không phụ thuộc UI, nhúng được vào Soi
│  ├─ types.ts              # interface adapter STT / TTS / Brain
│  ├─ state-machine.ts      # idle → listening → thinking → speaking (+interrupted, error)
│  ├─ useMira.ts            # orchestration: STT → Brain → TTS, live-loop, barge-in, đo latency
│  ├─ stt/webspeech-stt.ts  # adapter STT  → đổi sang Viettel/FPT/Whisper chỉ thay file này
│  ├─ tts/webspeech-tts.ts  # adapter TTS  → đổi sang Vbee/Viettel/ElevenLabs tương tự
│  │                        #   (đã vá các bug câm tiếng Chrome: GC utterance, cancel-race, voices-race)
│  └─ brain/                # canned demo | LLM (Claude/OpenAI), config từ localStorage/.env
├─ avatar/
│  ├─ MiraAvatar.tsx        # Canvas R3F + đèn + error boundary + fallback 2D
│  ├─ VRMAvatar.tsx         # load VRM, lip-sync, chớp mắt, thở, mood, nhìn theo chuột
│  ├─ lipsync.ts            # amp 0..1 → viseme aa/ih/ou/oh (nguồn amp thay được khi đổi TTS)
│  └─ hologram.ts           # hologram theo --accent, váy trắng, da sáng, môi hồng
└─ ui/                      # MiraStage, VoiceDock, DevConsole + styles
public/avatars/mira.vrm     # avatar VRoid (sample, free) — thay bằng model riêng là xong
docs/MIRA-KIEN-TRUC.md      # tài liệu kiến trúc & lộ trình đầy đủ
```

Nguyên tắc: **engine `core/` tách khỏi UI** — bản standalone chỉ là vỏ mỏng, sẵn sàng đóng gói
`<MiraAssistant/>` nhúng vào Soi (hợp đồng tích hợp ở §16 tài liệu kiến trúc).

## Đổi avatar

Tạo nhân vật trong [VRoid Studio](https://vroid.com/en/studio) (miễn phí) → xuất `.vrm` → thả đè
`public/avatars/mira.vrm`. Lưu ý: toạ độ tô môi hồng (`LIP` trong `hologram.ts`) đo theo texture
của model hiện tại — đổi model thì chỉnh lại hoặc tắt `beautifyFace`.

## Lộ trình tiếp theo

- [ ] Ô nhập text (chat không cần mic + fallback khi STT lỗi)
- [ ] TTS Vbee/Viettel (giọng nữ Việt tự nhiên, streaming theo câu) + lip-sync theo âm thanh thật (AnalyserNode)
- [ ] STT Viettel/Whisper self-host cho vùng bảo mật cao
- [ ] Silero VAD: always-on + barge-in bằng giọng nói
- [ ] Supabase: auth chung Soi + lưu hội thoại + memory pgvector
- [ ] LLM qua server proxy + ghi `turn_metrics` đo latency từng chặng
- [ ] Đóng gói `<MiraAssistant/>` nhúng vào Soi

## Tech stack & credits

React 18 · TypeScript · Vite · three.js · @react-three/fiber · @pixiv/three-vrm · Web Speech API.
Avatar placeholder: VRoid sample model (allowed-user *Everyone*, miễn phí). Voice loop chạy hoàn toàn
trên trình duyệt — Chrome STT gửi audio lên Google để nhận dạng (xem ghi chú riêng tư trong tài liệu kiến trúc).
