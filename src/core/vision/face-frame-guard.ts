export interface NormalizedFacePoint {
  x: number;
  y: number;
  z: number;
}

export interface FaceFrameSignal {
  usable: boolean;
  landmarks: NormalizedFacePoint[];
  blendshapes: Record<string, number>;
  blendshapesReady: boolean;
}

export function normalizeFaceLandmarks(raw: unknown, limit = 478): NormalizedFacePoint[] {
  if (!Array.isArray(raw) || raw.length < 100) return [];

  let valid = 0;
  const points = raw
    .slice(0, limit)
    .map((point: any) => {
      const rawX = Number(point?.x);
      const rawY = Number(point?.y);
      const rawZ = Number(point?.z);
      if (
        Number.isFinite(rawX) &&
        Number.isFinite(rawY) &&
        rawX >= -0.35 && rawX <= 1.35 &&
        rawY >= -0.35 && rawY <= 1.35
      ) {
        valid += 1;
      }
      return {
        x: Number.isFinite(rawX) ? rawX : 0,
        y: Number.isFinite(rawY) ? rawY : 0,
        z: Number.isFinite(rawZ) ? rawZ : 0,
      };
    });

  return valid >= 100 ? points : [];
}

export function blendshapeMap(categories: unknown): Record<string, number> {
  if (!Array.isArray(categories)) return {};
  const map: Record<string, number> = {};
  for (const category of categories as any[]) {
    const name = String(category?.categoryName || category?.displayName || '').trim();
    if (!name) continue;
    const score = Number(category?.score);
    map[name] = Number.isFinite(score) ? Math.max(0, Math.min(1, score)) : 0;
  }
  return map;
}

/**
 * Face presence is determined from a valid landmark mesh.
 * Blendshapes are an optional enrichment and must never gate face presence.
 */
export function readFaceFrame(result: any): FaceFrameSignal {
  const landmarks = normalizeFaceLandmarks(result?.faceLandmarks?.[0]);
  const blendshapes = blendshapeMap(result?.faceBlendshapes?.[0]?.categories);
  return {
    usable: landmarks.length >= 100,
    landmarks,
    blendshapes,
    blendshapesReady: Object.keys(blendshapes).length > 0,
  };
}
