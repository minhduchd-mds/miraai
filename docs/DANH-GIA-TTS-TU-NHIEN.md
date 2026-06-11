# Đánh giá: pipeline giọng tiếng Việt tự nhiên + lipsync cho Mira

> Đánh giá đề xuất: `Text → VietNormalizer → F5-TTS-Vietnamese → Audio → Wav2Lip/Rhubarb/MuseTalk/Live2D → Mira`
> Kết luận trước: **ý tưởng đúng, nhưng cần thay 2 mắt xích** — chọn VieNeu-TTS thay F5-TTS (license + tốc độ),
> và chỉ Rhubarb là đúng công cụ lipsync cho VRM (Wav2Lip/MuseTalk/Live2D là công nghệ avatar khác).
> Ngày đánh giá: 2026-06-11.

## 1. Chấm từng mắt xích

| Đề xuất | Repo | Dùng được cho Mira? | Nhận xét |
|---|---|---|---|
| **VietNormalizer / vinorm** | [v-nhandt21/Vinorm](https://github.com/v-nhandt21/Vinorm), [VietNormalizer (paper 2026)](https://arxiv.org/html/2603.04145v1) | ✅ **Dùng** | Chuẩn hoá số/ngày/viết tắt thành chữ đọc được ("3 lỗi" → "ba lỗi") — bắt buộc cho mọi TTS tiếng Việt self-host. Chạy trong server TTS, không phải browser. |
| **F5-TTS-Vietnamese** | [nguyenthienhy/F5-TTS-Vietnamese](https://github.com/nguyenthienhy/F5-TTS-Vietnamese), model [hynt/F5-TTS-Vietnamese-ViVoice](https://huggingface.co/hynt/F5-TTS-Vietnamese-ViVoice) (1000h) | ⚠️ **Có điều kiện** | Chất lượng rất tự nhiên + clone giọng. NHƯNG: (1) license **CC-BY-NC-SA-4.0 — cấm thương mại** → không dùng được khi Mira vào Soi/Viettel production; (2) cần **GPU**, không streaming → trễ ~1–3s/câu; (3) chỉ hợp demo/nghiên cứu cá nhân. |
| **VieNeu-TTS** ⭐ khuyên dùng thay thế | [pnnbao97/VieNeu-TTS](https://github.com/pnnbao97/VieNeu-TTS) | ✅ **Dùng — lựa chọn chính** | **Apache-2.0 (thương mại OK)**, **real-time trên CPU** (ONNX, không cần GPU), clone giọng 3–5s, 24–48kHz, 10k+ giờ data Việt-Anh, Docker sẵn. Đã nằm trong kiến trúc gốc §6 cho "vùng bảo mật cao". Trễ thấp hơn F5 hẳn một bậc. |
| **Wav2Lip** | [Rudrabha/Wav2Lip](https://github.com/Rudrabha/Wav2Lip) | ❌ **Không** | GAN sync môi cho **video mặt người thật 2D** — input là video+audio, output video. Mira là VRM 3D real-time, không có video để sync. Sai lớp công nghệ. |
| **MuseTalk** | [TMElyralab/MuseTalk](https://github.com/TMElyralab/MuseTalk) | ❌ **Không** | Talking-head 2D từ ảnh/video (GPU nặng). Cùng lý do trên — đây là hướng "avatar ảnh thật", không phải VRM anime hologram đã chốt trong kiến trúc. |
| **Rhubarb Lip Sync** | [DanielSWolf/rhubarb-lip-sync](https://github.com/DanielSWolf/rhubarb-lip-sync) | ✅ **Dùng — nâng cấp lipsync** | CLI: WAV → **timeline viseme JSON** (9 hình miệng A–H,X). Có **phonetic recognizer cho tiếng không phải Anh** (hợp tiếng Việt). Map A–H,X → VRM `aa/ih/ou/ee/oh` là có lipsync khớp âm tiết thật, chạy server-side sau TTS. |
| **Live2D lipsync** | — | ❌ **Không** | Live2D là định dạng avatar 2.5D khác hệ — Mira dùng VRM/three-vrm. Tham khảo ý tưởng thôi. |

## 2. Kiến trúc khuyến nghị (thay cho pipeline gốc)

```
LLM text (browser)
  → POST /tts  ──────────────  SERVER PYTHON (Docker, CPU là đủ)
                               1. vinorm / VietNormalizer  (chuẩn hoá số, ngày, viết tắt)
                               2. VieNeu-TTS               (WAV 24/48kHz, clone giọng nữ riêng cho Mira)
                               3. [tuỳ chọn] Rhubarb --recognizer phonetic -f json
  ← { audio: wav/mp3, visemes: [{t, shape}...] }
BROWSER
  → phát audio (HTMLAudio/WebAudio)
  → lipsync 2 mức:
     • MVP: AnalyserNode → RMS → LipSync.update(amp)   (module lipsync.ts hiện tại ăn amp 0..1 sẵn rồi)
     • Nâng cao: drive viseme theo timeline Rhubarb     (khớp âm tiết thật)
```

Vì sao khớp codebase hiện tại:
- `TTSAdapter` đã là interface cắm được → chỉ thêm `src/core/tts/vieneu-tts.ts` (giống `elevenlabs-tts.ts`, đổi endpoint về server nhà).
- `lipsync.ts` thiết kế sẵn "chỉ ăn biên độ 0..1, không biết nguồn" → có audio element thật là AnalyserNode cắm vào ngay, không sửa avatar.
- Engine giọng chọn trong ⌘ Developer Console như ElevenLabs hiện tại (thêm option "VieNeu (server nhà)").
- Khớp triết lý 3 vùng triển khai của Soi: dữ liệu giọng không ra ngoài (§12 kiến trúc).

## 3. So sánh nhanh các phương án giọng tự nhiên

| | Web Speech (hiện tại) | ElevenLabs (đã tích hợp) | **VieNeu-TTS (đề xuất)** | F5-TTS-Vietnamese |
|---|---|---|---|---|
| Độ tự nhiên tiếng Việt | ★★ máy | ★★★★ | ★★★★ | ★★★★☆ |
| Trễ | ~0ms | ~0.5–1.5s | **real-time CPU** | 1–3s (GPU) |
| Chi phí | 0 | ~$5/tháng sau free | **0 (hạ tầng nhà)** | 0 + tiền GPU |
| License thương mại | ✓ | ✓ (trả phí) | ✓ **Apache-2.0** | ✗ CC-BY-NC-SA |
| Dữ liệu ra ngoài | Google (STT) | ElevenLabs | **Không — on-prem** | Không |
| Clone giọng riêng cho Mira | ✗ | ✓ | ✓ (3–5s mẫu) | ✓ |

## 4. Lộ trình tích hợp (3 bước, tăng dần)

1. **Server TTS** (~nửa ngày): Docker VieNeu-TTS + FastAPI `POST /tts {text} → wav`, vinorm chạy trước synthesize. Chạy được trên máy CPU thường.
2. **Adapter + lipsync thật** (~nửa ngày): `vieneu-tts.ts` (copy khuôn elevenlabs-tts) + AnalyserNode → `LipSync.update(amp)` → miệng khớp âm lượng thật thay vì envelope giả lập.
3. **Viseme chuẩn** (tuỳ chọn): thêm Rhubarb vào server (`-r phonetic -f json`), trả timeline kèm audio → browser drive `aa/ih/ou/ee/oh` theo từng âm tiết.

Khi nào dùng gì: **demo nhanh/đa ngôn ngữ** → ElevenLabs (đã có). **Sản phẩm + bảo mật + giọng nữ Việt riêng** → VieNeu-TTS self-host. **Nghiên cứu chất giọng tối đa, phi thương mại** → F5-TTS-ViVoice.
