"""Mira TTS server — vinorm (chuẩn hoá) + VieNeu-TTS (giọng Việt tự nhiên, CPU realtime).

Chạy thật:   uvicorn main:app --port 8017
Chạy mock:   VIENEU_MOCK=1 uvicorn main:app --port 8017   (không cần model — WAV beep giả lập,
             dùng để dev UI/lipsync hoặc CI; miệng avatar vẫn nhép theo envelope của beep)

API:
  GET  /health          → {ok, mock, engine}
  GET  /voices          → {voices: [tên giọng preset...]}
  POST /tts {text, voice?} → audio/wav
"""

import io
import math
import os
import struct
import tempfile
import threading
import wave

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel

MOCK = os.environ.get("VIENEU_MOCK") == "1"
# Giọng mặc định cho Mira (nữ). Đổi bằng env VIENEU_VOICE hoặc voice trong request.
DEFAULT_VOICE = os.environ.get("VIENEU_VOICE", "Ngọc Lan")

app = FastAPI(title="Mira TTS server (VieNeu)")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # dev cục bộ; production thì giới hạn origin của app
    allow_methods=["*"],
    allow_headers=["*"],
)

_tts = None
_tts_lock = threading.Lock()


def get_tts():
    """Khởi tạo VieNeu lười + 1 lần (model tự tải từ HuggingFace lần đầu)."""
    global _tts
    with _tts_lock:
        if _tts is None:
            from vieneu import Vieneu  # import muộn để mock mode không cần cài

            _tts = Vieneu()
        return _tts


def normalize(text: str) -> str:
    """vinorm: '3 lỗi, 12 cảnh báo' → 'ba lỗi, mười hai cảnh báo' — TTS đọc đúng."""
    try:
        from vinorm import TTSnorm

        return TTSnorm(text)
    except Exception:
        return text  # thiếu vinorm vẫn chạy, chỉ kém chuẩn hoá


def mock_wav(text: str) -> bytes:
    """WAV giả lập giống nhịp nói (AM theo 'âm tiết') để dev lipsync không cần model."""
    sr = 24000
    syllables = max(3, min(40, len(text.split())))
    dur = 0.45 + syllables * 0.28
    n = int(sr * dur)
    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(sr)
        frames = bytearray()
        for i in range(n):
            t = i / sr
            syl = 0.5 + 0.5 * math.sin(2 * math.pi * 3.3 * t)  # nhịp âm tiết ~3.3Hz
            env = syl * (0.25 + 0.75 * abs(math.sin(2 * math.pi * 0.6 * t)))
            sample = env * 0.5 * math.sin(2 * math.pi * 210 * t)
            frames += struct.pack("<h", int(sample * 32767))
        w.writeframes(bytes(frames))
    return buf.getvalue()


class TTSIn(BaseModel):
    text: str
    voice: str | None = None


@app.get("/health")
def health():
    return {"ok": True, "mock": MOCK, "engine": "mock" if MOCK else "vieneu"}


@app.get("/voices")
def voices():
    if MOCK:
        return {"voices": [{"id": "Mock", "label": "Mock"}]}
    try:
        # list_preset_voices() trả tuple (label, name) — chuẩn hoá thành {id, label}
        out = []
        for v in get_tts().list_preset_voices():
            if isinstance(v, (list, tuple)) and len(v) >= 2:
                out.append({"id": str(v[1]), "label": str(v[0])})
            else:
                out.append({"id": str(v), "label": str(v)})
        return {"voices": out}
    except Exception as e:  # model chưa sẵn sàng → trả rỗng, client dùng giọng mặc định
        return {"voices": [], "error": str(e)[:200]}


@app.post("/tts")
def tts(inp: TTSIn):
    text = (inp.text or "").strip()
    if not text:
        raise HTTPException(400, "text rỗng")
    if MOCK:
        return Response(mock_wav(text), media_type="audio/wav")

    try:
        engine = get_tts()
        norm = normalize(text)
        audio = engine.infer(norm, voice=inp.voice or DEFAULT_VOICE)
        # API save() ghi file → dùng file tạm rồi đọc bytes (an toàn với mọi định dạng audio trả về)
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
            path = f.name
        try:
            engine.save(audio, path)
            with open(path, "rb") as f:
                data = f.read()
        finally:
            try:
                os.unlink(path)
            except OSError:
                pass
        return Response(data, media_type="audio/wav")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"VieNeu lỗi: {str(e)[:300]}")
