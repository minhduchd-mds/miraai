"""Render a still portrait to a short Y4M clip for Chromium's fake camera (CI experiment E8)."""
import sys
from PIL import Image

src, dst = sys.argv[1], sys.argv[2]
seconds, fps = 6, 15
img = Image.open(src).convert('RGB')
w = 640
h = int(img.height * w / img.width) // 2 * 2
img = img.resize((w, h))
y, cb, cr = img.convert('YCbCr').split()
cb = cb.resize((w // 2, h // 2)); cr = cr.resize((w // 2, h // 2))
frame = y.tobytes() + cb.tobytes() + cr.tobytes()
with open(dst, 'wb') as f:
    f.write(f'YUV4MPEG2 W{w} H{h} F{fps}:1 Ip A1:1 C420jpeg\n'.encode())
    for _ in range(seconds * fps):
        f.write(b'FRAME\n'); f.write(frame)
print(f'{dst}: {w}x{h}, {seconds * fps} frames')
