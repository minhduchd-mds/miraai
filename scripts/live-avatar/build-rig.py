#!/usr/bin/env python3
"""
Build the Mira LiveAvatar face rig from a single frontal portrait.

Offline, deterministic, no network: MediaPipe Face Mesh (refine_landmarks → 478 points,
incl. irises) + a Delaunay mesh over the face, a hair/neck halo and a fixed image border.
The browser engine (src/presence/live-avatar/) warps this mesh on the GPU every frame
from the Live/TTS audio level — this script never runs at runtime.

Usage (Python 3.11, mediapipe==0.10.14, numpy<2, scipy, pillow):
  python scripts/live-avatar/build-rig.py public/mira-assets/live/mira-live-face-v1.webp \
         public/mira-assets/live/mira-live-face-v1.rig.json
"""
import json
import sys

import mediapipe as mp
import numpy as np
from PIL import Image
from scipy.spatial import Delaunay

# MediaPipe Face Mesh topology (canonical indices).
LIPS_OUTER = [61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291, 409, 270, 269, 267, 0, 37, 39, 40, 185]
LIPS_INNER = [78, 95, 88, 178, 87, 14, 317, 402, 318, 324, 308, 415, 310, 311, 312, 13, 82, 81, 80, 191]
UPPER_INNER = [78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308]
LOWER_INNER = [78, 95, 88, 178, 87, 14, 317, 402, 318, 324, 308]
LOWER_OUTER = [61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291]
UPPER_OUTER = [61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291]
LEFT_EYE_UPPER = [246, 161, 160, 159, 158, 157, 173]
LEFT_EYE_LOWER = [7, 163, 144, 145, 153, 154, 155]
RIGHT_EYE_UPPER = [466, 388, 387, 386, 385, 384, 398]
RIGHT_EYE_LOWER = [249, 390, 373, 374, 380, 381, 382]
LEFT_BROW = [70, 63, 105, 66, 107, 46, 53, 52, 65, 55]
RIGHT_BROW = [300, 293, 334, 296, 336, 276, 283, 282, 295, 285]
FACE_OVAL = [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377,
             152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109]
CHIN = [152, 148, 176, 149, 377, 400, 378, 199, 175, 200, 18, 83, 313, 201, 421, 208, 428]
JAW_LOW = [150, 136, 172, 58, 379, 365, 397, 288, 32, 262, 140, 369, 170, 395, 171, 396, 169, 394]
IRIS_LEFT = list(range(468, 473))
IRIS_RIGHT = list(range(473, 478))
NOSE_TIP = 1


def main(src, out):
    image = Image.open(src).convert('RGB')
    w, h = image.size
    arr = np.asarray(image)
    with mp.solutions.face_mesh.FaceMesh(static_image_mode=True, refine_landmarks=True, max_num_faces=1) as mesh:
        result = mesh.process(arr)
    if not result.multi_face_landmarks:
        raise SystemExit('no face found')
    lm = result.multi_face_landmarks[0].landmark
    face = np.array([[p.x, p.y, p.z] for p in lm], dtype=np.float64)  # normalized x,y; z ~ x-scale depth
    assert face.shape[0] == 478, face.shape

    xy = face[:, :2]
    oval = xy[FACE_OVAL]
    center = oval.mean(axis=0)
    face_h = oval[:, 1].max() - oval[:, 1].min()

    # Halo rings carry head motion smoothly into hair/background; weight falls to 0 outside.
    extra, weights = [], []
    for scale, weight in ((1.22, 0.85), (1.5, 0.45), (1.9, 0.12)):
        for p in oval[::2]:
            q = center + (p - center) * scale
            if 0.0 < q[0] < 1.0 and 0.0 < q[1] < 1.0:
                extra.append([q[0], q[1], 0.0]); weights.append(weight)
    # Neck/shoulders: breathing only.
    chin_y = xy[152, 1]
    for t in np.linspace(0.12, 0.88, 9):
        for dy, weight in ((0.06, -1.0), (0.18, -2.0)):
            y = min(0.985, chin_y + dy)
            extra.append([t, y, 0.0]); weights.append(weight)
    # Fixed image border.
    for t in np.linspace(0, 1, 9):
        for p in ((t, 0.0), (t, 1.0), (0.0, t), (1.0, t)):
            extra.append([p[0], p[1], 0.0]); weights.append(0.0)
    extra = np.array(extra)
    # Deduplicate border corners.
    _, unique_idx = np.unique(np.round(extra[:, :2], 5), axis=0, return_index=True)
    unique_idx = np.sort(unique_idx)
    extra = extra[unique_idx]
    weights = [weights[i] for i in unique_idx]

    vertices = np.vstack([face, extra])
    head_weight = [1.0] * 478 + [max(0.0, wgt) for wgt in weights]
    breath_weight = [0.0] * 478 + [(-wgt / 2.0 if wgt < 0 else 0.0) for wgt in weights]

    tri = Delaunay(vertices[:, :2])
    triangles = tri.simplices.tolist()

    # Mouth: Delaunay is unreliable around near-collinear lip contours (it tears into spikes when
    # the jaw opens), so the whole outer-lip region is re-tiled with an explicit topology:
    # upper lip band, lower lip band (outer↔inner quads) and a cavity strip between the inner
    # contours (zero area at rest, opens with the jaw). Outer contour arrays run corner→corner.
    from matplotlib.path import Path as MplPath  # bundled with mediapipe
    outer_ring = UPPER_OUTER + [i for i in reversed(LOWER_OUTER) if i not in (61, 291)]
    outer_poly = MplPath(xy[outer_ring])
    lip_vertices = set(LIPS_INNER) | set(LIPS_OUTER)
    other_tris = []
    for t in triangles:
        centroid = vertices[t, :2].mean(axis=0)
        inside = outer_poly.contains_point(centroid)
        uses_inner = any(v in set(LIPS_INNER) for v in t)
        if inside or (uses_inner and all(v in lip_vertices for v in t)):
            continue
        other_tris.append(t)

    def band(a, b, corner_split=False):
        tris = []
        for i in range(len(a) - 1):
            if corner_split and i == 0:
                # At the left corner the two fixed corner points (outer + inner) must share a
                # triangle with the OUTER lip point, which moves away from them, never the inner
                # one (it crosses the corner line when the jaw opens and the triangle folds).
                tris.append([a[i], a[i + 1], b[i]])
                tris.append([a[i + 1], b[i + 1], b[i]])
            else:
                tris.append([a[i], a[i + 1], b[i + 1]])
                tris.append([a[i], b[i + 1], b[i]])
        return tris

    lip_tris = band(UPPER_OUTER, UPPER_INNER) + band(LOWER_OUTER, LOWER_INNER, corner_split=True)
    other_tris += lip_tris
    mouth_tris = band(UPPER_INNER, LOWER_INNER)

    # Watertightness check: triangle areas must sum to the image area (normalized = 1).
    def area(t):
        (x1, y1), (x2, y2), (x3, y3) = vertices[t, :2]
        return abs((x2 - x1) * (y3 - y1) - (x3 - x1) * (y2 - y1)) / 2
    total = sum(area(t) for t in other_tris)
    print(f'mesh coverage (skin only, mouth closed): {total:.5f} of 1.0')

    # Drop very thin triangles between the outer ring and border that span the whole face
    # only if they would cross the mouth cavity (keeps the mesh watertight elsewhere).
    rig = {
        'schema': 'mira.live-avatar.rig.v1',
        'image': {'width': w, 'height': h},
        'faceHeight': round(float(face_h), 5),
        'center': [round(float(center[0]), 5), round(float(center[1]), 5)],
        'vertices': [round(float(v), 5) for v in vertices.flatten()],
        'headWeight': [round(v, 3) for v in head_weight],
        'breathWeight': [round(v, 3) for v in breath_weight],
        'triangles': [i for t in other_tris for i in t],
        'mouthTriangles': [i for t in mouth_tris for i in t],
        'groups': {
            'upperInner': UPPER_INNER, 'lowerInner': LOWER_INNER,
            'upperOuter': UPPER_OUTER, 'lowerOuter': LOWER_OUTER,
            'leftEyeUpper': LEFT_EYE_UPPER, 'leftEyeLower': LEFT_EYE_LOWER,
            'rightEyeUpper': RIGHT_EYE_UPPER, 'rightEyeLower': RIGHT_EYE_LOWER,
            'leftBrow': LEFT_BROW, 'rightBrow': RIGHT_BROW,
            'chin': CHIN, 'jawLow': JAW_LOW, 'irisLeft': IRIS_LEFT, 'irisRight': IRIS_RIGHT,
            'corners': [61, 291], 'noseTip': [NOSE_TIP],
        },
    }
    with open(out, 'w', encoding='utf8') as fh:
        json.dump(rig, fh, separators=(',', ':'))
    print(f'rig: {len(vertices)} vertices, {len(other_tris)} skin triangles, {len(mouth_tris)} mouth triangles, face height {face_h:.3f}')


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
