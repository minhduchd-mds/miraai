# Đánh giá: pipeline giọng tiếng Việt tự nhiên + lipsync cho Mira

> Đánh giá đề xuất: `Text → VietNormalizer → F5-TTS-Vietnamese → Audio → Rhubarb/VRM → Mira`
> Kết luận trước: **ý tưởng đúng, nhưng cần thay 2 mắt xích** — chọn VieNeu-TTS thay F5-TTS (license + tốc độ),
> và chỉ Rhubarb là đúng công cụ lipsync cho VRM.
> Ngày đánh giá: 2026-06-11.

## 1. Chấm từng mắt xích

| Đề xuất | Repo | Dùng được cho Mira? | Nhận xét |
|---|---|---|---|
| **VietNormalizer / vinorm** | [v-nhandt21/Vinorm](https://github.com/v-nhandt21/Vinorm), [VietNormalizer paper](https://arxiv.org/html/2603.04145v1) | ✅ **Dùng** | Chuẩn hoá số/ngày/viết tắt thành chữ đọc được ("3 lỗi" → "ba lỗi") — bắt buộc cho mọi TTS tiếng Việt self-host. Chạy trong server TTS, không phải browser. |
| **F5-TTS-Vietnamese** | [nguyenthienhy/F5-TTS-Vietnamese](https://github.com/nguyenthienhy/F5-TTS-Vietnamese), model [hynt/F5-TTS-Vietnamese-ViVoice](https://huggingface.co/hynt/F5-TTS-Vietnamese-ViVoice) | ⚠️ **Có điều kiện** | Chất lượng tự nhiên + clone giọng. Nhưng license CC-BY-NC-SA-4.0 cấm thương mại, cần GPU và không phù hợp production. |
| **VieNeu-TTS** ⭐ khuyên dùng thay thế | [pnnbao97/VieNeu-TTS](https://github.com/pnnbao97/VieNeu-TTS) | ✅ **Dùng — lựa chọn chính** | Apache-2.0, real-time trên CPU, clone giọng 3–5s, 24–48kHz, có Docker. Phù hợp self-host/on-prem. |
| **Rhubarb Lip Sync** | [DanielSWolf/rhubarb-lip-sync](https://github.com/DanielSWolf/rhubarb-lip-sync) | ✅ **Dùng — nâng cấp lipsync** | CLI: WAV → timeline viseme JSON. Map A–H,X → VRM `aa/ih/ou/ee/oh` để lipsync khớp âm tiết. |

## 2. Kiến trúc khuyến nghị

```
LLM text (browser)
  → POST /tts  ──────────────  SERVER PYTHON (Docker, CPU là đủ)
                               1. vinorm / VietNormalizer
                               2. VieNeu-TTS
                               3. [tuỳ chọn] Rhubarb --recognizer phonetic -f json
  ← { audio: wav/mp3, visemes: [{t, shape}...] }
BROWSER
  → phát audio (HTMLAudio/WebAudio)
  → lipsync 2 mức:
     • MVP: AnalyserNode → RMS → LipSync.update(amp)
     • Nâng cao: drive viseme theo timeline Rhubarb
```

## 3. So sánh nhanh

| | Web Speech | ElevenLabs | **VieNeu-TTS** | F5-TTS-Vietnamese |
|---|---|---|---|---|
| Độ tự nhiên tiếng Việt | ★★ | ★★★★ | ★★★★ | ★★★★☆ |
| Trễ | ~0ms | ~0.5–1.5s | real-time CPU | 1–3s GPU |
| Chi phí | 0 | trả phí sau free | hạ tầng tự host | hạ tầng GPU |
| License thương mại | ✓ | ✓ | ✓ Apache-2.0 | ✗ CC-BY-NC-SA |
| Dữ liệu ra ngoài | Có thể có | Có | Không nếu self-host | Không nếu self-host |

## 4. Lộ trình tích hợp

1. **Server TTS**: Docker VieNeu-TTS + FastAPI `POST /tts {text} → wav`, vinorm chạy trước synthesize.
2. **Adapter + lipsync thật**: `vieneu-tts.ts` + AnalyserNode → `LipSync.update(amp)`.
3. **Viseme chuẩn**: thêm Rhubarb vào server, trả timeline kèm audio → browser drive `aa/ih/ou/ee/oh` theo từng âm tiết.