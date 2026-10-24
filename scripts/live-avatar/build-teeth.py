"""Mira LiveAvatar — procedural teeth texture (original, no photographic source).

Draws upper and lower dental arches "unrolled" along the arch length, in millimetres,
with anatomical crown widths/heights (central incisor 8.5 × 10.5 mm, lateral 6.5 × 9,
canine 7.5 × 10, premolars 7 × 8, first molar 10 × 7.5). The shader projects them back
onto the curved front view (x = R·sin(s/R)) and lights them, so only the texture is baked
here: crown shape, enamel colour gradient (warm cervical → translucent incisal), soft
interproximal shading, embrasure gaps (alpha 0), faint micro-texture.

Output: public/mira-assets/live/mira-teeth-v1.webp, 1024 × 512 RGBA
  rows   0–255: upper arch, cervical (gum side) at the top, incisal edge downwards
  rows 256–511: lower arch, incisal edge at the top, cervical at the bottom
  columns: arch length −ARCH_HALF … +ARCH_HALF mm (midline at the centre)

Run: python3 scripts/live-avatar/build-teeth.py  (numpy, Pillow; deterministic)
"""
import numpy as np
from PIL import Image

ARCH_HALF = 42.0          # mm of arch length each side of the midline
W, H = 1024, 256          # per arch
SS = 4                    # supersampling
rng = np.random.default_rng(20261024)

# (name, mesio-distal width mm, crown height mm, incisal rounding mm, cusp tip 0..1)
UPPER = [('central', 8.6, 10.6, 1.1, 0.0), ('lateral', 6.6, 9.2, 1.5, 0.0), ('canine', 7.6, 10.2, 1.4, 0.4),
         ('premolar1', 7.0, 8.4, 1.6, 0.45), ('premolar2', 6.6, 7.8, 1.6, 0.4), ('molar1', 10.0, 7.2, 2.0, 0.25)]
LOWER = [('central', 5.3, 8.8, 0.7, 0.0), ('lateral', 5.9, 9.2, 0.8, 0.0), ('canine', 6.9, 10.4, 1.2, 0.35),
         ('premolar1', 7.0, 8.2, 1.4, 0.45), ('premolar2', 7.2, 7.9, 1.4, 0.4), ('molar1', 11.0, 7.4, 2.0, 0.25)]


def smooth(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0, 1)
    return t * t * (3 - 2 * t)


def arch(teeth, crown_ref):
    w, h = W * SS, H * SS
    s = (np.arange(w) + 0.5) / w * 2 * ARCH_HALF - ARCH_HALF      # arch length, mm
    y = (np.arange(h) + 0.5) / h * crown_ref * 1.25                 # mm from cervical line
    S, Y = np.meshgrid(s, y)
    rgb = np.zeros((h, w, 3)); alpha = np.zeros((h, w))
    edges = [0.0]
    for _, width, *_ in teeth: edges.append(edges[-1] + width)
    for side in (-1, 1):
        for k, (_, width, height, rr, cusp) in enumerate(teeth):
            a, b = edges[k], edges[k + 1]
            centre, half = (a + b) / 2, width / 2
            u = (np.abs(S) - centre) / half                         # −1 … 1 across the tooth
            in_side = (np.sign(S) == side) | (S == 0)
            # Crown outline: slightly narrower at the cervical line, rounded incisal corners,
            # canines/premolars with a cusp tip.
            # Neighbouring crowns touch along most of their length (contact points); they narrow
            # only near the gum line (hidden by the lip) and part at small incisal embrasures.
            taper = 1.02 - 0.16 * (1 - smooth(0, height * 0.3, Y))
            width_ok = np.abs(u) < taper
            tip = height - cusp * 0.9 * np.abs(u) ** 1.6            # soft cusp: corners a little shorter
            corner = rr * (1 - np.sqrt(np.clip(1 - np.clip((np.abs(u) - (1 - rr / half)) / (rr / half), 0, 1) ** 2, 0, 1)))
            length = tip - corner
            mask = in_side & width_ok & (Y < length)
            # Soft coverage at the outline (supersampling does the rest).
            edge = smooth(0, 0.18, length - Y) * smooth(-0.02, 0.05, taper - np.abs(u))
            cov = np.where(in_side, edge, 0) * mask
            # Enamel: warm cervical third, bright middle, translucent grey-blue incisal edge.
            t = np.clip(Y / np.maximum(length, 1e-3), 0, 1)
            cervical = np.array([0.88, 0.82, 0.72]); body = np.array([0.94, 0.915, 0.865]); incisal = np.array([0.84, 0.84, 0.85])
            col = (cervical[None, None] * (1 - smooth(0.0, 0.38, t))[..., None]
                   + body[None, None] * (smooth(0.0, 0.38, t) - smooth(0.72, 0.98, t))[..., None]
                   + incisal[None, None] * smooth(0.72, 0.98, t)[..., None])
            # Convex crown: darker towards the interproximal sides; a soft vertical highlight.
            shade = 1 - 0.22 * np.abs(u) ** 2.2 - 0.08 * smooth(0.92, 1.02, np.abs(u))
            highlight = 0.07 * np.exp(-((u + 0.22) / 0.16) ** 2) * smooth(0.15, 0.4, t) * (1 - smooth(0.7, 0.95, t))
            col = col * shade[..., None] + highlight[..., None]
            rgb = np.where(cov[..., None] > alpha[..., None], col, rgb)
            alpha = np.maximum(alpha, cov)
    # Faint enamel micro-texture (perikymata-like horizontal ripples + noise).
    ripple = 0.004 * np.sin(Y * 9.0)
    noise = rng.normal(0, 0.008, (h, w))
    rgb = np.clip(rgb * (1 + ripple + noise)[..., None], 0, 1)
    img = np.dstack([rgb, alpha])
    small = Image.fromarray((img * 255).astype(np.uint8), 'RGBA').resize((W, H), Image.LANCZOS)
    return small


upper = arch(UPPER, 10.6)
lower = arch(LOWER, 10.4).transpose(Image.FLIP_TOP_BOTTOM)  # incisal edge at the top
atlas = Image.new('RGBA', (W, 2 * H))
atlas.paste(upper, (0, 0)); atlas.paste(lower, (0, H))
out = 'public/mira-assets/live/mira-teeth-v1.webp'
atlas.save(out, 'WEBP', quality=90, method=6, exact=True)
print(out, atlas.size)
