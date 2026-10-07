# Mira Device Report

Mira Device Report is a small, user-triggered JSON export for real-device validation.

## Format

- `format`: `mira.device-report`
- `schemaVersion`: `1`
- generated only after the user runs **Kiểm tra thiết bị**
- downloaded explicitly with **Xuất báo cáo**

## Included

The report contains only coarse runtime capability and permission state needed to diagnose product behavior:

- secure-context availability;
- camera/microphone API availability and browser permission state;
- WebXR + immersive-AR support result;
- WebGPU / WebNN availability;
- requestVideoFrameCallback and AudioWorklet support;
- cross-origin isolation;
- recommended Mira product mode;
- browser-reported CPU-thread count and device-memory bucket when exposed;
- active TTS provider label and health state.

## Excluded by contract

The report does **not** include:

- camera frames, photos or landmarks;
- microphone audio or transcripts;
- user-agent string;
- media device IDs or device labels;
- precise location;
- provider error detail, prompts or conversation text;
- cookies, account identifiers or API keys.

The runtime builds the report from an explicit allow-list instead of serializing the diagnostics object wholesale. Architecture and product tests inject fake identifying/raw fields and require them to be absent from the serialized report.

## Workflow

1. Open **Cài đặt → Giọng & hội thoại**.
2. Under **Thiết bị & kết nối**, choose **Kiểm tra thiết bị**.
3. Review the eight capability cards.
4. Choose **Xuất báo cáo**.
5. Share the JSON only when you want the device result reviewed.

The preflight itself does not call `getUserMedia()`, so it does not turn on camera/microphone or request media permission.
