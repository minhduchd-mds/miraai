export type PhotorealSceneSegmentId =
  | 'window'
  | 'pillow'
  | 'subject'
  | 'bed'
  | 'foreground';

export interface PhotorealSceneSegment {
  id: PhotorealSceneSegmentId;
  depthRank: number;
  opacity: number;
  points: ReadonlyArray<readonly [number, number]>;
  transformOrigin: string;
}

/**
 * Authored segmentation profile for the canonical Mira bedroom source.
 *
 * Coordinates are normalized percentages over the source image. These regions
 * are presentation masks, not ML segmentation output and not measured depth.
 * They exist so the camera viewpoint can move semantically different parts of
 * the static scene at different bounded rates without running another model.
 */
export const MIRA_BEDROOM_SEGMENTS: readonly PhotorealSceneSegment[] = [
  {
    id: 'window',
    depthRank: 0.14,
    opacity: 0.5,
    transformOrigin: '78% 26%',
    points: [
      [51, 0], [100, 0], [100, 48], [91, 45], [84, 40],
      [76, 43], [67, 41], [58, 36], [52, 27],
    ],
  },
  {
    id: 'pillow',
    depthRank: 0.38,
    opacity: 0.48,
    transformOrigin: '16% 35%',
    points: [
      [0, 13], [23, 12], [31, 28], [29, 46],
      [22, 56], [7, 54], [0, 49],
    ],
  },
  {
    id: 'subject',
    depthRank: 0.64,
    opacity: 0.72,
    transformOrigin: '49% 47%',
    points: [
      [21, 3], [39, 5], [47, 14], [52, 24], [61, 30],
      [69, 37], [83, 43], [100, 57], [98, 70], [83, 73],
      [68, 65], [57, 61], [45, 69], [30, 65], [20, 55],
      [15, 40], [15, 22],
    ],
  },
  {
    id: 'bed',
    depthRank: 0.78,
    opacity: 0.56,
    transformOrigin: '52% 78%',
    points: [
      [0, 44], [15, 46], [25, 57], [35, 69], [51, 72],
      [66, 66], [82, 68], [100, 73], [100, 100], [0, 100],
    ],
  },
  {
    id: 'foreground',
    depthRank: 0.94,
    opacity: 0.62,
    transformOrigin: '51% 91%',
    points: [
      [0, 58], [16, 57], [29, 67], [41, 77], [55, 79],
      [69, 72], [83, 76], [100, 80], [100, 100], [0, 100],
    ],
  },
] as const;

export function sceneSegmentPolygon(
  segment: PhotorealSceneSegment,
): string {
  return `polygon(${segment.points.map(([x, y]) => `${x}% ${y}%`).join(', ')})`;
}

export function validateSceneSegments(
  segments: readonly PhotorealSceneSegment[] = MIRA_BEDROOM_SEGMENTS,
): boolean {
  if (segments.length < 4) return false;
  const ids = new Set<string>();
  let previousDepth = -1;
  for (const segment of segments) {
    if (ids.has(segment.id)) return false;
    ids.add(segment.id);
    if (!(segment.depthRank > previousDepth && segment.depthRank <= 1)) return false;
    previousDepth = segment.depthRank;
    if (!(segment.opacity > 0 && segment.opacity <= 1)) return false;
    if (segment.points.length < 4) return false;
    for (const [x, y] of segment.points) {
      if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
      if (x < 0 || x > 100 || y < 0 || y > 100) return false;
    }
  }
  return true;
}
