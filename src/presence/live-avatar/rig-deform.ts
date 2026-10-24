// Mira LiveAvatar — pure mesh deformation (no DOM, no WebGL) so Node tests run it directly.
// A single frontal portrait + MediaPipe Face Mesh rig (scripts/live-avatar/build-rig.py) is
// warped every frame: jaw/lips from audio, eyelids for blinks, irises for gaze, brows, and a
// pseudo-3D head pose using landmark depth for parallax. Coordinates are image pixels.

export interface LiveAvatarRig {
  schema: 'mira.live-avatar.rig.v1';
  image: { width: number; height: number };
  faceHeight: number;
  center: [number, number];
  vertices: number[]; // x,y,z triplets; x,y normalized to the image, z MediaPipe depth
  headWeight: number[];
  breathWeight: number[];
  triangles: number[];
  mouthTriangles: number[];
  groups: Record<string, number[]>;
}

export interface FaceParams {
  jaw: number;      // 0 closed … 1 wide open
  round: number;    // 0 … 1 lips pucker ("o/u")
  spread: number;   // 0 … 1 lips stretch ("i/e")
  smile: number;    // 0 … 1
  blinkL: number;   // 0 open … 1 closed
  blinkR: number;
  gazeX: number;    // -1 … 1
  gazeY: number;
  brow: number;     // -1 frown … 1 raise
  yaw: number;      // radians, small (±0.08)
  pitch: number;
  roll: number;
  breath: number;   // -1 … 1
}

export const NEUTRAL_FACE: Readonly<FaceParams> = Object.freeze({
  jaw: 0, round: 0, spread: 0, smile: 0, blinkL: 0, blinkR: 0, gazeX: 0, gazeY: 0, brow: 0, yaw: 0, pitch: 0, roll: 0, breath: 0,
});

export interface PreparedRig {
  rig: LiveAvatarRig;
  count: number;
  rest: Float32Array;      // pixel x,y
  depth: Float32Array;     // relative depth, larger = closer to camera
  uv: Float32Array;        // texture coords 0..1
  jawW: Float32Array;      // lower-face opening weight
  upperLipW: Float32Array; // small upward lift of the upper lip
  lipW: Float32Array;      // horizontal lip shaping weight
  cheekW: Float32Array;    // zygomatic cheek mass (smile lift, stretch on opening)
  cheekSide: Float32Array; // -1 left / +1 right of the mouth
  headW: Float32Array;
  breathW: Float32Array;
  faceH: number;           // pixels
  mouth: { x: number; y: number; halfWidth: number };
  pivot: { x: number; y: number };
  eyes: Array<{ iris: number[]; side: 'L' | 'R'; region: Int32Array; closeBy: Float32Array }>;
  brows: number[];
  irisRadius: number;
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

export function prepareRig(rig: LiveAvatarRig): PreparedRig {
  if (rig.schema !== 'mira.live-avatar.rig.v1') throw new Error('unsupported_rig');
  const { width: w, height: h } = rig.image;
  const count = rig.vertices.length / 3;
  const rest = new Float32Array(count * 2);
  const depth = new Float32Array(count);
  const uv = new Float32Array(count * 2);
  for (let i = 0; i < count; i += 1) {
    const x = rig.vertices[i * 3], y = rig.vertices[i * 3 + 1], z = rig.vertices[i * 3 + 2];
    rest[i * 2] = x * w; rest[i * 2 + 1] = y * h;
    uv[i * 2] = x; uv[i * 2 + 1] = y;
    depth[i] = -z; // MediaPipe: negative z = towards the camera
  }
  const g = rig.groups;
  const faceH = rig.faceHeight * h;
  const px = (i: number) => rest[i * 2];
  const py = (i: number) => rest[i * 2 + 1];
  const corners = g.corners;
  const mouthX = (px(corners[0]) + px(corners[1])) / 2;
  const mouthY = (py(13) + py(14)) / 2;
  const halfWidth = Math.abs(px(corners[1]) - px(corners[0])) / 2;
  const chinY = py(152);
  const faceCx = rig.center[0] * w;
  const halfFaceW = faceH * 0.42;

  const jawW = new Float32Array(count);
  const upperLipW = new Float32Array(count);
  const lipW = new Float32Array(count);
  const cheekW = new Float32Array(count);
  const cheekSide = new Float32Array(count);
  // Cheeks span from beside the nose wings to past the mouth corners, between the lower lids and
  // just below the mouth line; a smooth bump so the skin moves as one mass (no folds).
  const lidY = (py(145) + py(374)) / 2;
  const cheekTop = lidY + faceH * 0.06, cheekBottom = mouthY + faceH * 0.08;
  const lowerLips = new Set([...g.lowerInner, ...g.lowerOuter]);
  const upperLips = new Set([...g.upperInner, ...g.upperOuter]);
  const chin = new Set(g.chin);
  // Lips part like a lens, not a box: full opening at the centre, closed at the corners.
  const lens = (x: number) => {
    const d = Math.min(1, Math.abs(x - mouthX) / Math.max(1, halfWidth));
    return 1 - d * d * 0.92;
  };
  for (let i = 0; i < count; i += 1) {
    const x = px(i), y = py(i);
    if (i < 478) {
      if (lowerLips.has(i) && !upperLips.has(i)) jawW[i] = lens(x);
      else if (y > mouthY + 1) {
        // Below the mouth line: the lower face follows the jaw, fading towards the ears; skin right
        // beside the lip corners follows the lens profile so it never folds over the corners.
        const along = clamp01((y - mouthY) / Math.max(1, chinY - mouthY));
        const across = clamp01(1 - Math.abs(x - faceCx) / halfFaceW);
        const nearMouth = clamp01(1 - (y - mouthY) / (faceH * 0.16));
        const sideOfMouth = clamp01((Math.abs(x - mouthX) - halfWidth * 0.6) / (halfWidth * 0.9));
        const taper = 1 - nearMouth * sideOfMouth * 0.75;
        jawW[i] = (0.5 + 0.45 * along) * (0.35 + 0.65 * across) * (chin.has(i) ? 1.08 : 1) * taper;
      }
      if (upperLips.has(i) && !lowerLips.has(i)) upperLipW[i] = (g.upperInner.includes(i) ? 1 : 0.5) * lens(x);
      if (!lowerLips.has(i) && !upperLips.has(i) && y > cheekTop && y < cheekBottom) {
        const ax = Math.abs(x - mouthX) / Math.max(1, halfWidth);
        const across = clamp01((ax - 0.35) / 0.5) * clamp01((2.6 - ax) / 0.9);
        const vert = Math.sin(Math.PI * clamp01((y - cheekTop) / (cheekBottom - cheekTop)));
        cheekW[i] = across * vert;
        cheekSide[i] = x < mouthX ? -1 : 1;
      }
      if (lowerLips.has(i) || upperLips.has(i)) lipW[i] = 1;
      else if (Math.abs(y - mouthY) < faceH * 0.12) {
        // Cheek skin next to the corners follows pucker/stretch so no gap opens at the corners.
        const beyond = Math.abs(x - mouthX) - halfWidth;
        if (beyond > -halfWidth * 0.2) lipW[i] = clamp01(1 - beyond / (halfWidth * 0.55)) * 0.85;
      }
    } else if (y > mouthY && rig.headWeight[i] > 0) {
      // Halo below the mouth (neck/jaw outline) moves a little so the jaw never tears.
      jawW[i] = 0.3 * rig.headWeight[i];
    }
  }

  // Blink as a monotonic vertical squash per eye: for a vertex at height h above the lower-lid
  // curve, h' = h·(1 − b·k(h)) with k = 1 inside the eye opening, fading to 0 at the lid crease.
  // Monotonic in h for every column ⇒ no triangle can fold, whatever the blink amount.
  const eyes = ([
    // MediaPipe eye corners (33/133 left, 263/362 right) close the lower-lid curve.
    { upper: g.leftEyeUpper, lower: [...g.leftEyeLower, 33, 133], iris: g.irisLeft, side: 'L' as const },
    { upper: g.rightEyeUpper, lower: [...g.rightEyeLower, 263, 362], iris: g.irisRight, side: 'R' as const },
  ]).map((eye) => {
    const lower = [...eye.lower].sort((a, b) => px(a) - px(b));
    const lowerY = (x: number) => {
      if (x <= px(lower[0])) return py(lower[0]);
      for (let k = 1; k < lower.length; k += 1) {
        const a = lower[k - 1], b = lower[k];
        if (x <= px(b)) return py(a) + (py(b) - py(a)) * ((x - px(a)) / Math.max(1e-6, px(b) - px(a)));
      }
      return py(lower[lower.length - 1]);
    };
    const xs = [...eye.upper, ...eye.lower].map(px);
    const minX = Math.min(...xs), maxX = Math.max(...xs), eyeW = maxX - minX;
    const h0 = Math.max(...eye.upper.map((u) => lowerY(px(u)) - py(u)), 1);
    const h1 = h0 * 2.2;
    const region: number[] = [], close: number[] = [];
    for (let i = 0; i < 478; i += 1) {
      const x = px(i), h = lowerY(x) - py(i);
      if (h <= 0 || h >= h1) continue;
      const outside = x < minX ? minX - x : x > maxX ? x - maxX : 0;
      const wx = clamp01(1 - outside / (eyeW * 0.3));
      if (!wx) continue;
      const k = h <= h0 ? 1 : (h1 - h) / (h1 - h0);
      region.push(i);
      close.push(h * k * wx); // pixels moved down at full blink
    }
    return { iris: eye.iris, side: eye.side, region: Int32Array.from(region), closeBy: Float32Array.from(close) };
  });
  const irisRadius = Math.hypot(px(g.irisLeft[1]) - px(g.irisLeft[3]), py(g.irisLeft[1]) - py(g.irisLeft[3])) / 2 || faceH * 0.03;

  return {
    rig, count, rest, depth, uv, jawW, upperLipW, lipW, cheekW, cheekSide,
    headW: Float32Array.from(rig.headWeight),
    breathW: Float32Array.from(rig.breathWeight),
    faceH,
    mouth: { x: mouthX, y: mouthY, halfWidth },
    pivot: { x: faceCx, y: chinY + faceH * 0.35 },
    eyes,
    brows: [...g.leftBrow, ...g.rightBrow],
    irisRadius,
  };
}

/**
 * Writes deformed pixel positions into `out` (length = count * 2) and returns the mouth
 * opening in pixels (used by the cavity shader). Allocation-free for the render loop.
 */
export function deformRig(prep: PreparedRig, p: FaceParams, out: Float32Array): number {
  const { rest, count, faceH, mouth } = prep;
  out.set(rest);
  const jaw = clamp01(p.jaw);
  const openPx = jaw * faceH * 0.092; // 24/10: wider articulation (fold-free verified in tests)

  // Lips, jaw and chin. Opening an "a" draws the corners in slightly (orbicularis).
  const smile = clamp01(p.smile), spread = clamp01(p.spread), round = clamp01(p.round);
  const shape = 1 - 0.12 * round + 0.08 * spread + 0.04 * smile - 0.05 * jaw;
  for (let i = 0; i < count; i += 1) {
    const ix = i * 2, iy = ix + 1;
    if (prep.jawW[i]) out[iy] += openPx * prep.jawW[i];
    // Upper lip lifts with the opening and on spread vowels ("i/e"), showing the teeth.
    if (prep.upperLipW[i]) out[iy] -= (openPx * 0.18 + spread * faceH * 0.006) * prep.upperLipW[i];
    // Cheeks: lift and widen with a smile (deepening the nasolabial line), stretch down a little
    // as the jaw opens, and draw in on a pucker.
    const cw = prep.cheekW[i];
    if (cw) {
      out[iy] += (-smile * faceH * 0.016 + openPx * 0.16 + round * faceH * 0.002) * cw;
      out[ix] += prep.cheekSide[i] * (smile * faceH * 0.006 - round * faceH * 0.006) * cw;
    }
    const lw = prep.lipW[i];
    if (lw) {
      const dx = rest[ix] - mouth.x;
      out[ix] += dx * (shape - 1) * lw;
      const reach = Math.min(1, Math.abs(dx) / Math.max(1, mouth.halfWidth));
      // Smile lifts the corners proportionally to their distance from the centre.
      out[iy] -= clamp01(p.smile) * faceH * 0.012 * reach * lw;
      // Puckered lips push slightly down at the centre.
      out[iy] += clamp01(p.round) * faceH * 0.004 * (1 - reach) * lw;
    }
  }

  // Eyelids (monotonic squash, see prepareRig) and irises.
  // Gaze amplitude is capped at the largest shift that never pushes an iris through a lid
  // (verified fold-free at ±1 by scripts/live-avatar.test.mjs).
  const gazeShiftX = Math.max(-1, Math.min(1, p.gazeX)) * prep.irisRadius * 0.16;
  const gazeShiftY = Math.max(-1, Math.min(1, p.gazeY)) * prep.irisRadius * 0.24;
  for (const eye of prep.eyes) {
    const blink = clamp01(eye.side === 'L' ? p.blinkL : p.blinkR) * 0.95;
    if (blink) for (let k = 0; k < eye.region.length; k += 1) out[eye.region[k] * 2 + 1] += eye.closeBy[k] * blink;
    const open = (1 - blink) ** 3; // irises are hidden as the lids close; never push them through a lid
    for (let k = 0; k < eye.iris.length; k += 1) {
      // Centre moves fully; rim points (which touch the lids) move less, so the iris slides
      // under the lids instead of pushing through them.
      const w = (k === 0 ? 1 : 0.6) * open, iris = eye.iris[k];
      out[iris * 2] += gazeShiftX * w;
      out[iris * 2 + 1] += gazeShiftY * w;
    }
  }

  // Brows.
  const browPx = -Math.max(-1, Math.min(1, p.brow)) * faceH * 0.022;
  for (const b of prep.brows) out[b * 2 + 1] += browPx;

  // Breathing (shoulders/neck only).
  const breathPx = -p.breath * faceH * 0.012;
  for (let i = 0; i < count; i += 1) if (prep.breathW[i]) out[i * 2 + 1] += breathPx * prep.breathW[i];

  // Head pose: roll about the neck pivot, yaw/pitch as depth parallax (closer points move more).
  const cos = Math.cos(p.roll), sin = Math.sin(p.roll);
  const { x: cx, y: cy } = prep.pivot;
  for (let i = 0; i < count; i += 1) {
    const w = prep.headW[i];
    if (!w) continue;
    const ix = i * 2, iy = ix + 1;
    const x = out[ix] - cx, y = out[iy] - cy;
    const rx = cx + x * cos - y * sin, ry = cy + x * sin + y * cos;
    const parallax = 0.35 + 1.2 * Math.max(0, prep.depth[i]);
    out[ix] += ((rx + p.yaw * faceH * parallax) - out[ix]) * w;
    out[iy] += ((ry + p.pitch * faceH * parallax * 0.8) - out[iy]) * w;
  }
  return openPx;
}

/** Map audio features to mouth shape. Bands are normalised energies (0..1). */
export function visemeFromAudio(level: number, bands: { low: number; mid: number; high: number } | null) {
  const amp = clamp01(level);
  if (!bands) return { jaw: amp, round: 0, spread: 0 };
  const total = bands.low + bands.mid + bands.high + 1e-6;
  const low = bands.low / total, high = bands.high / total;
  return {
    jaw: clamp01(amp * (0.8 + 0.4 * (bands.mid / total))),
    round: clamp01((low - 0.42) * 2.2) * amp,
    spread: clamp01((high - 0.28) * 2.4) * amp,
  };
}
