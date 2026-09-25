export interface FACSProxy {
  AU01: number;
  AU02: number;
  AU04: number;
  AU05: number;
  AU06: number;
  AU07: number;
  AU09: number;
  AU10: number;
  AU12: number;
  AU14: number;
  AU15: number;
  AU17: number;
  AU20: number;
  AU23: number;
  AU25: number;
  AU26: number;
  AU45: number;
  activity: number;
  symmetry: number;
}

export const EMPTY_FACS_PROXY: FACSProxy = {
  AU01: 0, AU02: 0, AU04: 0, AU05: 0, AU06: 0, AU07: 0, AU09: 0,
  AU10: 0, AU12: 0, AU14: 0, AU15: 0, AU17: 0, AU20: 0, AU23: 0,
  AU25: 0, AU26: 0, AU45: 0, activity: 0, symmetry: 1,
};

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

function avg(a: number, b: number): number {
  return (a + b) / 2;
}

function pair(bs: Record<string, number>, left: string, right: string): [number, number] {
  return [clamp01(bs[left] || 0), clamp01(bs[right] || 0)];
}

/**
 * MediaPipe blendshapes are ARKit-style, not a validated FACS detector.
 * These values are FACS-like Action Unit proxies for UI and temporal affect fusion only.
 */
export function facsProxyFromBlendshapes(bs: Record<string, number>): FACSProxy {
  const browOuter = pair(bs, 'browOuterUpLeft', 'browOuterUpRight');
  const browDown = pair(bs, 'browDownLeft', 'browDownRight');
  const eyeWide = pair(bs, 'eyeWideLeft', 'eyeWideRight');
  const cheek = pair(bs, 'cheekSquintLeft', 'cheekSquintRight');
  const eyeSquint = pair(bs, 'eyeSquintLeft', 'eyeSquintRight');
  const nose = pair(bs, 'noseSneerLeft', 'noseSneerRight');
  const upperLip = pair(bs, 'mouthUpperUpLeft', 'mouthUpperUpRight');
  const smile = pair(bs, 'mouthSmileLeft', 'mouthSmileRight');
  const dimple = pair(bs, 'mouthDimpleLeft', 'mouthDimpleRight');
  const frown = pair(bs, 'mouthFrownLeft', 'mouthFrownRight');
  const stretch = pair(bs, 'mouthStretchLeft', 'mouthStretchRight');
  const press = pair(bs, 'mouthPressLeft', 'mouthPressRight');
  const blink = pair(bs, 'eyeBlinkLeft', 'eyeBlinkRight');

  const values = [
    clamp01(bs.browInnerUp || 0), ...browOuter, ...browDown, ...eyeWide, ...cheek,
    ...eyeSquint, ...nose, ...upperLip, ...smile, ...dimple, ...frown, ...stretch,
    ...press, ...blink, clamp01(bs.jawOpen || 0),
  ];
  const activity = clamp01(values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length) * 2.2);
  const pairs = [browOuter, browDown, eyeWide, cheek, eyeSquint, nose, smile, dimple, frown, stretch, press, blink];
  const asymmetry = pairs.reduce((sum, [left, right]) => sum + Math.abs(left - right), 0) / pairs.length;

  const jaw = clamp01(bs.jawOpen || 0);
  const mouthClose = clamp01(bs.mouthClose || 0);
  const lowerShrug = clamp01(bs.mouthShrugLower || 0);
  const lowerRoll = clamp01(bs.mouthRollLower || 0);

  return {
    AU01: clamp01(bs.browInnerUp || 0),
    AU02: avg(...browOuter),
    AU04: avg(...browDown),
    AU05: avg(...eyeWide),
    AU06: avg(...cheek),
    AU07: avg(...eyeSquint),
    AU09: avg(...nose),
    AU10: avg(...upperLip),
    AU12: avg(...smile),
    AU14: avg(...dimple),
    AU15: avg(...frown),
    AU17: clamp01(Math.max(lowerShrug, lowerRoll)),
    AU20: avg(...stretch),
    AU23: avg(...press),
    AU25: clamp01(jaw * 0.72 + (1 - mouthClose) * 0.18),
    AU26: jaw,
    AU45: avg(...blink),
    activity,
    symmetry: clamp01(1 - asymmetry * 1.35),
  };
}
