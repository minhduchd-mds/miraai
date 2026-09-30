export type PhotorealVisualQuality = 'lite' | 'balanced' | 'high' | 'ultra';

export interface PhotorealVisualCapability {
  dpr: number;
  width: number;
  height: number;
  hardwareConcurrency: number;
  deviceMemoryGb: number;
  reducedMotion: boolean;
}

export interface PhotorealClarityProfile {
  quality: PhotorealVisualQuality;
  renderDpr: number;
  sharpness: number;
  contrast: number;
  saturation: number;
  brightness: number;
  farBlurPx: number;
  midOpacity: number;
  nearOpacity: number;
  hazeOpacity: number;
  grainOpacity: number;
}

export interface PhotorealDepthInput {
  pointerX: number;
  pointerY: number;
  gazeX: number;
  gazeY: number;
  attention: number;
  quality: PhotorealVisualQuality;
}

export interface PhotorealDepthFrame {
  backX: number;
  backY: number;
  midX: number;
  midY: number;
  nearX: number;
  nearY: number;
  tiltXDeg: number;
  tiltYDeg: number;
}

export interface PhotorealCameraPoseInput {
  enabled: boolean;
  yaw: number;
  pitch: number;
  roll: number;
  distanceM: number;
  baselineDistanceM: number;
  confidence: number;
  quality: PhotorealVisualQuality;
}

export interface PhotorealCameraSpatialFrame {
  roomX: number;
  roomY: number;
  subjectX: number;
  subjectY: number;
  foregroundX: number;
  foregroundY: number;
  rotateXDeg: number;
  rotateYDeg: number;
  rollDeg: number;
  scale: number;
  shadowX: number;
  intensity: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Number.isFinite(value) ? value : 0));
}

function clamp01(value: number): number {
  return clamp(value, 0, 1);
}

/**
 * Selects a visual quality tier from display density and device capability.
 *
 * The result is presentation-only. It never changes perception/AI state and is
 * intentionally conservative on low-memory/mobile devices.
 */
export function resolvePhotorealVisualQuality(
  capability: PhotorealVisualCapability,
): PhotorealVisualQuality {
  const dpr = clamp(capability.dpr, 1, 3);
  const pixels = Math.max(1, capability.width) * Math.max(1, capability.height) * dpr * dpr;
  const cores = Math.max(1, capability.hardwareConcurrency || 1);
  const memory = Math.max(0, capability.deviceMemoryGb || 0);

  if (capability.reducedMotion) {
    return cores >= 6 && (memory === 0 || memory >= 6) ? 'high' : 'balanced';
  }
  if (cores >= 8 && (memory === 0 || memory >= 8) && pixels <= 18_000_000) return 'ultra';
  if (cores >= 6 && (memory === 0 || memory >= 4) && pixels <= 14_000_000) return 'high';
  if (cores >= 4 && pixels <= 10_000_000) return 'balanced';
  return 'lite';
}

export function clarityProfile(
  quality: PhotorealVisualQuality,
  dpr: number,
  attention = 0,
): PhotorealClarityProfile {
  const focus = clamp01(attention);
  const density = clamp(dpr, 1, 3);

  const base: Record<PhotorealVisualQuality, Omit<PhotorealClarityProfile, 'quality'>> = {
    lite: {
      renderDpr: 1,
      sharpness: 0,
      contrast: 1.018,
      saturation: 1.005,
      brightness: 0.985,
      farBlurPx: 0,
      midOpacity: 0,
      nearOpacity: 0,
      hazeOpacity: 0.08,
      grainOpacity: 0,
    },
    balanced: {
      renderDpr: Math.min(1.25, density),
      sharpness: 0.14,
      contrast: 1.025,
      saturation: 1.012,
      brightness: 0.99,
      farBlurPx: 0.35,
      midOpacity: 0.11,
      nearOpacity: 0.12,
      hazeOpacity: 0.07,
      grainOpacity: 0.012,
    },
    high: {
      renderDpr: Math.min(1.6, density),
      sharpness: 0.2,
      contrast: 1.032,
      saturation: 1.018,
      brightness: 0.995,
      farBlurPx: 0.48,
      midOpacity: 0.15,
      nearOpacity: 0.17,
      hazeOpacity: 0.06,
      grainOpacity: 0.014,
    },
    ultra: {
      renderDpr: Math.min(2, density),
      sharpness: 0.24,
      contrast: 1.038,
      saturation: 1.022,
      brightness: 1,
      farBlurPx: 0.56,
      midOpacity: 0.18,
      nearOpacity: 0.2,
      hazeOpacity: 0.052,
      grainOpacity: 0.016,
    },
  };

  const profile = base[quality];
  return {
    quality,
    ...profile,
    sharpness: clamp(profile.sharpness + focus * 0.025, 0, 0.28),
    contrast: clamp(profile.contrast + focus * 0.008, 1, 1.06),
  };
}

/**
 * Computes small multi-plane parallax offsets. Values are CSS pixels/degrees
 * and intentionally bounded to avoid camera-like motion sickness.
 */
export function computePhotorealDepthFrame(input: PhotorealDepthInput): PhotorealDepthFrame {
  const pointerX = clamp(input.pointerX, -1, 1);
  const pointerY = clamp(input.pointerY, -1, 1);
  const gazeX = clamp(input.gazeX, -1, 1);
  const gazeY = clamp(input.gazeY, -1, 1);
  const attention = clamp01(input.attention);
  const qualityGain: Record<PhotorealVisualQuality, number> = {
    lite: 0,
    balanced: 0.62,
    high: 0.82,
    ultra: 1,
  };
  const gain = qualityGain[input.quality];
  if (gain === 0) {
    return {
      backX: 0,
      backY: 0,
      midX: 0,
      midY: 0,
      nearX: 0,
      nearY: 0,
      tiltXDeg: 0,
      tiltYDeg: 0,
    };
  }
  const combinedX = pointerX * 0.72 + gazeX * (0.12 + attention * 0.16);
  const combinedY = pointerY * 0.76 + gazeY * (0.1 + attention * 0.14);

  return {
    backX: clamp(combinedX * -1.8 * gain, -1.8, 1.8),
    backY: clamp(combinedY * -1.1 * gain, -1.1, 1.1),
    midX: clamp(combinedX * -3.4 * gain, -3.4, 3.4),
    midY: clamp(combinedY * -2.1 * gain, -2.1, 2.1),
    nearX: clamp(combinedX * -5.2 * gain, -5.2, 5.2),
    nearY: clamp(combinedY * -3.2 * gain, -3.2, 3.2),
    tiltXDeg: clamp(combinedY * 0.36 * gain, -0.36, 0.36),
    tiltYDeg: clamp(combinedX * -0.5 * gain, -0.5, 0.5),
  };
}


/**
 * Converts camera head pose into a bounded presentation-only 3D view shift.
 *
 * Inputs are already-smoothed face pose estimates. This function does not
 * infer geometry or physical depth; it only maps head motion to restrained
 * CSS/WebGL presentation offsets. A per-session baseline distance keeps zoom
 * relative to the user's starting position instead of assuming one fixed
 * camera distance.
 */
export function computeCameraSpatialFrame(
  input: PhotorealCameraPoseInput,
): PhotorealCameraSpatialFrame {
  const qualityGain: Record<PhotorealVisualQuality, number> = {
    lite: 0,
    balanced: 0.56,
    high: 0.8,
    ultra: 1,
  };
  const gain = qualityGain[input.quality];
  const confidence = clamp01(input.confidence);

  if (!input.enabled || confidence < 0.42 || gain === 0) {
    return {
      roomX: 0,
      roomY: 0,
      subjectX: 0,
      subjectY: 0,
      foregroundX: 0,
      foregroundY: 0,
      rotateXDeg: 0,
      rotateYDeg: 0,
      rollDeg: 0,
      scale: 1,
      shadowX: 0,
      intensity: 0,
    };
  }

  const yaw = clamp(input.yaw / 0.68, -1, 1);
  const pitch = clamp(input.pitch / 0.52, -1, 1);
  const roll = clamp(input.roll / 0.48, -1, 1);
  const baseline = Number(input.baselineDistanceM || 0);
  const distance = Number(input.distanceM || 0);
  const relativeDepth = baseline > 0.1 && distance > 0.1
    ? clamp((baseline - distance) / Math.max(0.18, baseline * 0.45), -1, 1)
    : 0;
  const intensity = clamp(confidence * gain, 0, 1);

  return {
    roomX: clamp(-yaw * 4.2 * intensity, -4.2, 4.2),
    roomY: clamp(-pitch * 2.8 * intensity, -2.8, 2.8),
    subjectX: clamp(-yaw * 8.4 * intensity, -8.4, 8.4),
    subjectY: clamp(-pitch * 5.6 * intensity, -5.6, 5.6),
    foregroundX: clamp(-yaw * 12.6 * intensity, -12.6, 12.6),
    foregroundY: clamp(-pitch * 8.1 * intensity, -8.1, 8.1),
    rotateXDeg: clamp(-pitch * 1.9 * intensity, -1.9, 1.9),
    rotateYDeg: clamp(yaw * 3.1 * intensity, -3.1, 3.1),
    rollDeg: clamp(-roll * 0.7 * intensity, -0.7, 0.7),
    scale: clamp(1 + relativeDepth * 0.038 * intensity, 0.968, 1.038),
    shadowX: clamp(yaw * 9 * intensity, -9, 9),
    intensity,
  };
}
