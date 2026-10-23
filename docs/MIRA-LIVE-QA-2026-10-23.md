# Mira Live v17 — kiểm thử trước/sau (23/10/2026)

Kế hoạch: [`plans/2026-10-23-live-3d-companion.md`](plans/2026-10-23-live-3d-companion.md). Baseline `9ed040a`.
Môi trường: Chromium 153 headless (SwiftShader), `vite preview` của bản build, mic giả lập, không có `/api` (preview tĩnh).
Ảnh chụp không commit vào repo (cổng `check:rights` coi mọi media mới là cần duyệt quyền).

## Kết quả đo được

| Hạng mục | Trước (`9ed040a`) | Sau | Trạng thái |
| --- | --- | --- | --- |
| Nút trên header | 4 (camera, chân dung, màu, cài đặt) | 1 (cài đặt) | Đạt DESIGN.md §7 |
| Nút dưới 44 px (desktop 1440×900) | 5/7 | 0/6 | Đạt WCAG 2.5.5 |
| Ô nhập văn bản trên màn chính | Không | Có (`#mira-composer`) | Đạt DESIGN.md §8 |
| Pill "CHẠM 1 LẦN ĐỂ BẬT" đè "Sẵn sàng" trên mobile 390 px | Có | Đã gỡ pill trùng | Đạt |
| Nhãn trạng thái tiếng Anh (READY/LISTENING…) | Có | Tiếng Việt | Đạt |
| Cảnh mặc định lúc 22:38 | `bedtime` (đồ ngủ, giường) | `home-evening` (sofa) | Đạt — cảnh tối là opt-in 18+ |
| Gõ "em không muốn sống nữa" | Đi vào Brain bình thường | Phản hồi an toàn + banner 115 / 096 306 1414 / 0865 044 400 | Đạt (không cần server) |
| Bấm LIVE khi không có `/api` | — | Báo "Mira Live chưa kết nối được…", nút trở về trạng thái tắt | Đạt (lỗi có lối ra) |
| Tràn ngang | Không | Không | Giữ |
| Lỗi JS khi chạy | 0 | 0 (chỉ lỗi mạng do sandbox chặn font/TTS) | Giữ |

## Kiểm tra tự động

- `npm run check` (Node 24.22): rights, licenses, avatar, architecture, skills, `tsc`, **778/778 test**, benchmark,
  device-lab, media, build, bundle, artifact — **PASS**.
- Bundle: initial 141,2 KiB JS; AppV2 graph **299,6 / 300 KiB** (engine Live 10 KiB, dock, crisis module đều lazy).
- Test hành vi mới: `crisis-safety` (7), `live-token` (10, gồm handler `/api/chat` thật với req/res giả), `live-protocol` (10).

## CI trên GitHub Actions

| Commit | Workflow | Kết quả |
| --- | --- | --- |
| `f9e5345` | CI (Node 24/26), Pages, Desktop Native Check, macOS DMG, Windows release, BA Capture Review | success |
| `f9e5345` | Visual QA | failure — spec còn bấm nút `.v2-female-mode` đã chuyển vào Cài đặt |
| `b4da803` | CI, Pages | success |
| `b4da803` | Visual QA (run 39988124713, chạy tay vì spec realistic-human không nằm trong `paths`) | success, artifact `mira-visual-qa-b4da803…` |

Vercel production `dpl_E6W3PguKWfnRonhQ1vbYkhWnsLgh` (READY): `/api/brain-health` trả `status: configured_unverified`,
`live.configured: true`, `live.model: gemini-3.8-live`; không có runtime error trong giờ đầu.

## Chưa xác minh được trong sandbox — cần kiểm sau deploy

1. **Gọi Gemini Live thật**: sandbox không có `GEMINI_API_KEY` và không ra được mạng ngoài. Sau deploy, `GET /api/brain-health`
   có `live.configured`; thử bằng nút LIVE trên `miraai-five.vercel.app`. Tên model mặc định `gemini-3.8-live` lấy theo
   tài liệu Google ngày 23/10/2026; đổi bằng `MIRA_LIVE_MODEL` nếu Google đổi tên.
2. **Tiếng vọng loa ngoài**: dùng `echoCancellation` của trình duyệt; nên thử trên laptop không tai nghe.
3. **Avatar 3D**: hình học và manifest **không đổi** (`status: pending`). Lip-sync 3D đọc `ttsLevel` — Live cập nhật đúng
   nguồn này, nhưng production vẫn hiển thị 2D cho tới khi có avatar được duyệt quyền và thẩm mỹ (AGENTS.md quy tắc 4, 7).
   Ảnh `?room3d=1` trong headless không khởi tạo được WebGL (`data-room3d-active=false` cả trước và sau) → **visual QA 3D chưa hoàn tất**.
4. **GitHub Pages**: Live cần `/api` cùng origin; trên Pages nút LIVE sẽ báo chưa kết nối. Web chính (Vercel) và Desktop dùng được.
