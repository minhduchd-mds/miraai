# Mira TTS server — giọng Việt tự nhiên

Một endpoint `/tts` duy nhất, **3 engine** chọn bằng env `MIRA_TTS_ENGINE`:

| Engine | Lệnh | Đặc điểm |
|---|---|---|
| **edge** | `./run.sh edge` | Microsoft Edge neural (`vi-VN-HoaiMyNeural`/`NamMinhNeural`). **Nhẹ nhất**: chỉ `pip install edge-tts`, không model, không GPU, free. ⚠️ Văn bản đi qua Microsoft → không dùng cho vùng bảo mật cao. |
| **vieneu** | `./run.sh` | [VieNeu-TTS](https://github.com/pnnbao97/VieNeu-TTS) self-host (vinorm + model, Apache-2.0, real-time CPU). Dữ liệu **không ra ngoài** → vùng bảo mật cao. |
| **mock** | `./run.sh mock` | WAV "beep" có nhịp như giọng nói (dev UI/lipsync, CI — không cần model/mạng). |

## Edge (khuyến nghị nếu máy không có giọng tiếng Việt)

```bash
./server/run.sh edge
```

Thủ công (Linux/macOS):
```bash
python3 -m venv .venv && ./.venv/bin/pip install -r requirements.txt
MIRA_TTS_ENGINE=edge ./.venv/bin/uvicorn main:app --port 8017
```

Windows (PowerShell):
```powershell
python -m venv .venv ; .\.venv\Scripts\pip install -r requirements.txt
$env:MIRA_TTS_ENGINE='edge' ; .\.venv\Scripts\uvicorn main:app --port 8017
```

Rồi trong app: **⌘ Cài đặt → Giọng nói → Edge — Microsoft → Lưu giọng → 🔊 Đọc thử.**
Chọn Hoài My (nữ) / Nam Minh (nam) ở thanh dưới. Miệng Mira khớp âm thanh thật (AnalyserNode).

## VieNeu (bảo mật cao, self-host)

```bash
./server/run.sh        # tự tạo venv + cài; model tự tải từ HuggingFace ở lần /tts đầu
```

## API

| | |
|---|---|
| `GET /health` | `{ok, engine}` |
| `GET /voices` | `{voices: [{id, label}, ...]}` |
| `POST /tts` `{text, voice?}` | `audio/mpeg` (edge) · `audio/wav` (vieneu/mock) |

## Ghi chú

- Edge: gần như tức thì, không cần warm-up. VieNeu: lần `/tts` đầu chậm (tải + nạp model).
- `vinorm` (nếu cài) chuẩn hoá số → chữ ("3 lỗi" → "ba lỗi") cho cả edge lẫn vieneu.
- Nâng cấp kế tiếp (xem [docs/DANH-GIA-TTS-TU-NHIEN.md](../docs/DANH-GIA-TTS-TU-NHIEN.md)):
  Rhubarb/word-timestamp để miệng khớp từng âm tiết thay vì biên độ.
