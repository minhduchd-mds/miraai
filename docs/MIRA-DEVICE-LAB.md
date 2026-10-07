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
