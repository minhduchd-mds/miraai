# Mira TTS server — giọng Việt tự nhiên self-host

vinorm (chuẩn hoá số/ngày → chữ) + [VieNeu-TTS](https://github.com/pnnbao97/VieNeu-TTS)
(Apache-2.0, **chạy real-time trên CPU**, không cần GPU, dữ liệu giọng không ra ngoài).

## Chạy giọng thật

```bash
./server/run.sh        # tự tạo venv + cài đặt lần đầu; model tự tải từ HuggingFace ở lần gọi đầu
```

(thủ công: `python3 -m venv .venv && ./.venv/bin/pip install -r requirements.txt vieneu vinorm && ./.venv/bin/uvicorn main:app --port 8017`)

Rồi trong app: **⌘ Developer Console → Giọng nói → VieNeu — server nhà → Lưu giọng → 🔊 Đọc thử.**
Chọn giọng preset ở thanh dưới màn hình (danh sách lấy từ server). Miệng Mira khớp âm thanh thật
(AnalyserNode), không còn nhép giả lập.

## Mock mode (dev UI / CI — không cần model)

```bash
./server/run.sh mock
```

Trả WAV "beep" có nhịp như giọng nói — đủ để test pipeline audio + lipsync.

## API

| | |
|---|---|
| `GET /health` | `{ok, mock, engine}` |
| `GET /voices` | `{voices: ["Xuân Vĩnh", ...]}` — giọng preset của VieNeu |
| `POST /tts` `{text, voice?}` | `audio/wav` |

## Ghi chú

- Lần gọi `/tts` đầu tiên sẽ chậm (tải + nạp model); các lần sau nhanh.
- Clone giọng nữ riêng cho Mira: VieNeu hỗ trợ ref audio 3–5s — sẽ thêm endpoint khi chốt giọng.
- Nâng cấp kế tiếp (xem [docs/DANH-GIA-TTS-TU-NHIEN.md](../docs/DANH-GIA-TTS-TU-NHIEN.md)):
  Rhubarb viseme timeline để miệng khớp từng âm tiết thay vì biên độ.
