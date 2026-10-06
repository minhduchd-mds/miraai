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

## Release limitations

- Windows installer chưa Authenticode-signed.
- macOS build hiện ad-hoc signed, chưa Apple notarized.
- Local-first không đồng nghĩa fully-offline: cloud Brain/ElevenLabs vẫn cần mạng khi được chọn.
