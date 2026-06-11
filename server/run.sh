#!/bin/bash
# Chạy Mira TTS server (giọng thật). Mock: ./run.sh mock
cd "$(dirname "$0")"

if [ ! -d .venv ]; then
  echo "→ Tạo venv + cài đặt lần đầu..."
  python3 -m venv .venv
  ./.venv/bin/pip install -r requirements.txt
  [ "$1" != "mock" ] && ./.venv/bin/pip install vieneu vinorm
fi

if [ "$1" = "mock" ]; then
  echo "→ MOCK mode (WAV beep, không cần model)"
  VIENEU_MOCK=1 exec ./.venv/bin/uvicorn main:app --port 8017
else
  echo "→ Giọng thật VieNeu (lần đầu sẽ tải model từ HuggingFace)"
  exec ./.venv/bin/uvicorn main:app --port 8017
fi
