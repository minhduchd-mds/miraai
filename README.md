# Mira — Voice-first AI Companion

Mira là một **AI companion ưu tiên hội thoại bằng giọng nói**, có runtime text/host fallback, trí nhớ, skill/tool, host context và lớp hiện diện 2D/3D. Avatar là **Presence Layer**, không phải bản chất của sản phẩm.

## Trải nghiệm chính

- Voice-first: Web Speech STT, smart turn-taking, live conversation, VAD/barge-in.
- Text/host fallback vẫn đi qua cùng Conversation Runtime, nhưng production `AppV2` không render text composer.
- TTS adapters: Web Speech, Edge/self-host, VieNeu, ElevenLabs proxy.
- Mira Brain Gateway: Gemini / OpenAI / Anthropic chạy server-side, có fallback chain.
- Memory: recent history + semantic recall + durable facts, có bật/tắt, sửa, quên và export.
- Skills: registry có metadata risk/network/voice; Result Surface generic `weather | image | card | list`.
- Host integration: Soi hoặc app khác có thể inject context/action mà không fork Mira core.
- Presence: 2D tải ngay; Three/VRM chỉ lazy-load khi cần.
- Labs: camera, gesture, Gaussian Splat, simulator, BYOK/dev diagnostics được tách khỏi UI production.
- Spatial Interaction: gaze/head focus + pinch commit, direct hand pointing, pinch-drag cửa sổ và two-hand scale/rotate.

## Kiến trúc

```text
Voice / Text
    ↓
Conversation Runtime
    ├─ Conversation Machine
    ├─ Speech Queue
    └─ Turn Manager
          ├─ Memory Service
          ├─ Host Context / Host Actions
          ├─ Skill Registry
          └─ Mira Brain Gateway
                ├─ Gemini
                ├─ OpenAI
                └─ Anthropic
    ↓
Assistant Turn
    ├─ TTS → Presence / lip-sync
    └─ Result View → Result Surface
```

Chi tiết: [`docs/MIRA-V2-ARCHITECTURE.md`](docs/MIRA-V2-ARCHITECTURE.md).

## Chạy local

Yêu cầu Node.js 22+.

```bash
npm ci
npm run dev
```

Kiểm tra đầy đủ:

```bash
npm run check
```

Quality gate hiện gồm architecture guard, skill contract guard, TypeScript, runtime unit tests, Vite production build, initial bundle budget và deploy-artifact smoke. GitHub CI chạy trên Node 22 và 24.

## Brain server-side

Copy `.env.example` và cấu hình provider mong muốn:

```env
MIRA_BRAIN_PROVIDER=auto
GEMINI_API_KEY=

# Hoặc
OPENAI_API_KEY=
OPENAI_MODEL=

# Hoặc
ANTHROPIC_API_KEY=
ANTHROPIC_MODEL=
```

Có thể đặt `MIRA_BRAIN_FALLBACKS=openai,gemini` (ví dụ). Xem [`docs/BRAIN-GATEWAY.md`](docs/BRAIN-GATEWAY.md).

**Production browser không đọc API key OpenAI/Anthropic.** BYOK trực tiếp chỉ còn là tiện ích Developer Labs trong Vite DEV.

## Memory

Khi có `DATABASE_URL`, Mira lưu history/facts vào Neon/Postgres. Browser cũ được migrate mềm: `device_id` hiện tại chỉ làm seed lần đầu, sau đó server ghim scope bằng cookie HttpOnly.

Settings → **Ký ức & riêng tư** cho phép:
- bật/tắt memory;
- xem/sửa/quên từng fact;
- export dữ liệu;
- xoá toàn bộ history + facts.

Đây hiện là **anonymous browser scope**, chưa phải hệ thống tài khoản nhiều người dùng. Nếu triển khai account/team thực, cần map scope sang authenticated user/org.

## Voice Runtime tự host

Backend Python hiện tại vẫn giữ vai trò Voice Runtime riêng; không merge ép vào Node/Vercel Gateway.

```bash
cd server
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000
```

Các TTS engine/fallback hiện có tiếp tục hoạt động theo config của repo.

## Production UI và Labs

- `/` → Mira V2 conversation-first.
- `/?legacy=1` → Legacy / Developer Labs.

Legacy được dynamic-import nên camera/gesture/Splat/debug không nằm trên critical execution path.

## Performance

CI đo **initial dependency graph**, không tính dynamic Labs/3D chunks. Budget hiện tại:
- Initial JS: ≤ 160 KiB raw.
- Deferred AppV2 JS: ≤ 300 KiB raw.
- Initial CSS: ≤ 120 KiB raw.
- Media source có no-regression budget riêng qua `npm run check:media`.

CI #648 ghi nhận khoảng **140.8 KiB initial JS + 9.7 KiB CSS**, Deferred AppV2 khoảng **292.3 KiB JS**. Three/VRM/Splat/Vision vẫn nằm ở dynamic/Labs paths.

Presence v16 chỉ preload scene kế tiếp khi browser rảnh và mạng không bật Save-Data/2G.

Visual QA v16.3 chạy Chromium cho 4 presence scenes trên desktop 1366×768 và mobile 390×844, upload 8 screenshots + JSON timing/media report cho mỗi thay đổi UI liên quan. Expression reaction không tải mặc định ở trạng thái calm/gentle. PNG nguồn sắc nét vẫn được giữ trong repo. Runtime dùng WebP derivative: 21 scene/expression assets giảm từ khoảng 20.75 MiB PNG xuống khoảng 1.41 MiB WebP; Pages loại bỏ PNG source và pose/gesture/UI reference assets khỏi artifact production.

## Tạo skill mới

Không thêm intent/tool logic vào `useMira.ts`. Tạo skill trong `src/intelligence/skills/`, đăng ký ở Registry và tuân thủ risk policy. Xem [`docs/MIRA-SKILLS.md`](docs/MIRA-SKILLS.md).

## Nhúng vào Soi / app khác

Host cung cấp context/action qua `HostBridge` hoặc same-window globals. Read actions có thể chạy qua tool call; write/sensitive không được voice tự thực thi mà phải qua confirmation của host.

Xem [`docs/HOST-INTEGRATION.md`](docs/HOST-INTEGRATION.md).

## Tài liệu

- [`DESIGN.md`](DESIGN.md) — product/visual direction.
- [`docs/MIRA-V2-ARCHITECTURE.md`](docs/MIRA-V2-ARCHITECTURE.md) — kiến trúc hiện tại.
- [`docs/MIRA-WORLD-MODEL-V14.md`](docs/MIRA-WORLD-MODEL-V14.md) — object permanence / world state ngắn hạn.
- [`docs/SPATIAL-INTERACTION.md`](docs/SPATIAL-INTERACTION.md) — gaze/hand control, window manipulation và đường nâng lên 3D touch.
- [`docs/MIRA-SKILLS.md`](docs/MIRA-SKILLS.md) — skill contract + eval pattern.
- [`docs/BRAIN-GATEWAY.md`](docs/BRAIN-GATEWAY.md) — provider gateway.
- [`docs/HOST-INTEGRATION.md`](docs/HOST-INTEGRATION.md) — embed/host bridge.
- [`SECURITY.md`](SECURITY.md) — trust boundaries và known issues.

## Nguyên tắc sản phẩm

1. Conversation là sản phẩm; avatar là presence.
2. Voice-first, không voice-only.
3. Local/self-host fallback luôn có giá trị.
4. Secrets không nằm trong production browser.
5. Memory phải có consent + forget/export.
6. Write/sensitive action không được bypass confirmation/RBAC của host.
7. Labs không được làm nặng hoặc làm rối main experience.
