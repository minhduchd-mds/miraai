"""Per-frame voice features for scripts/media/render-talking.mjs, mirroring the app's
AnalyserNode path (src/core/audio-level.ts): RMS × 3.2 and low/mid/high band energies
(120–450, 450–1600, 1600–4000 Hz) from byte-scaled dB spectra (−100…−30 dB).
Usage: envelope.py audio.wav fps → JSON [{level, low, mid, high}, …]"""
import json, sys, wave
import numpy as np

path, fps = sys.argv[1], float(sys.argv[2])
w = wave.open(path)
sr, ch, width = w.getframerate(), w.getnchannels(), w.getsampwidth()
raw = w.readframes(w.getnframes()); w.close()
x = np.frombuffer(raw, np.int16 if width == 2 else np.uint8).astype(np.float32)
if width == 1: x = (x - 128) * 256
if ch > 1: x = x.reshape(-1, ch).mean(axis=1)
x /= 32768.0
n = 512 if sr <= 24000 else 1024          # ≈ 21 ms, like fftSize 512 at 24–48 kHz
win = np.blackman(n)
freqs = np.fft.rfftfreq(n, 1 / sr)
def band(db, lo, hi):
    m = (freqs >= lo) & (freqs < hi)
    return float(db[m].mean()) if m.any() else 0.0
out = []
for i in range(int(len(x) / sr * fps)):
    c = int(i / fps * sr)
    seg = x[max(0, c - n // 2): c + n // 2]
    if len(seg) < n: seg = np.pad(seg, (0, n - len(seg)))
    level = min(1.0, float(np.sqrt(np.mean(seg ** 2))) * 3.2)
    mag = np.abs(np.fft.rfft(seg * win)) / n
    db = np.clip((20 * np.log10(mag + 1e-12) + 100) / 70, 0, 1)
    out.append({'level': round(level, 4), 'low': round(band(db, 120, 450), 4), 'mid': round(band(db, 450, 1600), 4), 'high': round(band(db, 1600, 4000), 4)})
print(json.dumps(out))
