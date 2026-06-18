"""Mira TTS server — giọng tiếng Việt tự nhiên cho Mira, một endpoint /tts duy nhất.

Ba engine (chọn bằng env MIRA_TTS_ENGINE):
  edge   → Microsoft Edge neural (vi-VN-HoaiMyNeural/NamMinhNeural). NHẸ NHẤT: chỉ
           `pip install edge-tts`, không model, không GPU, free. Văn bản đi qua Microsoft.
  vieneu → VieNeu-TTS self-host (vinorm + model). Dữ liệu KHÔNG ra ngoài → vùng bảo mật cao.
  mock   → WAV beep giả lập (dev UI/lipsync, CI) — không cần model/mạng.

Chạy edge:    MIRA_TTS_ENGINE=edge uvicorn main:app --port 8017   (Windows: $env:MIRA_TTS_ENGINE='edge')
Chạy vieneu:  uvicorn main:app --port 8017                        (mặc định)
Chạy mock:    MIRA_TTS_ENGINE=mock uvicorn main:app --port 8017   (hoặc VIENEU_MOCK=1)

API:
  GET  /health           → {ok, engine}
  GET  /voices           → {voices: [{id,label}...]}
  POST /tts {text, voice?} → audio/wav (vieneu/mock) | audio/mpeg (edge)
"""

import asyncio
import io
import math
import os
import struct
import tempfile
import threading
import time
import wave

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel

# VIENEU_MOCK=1 (cũ) vẫn được tôn trọng như alias cho engine=mock.
_MOCK_LEGACY = os.environ.get("VIENEU_MOCK") == "1"
ENGINE = os.environ.get("MIRA_TTS_ENGINE", "mock" if _MOCK_LEGACY else "vieneu").lower()
if _MOCK_LEGACY:
    ENGINE = "mock"

# Giọng mặc định theo engine (đổi bằng env hoặc field "voice" trong request).
DEFAULT_VIENEU_VOICE = os.environ.get("VIENEU_VOICE", "Ngọc Lan")
DEFAULT_EDGE_VOICE = os.environ.get("MIRA_EDGE_VOICE", "vi-VN-HoaiMyNeural")

# Giọng tiếng Việt neural của Microsoft Edge (free, không cần model).
EDGE_VOICES = [
    {"id": "vi-VN-HoaiMyNeural", "label": "Hoài My (nữ)"},
    {"id": "vi-VN-NamMinhNeural", "label": "Nam Minh (nam)"},
]

# Production: đặt MIRA_ALLOWED_ORIGINS="https://miraai-ten.vercel.app" (nhiều origin cách nhau bằng dấu phẩy).
# Không đặt → "*" cho dev cục bộ.
_ORIGINS_ENV = os.environ.get("MIRA_ALLOWED_ORIGINS", "*").strip()
ALLOWED_ORIGINS = ["*"] if _ORIGINS_ENV == "*" else [o.strip() for o in _ORIGINS_ENV.split(",") if o.strip()]

# Giới hạn chống lạm dụng (đổi bằng env).
MAX_TEXT = int(os.environ.get("MIRA_MAX_TEXT", "2000"))  # ký tự/req
TTS_TIMEOUT = float(os.environ.get("MIRA_TTS_TIMEOUT", "45"))  # giây
RATE_MAX = int(os.environ.get("MIRA_RATE_MAX", "40"))  # số req
RATE_WINDOW = float(os.environ.get("MIRA_RATE_WINDOW", "60"))  # mỗi ... giây / IP

app = FastAPI(title=f"Mira TTS server ({ENGINE})")
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["GET", "POST"],
    allow_headers=["content-type"],
)

# Rate-limit cửa sổ trượt trong-bộ-nhớ (đủ cho server đơn lẻ cá nhân).
_rate_hits: dict[str, list[float]] = {}
_rate_lock = threading.Lock()


def _rate_ok(ip: str) -> bool:
    now = time.monotonic()
    with _rate_lock:
        q = _rate_hits.setdefault(ip, [])
        cutoff = now - RATE_WINDOW
        while q and q[0] < cutoff:
            q.pop(0)
        if len(q) >= RATE_MAX:
            return False
        q.append(now)
        return True


_tts = None
_tts_lock = threading.Lock()


def get_tts():
    """Khởi tạo VieNeu lười + 1 lần (model tự tải từ HuggingFace lần đầu)."""
    global _tts
    with _tts_lock:
        if _tts is None:
            from vieneu import Vieneu  # import muộn để engine khác không cần cài

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


async def edge_synth(text: str, voice: str | None) -> bytes:
    """Edge neural → MP3 (stream từ Microsoft, gom thành 1 file)."""
    import edge_tts  # import muộn để engine khác không cần cài

    communicate = edge_tts.Communicate(text, voice or DEFAULT_EDGE_VOICE)
    out = bytearray()
    async for chunk in communicate.stream():
        if chunk["type"] == "audio":
            out += chunk["data"]
    if not out:
        raise RuntimeError("edge-tts trả audio rỗng (giọng sai? mất mạng?)")
    return bytes(out)


def vieneu_synth(text: str, voice: str | None) -> bytes:
    """VieNeu → WAV (chạy đồng bộ, blocking — gọi trong threadpool)."""
    engine = get_tts()
    audio = engine.infer(text, voice=voice or DEFAULT_VIENEU_VOICE)
    # API save() ghi file → dùng file tạm rồi đọc bytes (an toàn với mọi định dạng audio).
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
        path = f.name
    try:
        engine.save(audio, path)
        with open(path, "rb") as f:
            return f.read()
    finally:
        try:
            os.unlink(path)
        except OSError:
            pass


class TTSIn(BaseModel):
    text: str
    voice: str | None = None


@app.get("/health")
def health():
    return {"ok": True, "engine": ENGINE}


@app.get("/voices")
def voices():
    if ENGINE == "mock":
        return {"voices": [{"id": "Mock", "label": "Mock"}]}
    if ENGINE == "edge":
        return {"voices": EDGE_VOICES}
    try:
        # VieNeu list_preset_voices() trả tuple (label, name) — chuẩn hoá thành {id, label}
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
async def tts(inp: TTSIn, request: Request):
    ip = request.client.host if request.client else "?"
    if not _rate_ok(ip):
        raise HTTPException(429, "Quá nhiều yêu cầu, thử lại sau chút nhé")

    text = (inp.text or "").strip()
    if not text:
        raise HTTPException(400, "text rỗng")
    if len(text) > MAX_TEXT:
        raise HTTPException(413, f"text quá dài (>{MAX_TEXT} ký tự)")

    if ENGINE == "mock":
        return Response(mock_wav(text), media_type="audio/wav")

    # edge/vieneu: bọc timeout để 1 request treo không giữ kết nối mãi.
    try:
        if ENGINE == "edge":
            data = await asyncio.wait_for(edge_synth(normalize(text), inp.voice), TTS_TIMEOUT)
            return Response(data, media_type="audio/mpeg")
        # vieneu (mặc định) — blocking nên chạy trong threadpool để không nghẽn event loop.
        data = await asyncio.wait_for(
            asyncio.to_thread(vieneu_synth, normalize(text), inp.voice), TTS_TIMEOUT
        )
        return Response(data, media_type="audio/wav")
    except asyncio.TimeoutError:
        raise HTTPException(504, f"TTS quá {TTS_TIMEOUT:.0f}s, đã huỷ")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"{ENGINE} lỗi: {str(e)[:300]}")
