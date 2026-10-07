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

Workflow: `.github/workflows/release-windows-v0.1.0.yml`

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

Release workflows đã hỗ trợ **optional real signing** mà không làm gãy build khi chưa có certificate.

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
- optional `APPLE_SIGNING_IDENTITY`;
- `APPLE_ID`, `APPLE_PASSWORD`, `APPLE_TEAM_ID` cho notarization.

Khi có certificate, Tauri dùng Developer ID signing. Khi có đủ notarization credentials, workflow yêu cầu stapling validation thành công. Nếu chưa cấu hình, build giữ ad-hoc signing để không phá pipeline.

## Release limitations

- Artifact chỉ được xem là Authenticode/Developer ID signed khi workflow validation tương ứng báo thành công.
- Apple notarization chỉ được xem là hoàn tất khi `xcrun stapler validate` pass.
- Local-first không đồng nghĩa fully-offline: cloud Brain/ElevenLabs vẫn cần mạng khi được chọn.
