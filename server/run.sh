#!/bin/bash
# Chạy Mira TTS server. Chọn engine:
#   ./run.sh edge   → Microsoft Edge (nhẹ, free, giọng tiếng Việt tự nhiên)
#   ./run.sh        → VieNeu self-host (bảo mật cao; lần đầu tải model từ HuggingFace)
#   ./run.sh mock   → WAV beep giả lập (dev UI/lipsync, CI — không cần model/mạng)
cd "$(dirname "$0")"

if [ ! -d .venv ]; then
  echo "→ Tạo venv + cài đặt lần đầu..."
  python3 -m venv .venv
  ./.venv/bin/pip install -r requirements.txt
  # Chỉ engine VieNeu cần model nặng — cài thêm khi không phải edge/mock.
  if [ -z "$1" ] || [ "$1" = "vieneu" ]; then
    ./.venv/bin/pip install vieneu vinorm
  fi
fi

case "$1" in
  edge)
    echo "→ Edge (Microsoft) — giọng tiếng Việt tự nhiên, free"
    MIRA_TTS_ENGINE=edge exec ./.venv/bin/uvicorn main:app --port 8017
    ;;
  mock)
    echo "→ MOCK mode (WAV beep, không cần model/mạng)"
    MIRA_TTS_ENGINE=mock exec ./.venv/bin/uvicorn main:app --port 8017
    ;;
  *)
    echo "→ Giọng thật VieNeu (lần đầu sẽ tải model từ HuggingFace)"
    MIRA_TTS_ENGINE=vieneu exec ./.venv/bin/uvicorn main:app --port 8017
    ;;
esac
