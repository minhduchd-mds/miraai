export type FacialGesture =
  | 'none'
  | 'smile'
  | 'frown'
  | 'wink_left'
  | 'wink_right'
  | 'brow_raise'
  | 'mouth_open'
  | 'squint';

export interface FacialGestureSample {
  smile?: number;
  frown?: number;
  browUp?: number;
  jaw?: number;
  blinkL?: number;
  blinkR?: number;
  cheekSquint?: number;
  eyeWide?: number;
}

export interface FacialGestureResult {
  gesture: FacialGesture;
  confidence: number;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

export function inferFacialGesture(sample: FacialGestureSample): FacialGestureResult {
  const smile = clamp01(sample.smile || 0);
  const frown = clamp01(sample.frown || 0);
  const browUp = clamp01(sample.browUp || 0);
  const jaw = clamp01(sample.jaw || 0);
  const blinkL = clamp01(sample.blinkL || 0);
  const blinkR = clamp01(sample.blinkR || 0);
  const cheek = clamp01(sample.cheekSquint || 0);
  const eyeWide = clamp01(sample.eyeWide || 0);
  const avgBlink = (blinkL + blinkR) / 2;

  const scores: Record<Exclude<FacialGesture, 'none'>, number> = {
    wink_left: clamp01(blinkL * 0.86 + (1 - blinkR) * 0.14),
    wink_right: clamp01(blinkR * 0.86 + (1 - blinkL) * 0.14),
    smile: clamp01(smile * 0.9 + cheek * 0.18),
    frown: clamp01(frown * 0.92),
    brow_raise: clamp01(browUp * 0.82 + eyeWide * 0.18),
    mouth_open: clamp01(jaw * 0.95),
    squint: clamp01(cheek * 0.7 + avgBlink * 0.18 + (1 - eyeWide) * 0.12),
  };

  if (blinkL > 0.66 && blinkR < 0.34) scores.wink_left = Math.max(scores.wink_left, 0.82);
  if (blinkR > 0.66 && blinkL < 0.34) scores.wink_right = Math.max(scores.wink_right, 0.82);

  const ranked = Object.entries(scores)
    .sort((a, b) => b[1] - a[1]) as Array<[Exclude<FacialGesture, 'none'>, number]>;
  const [gesture, top] = ranked[0];
  const second = ranked[1]?.[1] || 0;
  const confidence = clamp01(top * 0.84 + Math.max(0, top - second) * 0.38);

  if (top < 0.42 || confidence < 0.38) return { gesture: 'none', confidence: 0 };
  return { gesture, confidence };
}
