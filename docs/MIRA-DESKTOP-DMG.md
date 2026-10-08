# Mira Desktop — Windows & macOS

Mira Desktop dùng **Tauri 2 + local Vite frontend**. UI được đóng gói cùng ứng dụng; không còn là wrapper bắt buộc mở Vercel.

## Runtime

```text
Tauri
├─ Local frontend
├─ Rust native bridge
├─ SQLite mira.db
│  ├─ turns / episodes
│  ├─ structured_memories / memory_links
│  ├─ affect / permissions
│  └─ music_tracks / music_context_history
└─ Cloud optional
   ├─ Brain Gateway
   └─ ElevenLabs
```

## Local permissions

- `media.control`
- `media.library`
- `memory.affect`

Music Library chỉ index thư mục người dùng chủ động chọn, bỏ qua symlink và có giới hạn scan. Native Rust layer kiểm tra permission trước khi thực thi.

## Build

### Windows x64

```bash
npx tauri build --bundles nsis --target x86_64-pc-windows-msvc
```

Workflow: `.github/workflows/release-windows-v0.2.0.yml`

### macOS Intel

```bash
npx tauri build --bundles dmg --target x86_64-apple-darwin
```

Workflow: `.github/workflows/macos-dmg.yml`

## Node policy

- Build baseline: Node 24 LTS.
- CI compatibility: Node 26 Current.
- Repo contract: `>=24 <27`.

## Signing & notarization

Build workflows hỗ trợ signing tùy cấu hình và giữ artifact để kiểm tra. Publication bắt buộc signing thật và real-device release gate; push vào `main` không tự upload installer lên GitHub Release.

### Windows

GitHub Secrets:

- `WINDOWS_CERTIFICATE` — file PFX base64;
- `WINDOWS_CERTIFICATE_PASSWORD` — mật khẩu PFX.

Khi có đủ secret, workflow import certificate, inject `certificateThumbprint` + SHA-256 timestamp vào Tauri config trong runner, rồi bắt buộc cả app EXE và NSIS installer phải đạt `Get-AuthenticodeSignature = Valid`.

Nếu chưa có certificate, workflow vẫn build nhưng job summary ghi rõ artifact unsigned.

### macOS

GitHub Secrets:

- `APPLE_CERTIFICATE`;
- `APPLE_CERTIFICATE_PASSWORD`;
- `APPLE_SIGNING_IDENTITY` — bắt buộc khi có certificate, dạng `Developer ID Application: ...`;
- `APPLE_ID`, `APPLE_PASSWORD`, `APPLE_TEAM_ID` cho notarization.

Khi có certificate, workflow yêu cầu identity rõ ràng để không rơi về cấu hình ad-hoc `-`. Khi có đủ notarization credentials, workflow yêu cầu stapling và Gatekeeper validation thành công. Nếu chưa cấu hình, build giữ ad-hoc signing dưới dạng artifact kiểm tra.

## Publication gate

- `macos-dmg.yml` chỉ tạo artifact. Artifact kèm `release-validation.json` ghi commit, checksum và kết quả signing/notarization.
- Chạy thủ công `release-v0.2.0.yml` trên commit cần phát hành. Publisher chỉ nhận run macOS thành công trên `main` tại đúng `GITHUB_SHA`; bắt buộc Developer ID, notarization/Gatekeeper và checksum khớp. Artifact cũ hoặc ad-hoc bị từ chối.
- Windows mặc định chỉ build. Chạy thủ công với `publish=true` để xuất bản; app và installer đều phải có Authenticode hợp lệ.
- Cả hai publisher yêu cầu secret `DEVICE_LAB_RESULTS` chứa ít nhất 3 kết quả PASS của đúng commit; xem [Device Lab](MIRA-DEVICE-LAB.md).
- Tag release đã tồn tại phải trỏ tới đúng commit được xác minh. Không thay installer của commit mới dưới tag cũ. Các workflow phát hành hiện cố định `v0.2.0`; tăng đồng bộ version/tag và workflow trước đợt release tiếp theo. Release v0.1.0 là bản lịch sử, không được ghi đè artifact của v0.2.0.
- Native check build frontend trước Cargo và tạo Windows resource icon từ PNG gốc để clean checkout không thiếu `icon.ico`.

## Release limitations

- Artifact chỉ được xem là Authenticode/Developer ID signed khi workflow validation tương ứng báo thành công.
- Apple notarization chỉ được xem là hoàn tất khi `xcrun stapler validate` pass.
- Local-first không đồng nghĩa fully-offline: cloud Brain/ElevenLabs vẫn cần mạng khi được chọn.
