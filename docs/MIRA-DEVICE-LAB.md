# Mira Real-device Lab

Mira Real-device Lab biến **Device Check** thành một quy trình nghiệm thu có thể lặp lại trên nhiều thiết bị mà không lưu camera frame, audio, transcript, device ID, user-agent hay vị trí.

## Hai lớp dữ liệu

### 1. Device Report

Trong Mira:

1. **Cài đặt → Giọng & hội thoại**
2. **Kiểm tra thiết bị**
3. **Xuất báo cáo**

Kết quả có format:

`mira.device-report` schema v1.

Đây chỉ là preflight capability; nó chưa chứng minh camera/gesture/voice/XR chạy tốt trên thiết bị thật.

### 2. Device Lab Result

Sau khi thử chức năng thật trên thiết bị, dùng CLI để gắn observation vào Device Report.

Ví dụ:

```bash
npm run device:lab:capture -- \
  --report=~/Downloads/mira-device-report-2026-10-07.json \
  --label="MacBook Pro Intel" \
  --camera-started=true \
  --camera-start-ms=1400 \
  --face-detected=true \
  --hand-detected=true \
  --gesture-stable=true \
  --voice-playback=true \
  --voice-first-audio-ms=1550 \
  --interruption-worked=true \
  --desktop-launch=true
```

Với thiết bị WebXR/AR có thể thêm:

```bash
--xr-session-started=true \
--xr-anchor-stable=true
```

CLI tạo `mira.device-lab-result` schema v1 trong `artifacts/device-lab/`.

Thư mục này bị gitignore mặc định vì kết quả thực nghiệm là dữ liệu local của người test.

## Matrix

Tổng hợp toàn bộ kết quả:

```bash
npm run device:lab:matrix
```

Yêu cầu tối thiểu N thiết bị khi nghiệm thu release:

```bash
npm run device:lab:matrix -- --require=3
```

Kết quả:

- `artifacts/device-lab/matrix.json`
- `artifacts/device-lab/matrix.md`

## Acceptance

### Camera / Vision

- camera start:
  - PASS: <= 2500 ms
  - WARN: 2501–4500 ms
  - FAIL: > 4500 ms
- face detection: phải PASS khi camera applicable
- hand detection: phải PASS khi camera applicable
- gesture stability: phải PASS khi camera applicable

### Voice

- first audio:
  - PASS: <= 1800 ms
  - WARN: 1801–3000 ms
  - FAIL: > 3000 ms
- voice playback: phải PASS nếu voice gateway không unhealthy
- interruption/barge-in: phải PASS nếu voice applicable

### Desktop

- desktop launch là empirical check riêng.
- Authenticode / Developer ID / notarization vẫn được xác minh trong release workflow; Device Lab không thay thế signing validation.

### XR

- XR tests chỉ applicable khi Device Report trả `immersiveAr: true`.
- Nếu thiết bị không hỗ trợ immersive AR, XR session/anchor checks được đánh dấu `N/A`, không làm fail thiết bị.

## Privacy

Device Lab dùng allow-list hai lần:

1. `mira.device-report` đã loại raw/identifying fields.
2. `buildDeviceLabResult()` lại copy source theo allow-list thay vì giữ object input nguyên bản.

Matrix từ chối kết quả có các field/token nhạy cảm như:

- `userAgent`
- `deviceId`
- `rawFrame`
- `rawAudio`
- `transcript`
- `preciseLocation`
- latitude / longitude
- provider `lastError`
- API key / cookie

Không dùng Device Lab để thu thập media hoặc dữ liệu nhận dạng thiết bị.

## Synthetic browser regression

CI Visual/Capability QA complements Device Lab with two synthetic layers.

### Viewport matrix

Five browser viewport profiles:

- 1440×900 desktop
- 1366×768 desktop
- 768×1024 tablet
- 390×844 mobile
- 360×800 mobile

This catches layout overflow, broken presence assets and runtime media regressions before hardware testing.

### Capability smoke

`scripts/capability-smoke.spec.mjs` injects synthetic browser capabilities without opening real media:

- denied camera permission must be reported as `Bị chặn`;
- granted microphone permission must be reported without requesting mic capture;
- immersive-AR capability must expose the production XR control;
- 1366×768 must remain free of horizontal overflow with XR + Settings controls present.

Capability smoke is deliberately **not** camera accuracy, gesture accuracy, real voice playback or real WebXR validation.

## Release device gate

Normal CI runs `npm run check:device-lab` in contract-only mode so a clean checkout does not fail merely because private empirical results are not committed.

Before a hardware-qualified release, run:

```bash
npm run check:device-release
```

This requires at least **3 private empirical device results**. Every result must be PASS, contain finite non-negative camera and first-audio latency measurements, and have usable voice health. Missing observations, WARN/FAIL results, repeated device/profile labels, duplicate captures, and invalid/private-contract-breaking input fail the release gate. Contract-only mode remains available for CI without hardware evidence. The recommended minimum evidence set is:

1. one desktop machine running Mira Desktop;
2. one second browser/OS profile for camera + voice;
3. one immersive-AR device when XR is part of the release claim.

If XR is not part of the release claim, the third result may be another camera/voice device profile.

Synthetic Playwright output is **never** counted toward these three results. Only `mira.device-lab-result` files produced from a real Device Report + real observations count toward the empirical gate.

### Bind evidence to the release candidate

Add `--release-sha=<full 40-character commit SHA>` to `device:lab:capture` after testing the candidate built from that commit. Recheck locally with:

```bash
npm run check:device-release -- --release-sha=<full 40-character commit SHA> --no-write
```

An operator must confirm the observations came from distinct physical devices/profiles running that candidate. The JSON contract cannot establish physical provenance on its own; changing a label or adding a SHA does not substitute for a new device test.

For publication, configure the repository secret `DEVICE_LAB_RESULTS` as a JSON array of the private result objects. `scripts/check-device-release.mjs` stages the array in a temporary directory, requires three PASS results matching `GITHUB_SHA`, and deletes the staged files afterward. Never place credentials, transcripts, camera/audio data, or device identifiers in this array.

Windows publication requires a manual dispatch with `publish=true`; the macOS release publisher is manual-only. Both fail closed without matching device evidence. Push builds and unsigned/ad-hoc artifacts are for validation, not hardware-qualified publication.
