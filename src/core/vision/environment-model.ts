export interface ObjectBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ObjectObservation {
  label: string;
  score: number;
  box: ObjectBox;
}

export interface TrackedObject extends ObjectObservation {
  id: string;
  hits: number;
  stable: boolean;
  firstSeenAt: number;
  lastSeenAt: number;
}

export type EnvironmentLabel =
  | 'workspace'
  | 'rest_area'
  | 'living_area'
  | 'dining_area'
  | 'person_nearby'
  | 'mixed'
  | 'unknown';

export interface EnvironmentContext {
  label: EnvironmentLabel;
  confidence: number;
  objectCount: number;
  peopleCount: number;
  evidence: string[];
  updatedAt: number;
}

export const EMPTY_ENVIRONMENT: EnvironmentContext = {
  label: 'unknown',
  confidence: 0,
  objectCount: 0,
  peopleCount: 0,
  evidence: [],
  updatedAt: 0,
};

const WORKSPACE_WEIGHTS: Record<string, number> = {
  laptop: 1,
  keyboard: 1,
  mouse: 0.9,
  'cell phone': 0.55,
  book: 0.38,
  chair: 0.24,
  tv: 0.2,
};

const REST_WEIGHTS: Record<string, number> = {
  bed: 1,
  couch: 0.72,
  chair: 0.16,
  book: 0.12,
};

const LIVING_WEIGHTS: Record<string, number> = {
  couch: 0.82,
  tv: 0.72,
  'potted plant': 0.4,
  chair: 0.28,
  vase: 0.18,
};

const DINING_WEIGHTS: Record<string, number> = {
  'dining table': 0.95,
  cup: 0.42,
  bottle: 0.36,
  bowl: 0.42,
  fork: 0.38,
  knife: 0.32,
  spoon: 0.34,
  plate: 0.4,
  banana: 0.2,
  apple: 0.2,
  sandwich: 0.22,
};

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

function normalizeLabel(label: string): string {
  return String(label || '').trim().toLowerCase().replaceAll('_', ' ');
}

export function objectIoU(a: ObjectBox, b: ObjectBox): number {
  const ax2 = a.x + a.width;
  const ay2 = a.y + a.height;
  const bx2 = b.x + b.width;
  const by2 = b.y + b.height;
  const ix1 = Math.max(a.x, b.x);
  const iy1 = Math.max(a.y, b.y);
  const ix2 = Math.min(ax2, bx2);
  const iy2 = Math.min(ay2, by2);
  const iw = Math.max(0, ix2 - ix1);
  const ih = Math.max(0, iy2 - iy1);
  const intersection = iw * ih;
  const union = Math.max(1e-6, a.width * a.height + b.width * b.height - intersection);
  return clamp01(intersection / union);
}

function smoothBox(previous: ObjectBox, next: ObjectBox, alpha = 0.38): ObjectBox {
  return {
    x: previous.x + (next.x - previous.x) * alpha,
    y: previous.y + (next.y - previous.y) * alpha,
    width: previous.width + (next.width - previous.width) * alpha,
    height: previous.height + (next.height - previous.height) * alpha,
  };
}

/**
 * Lightweight temporal object tracker for low-frequency detector frames.
 * IDs are session-local and are not identity tracking.
 */
export class ObjectTemporalTracker {
  private tracks: TrackedObject[] = [];
  private seq = 0;

  update(observations: ObjectObservation[], now = performance.now()): TrackedObject[] {
    const unmatched = new Set(this.tracks.map((_, index) => index));
    const nextTracks: TrackedObject[] = [];

    for (const observation of observations) {
      const label = normalizeLabel(observation.label);
      if (!label || observation.score < 0.25) continue;

      let bestIndex = -1;
      let bestIoU = 0;
      for (const index of unmatched) {
        const candidate = this.tracks[index];
        if (candidate.label !== label) continue;
        const iou = objectIoU(candidate.box, observation.box);
        if (iou > bestIoU) {
          bestIoU = iou;
          bestIndex = index;
        }
      }

      if (bestIndex >= 0 && bestIoU >= 0.22) {
        unmatched.delete(bestIndex);
        const previous = this.tracks[bestIndex];
        const hits = previous.hits + 1;
        nextTracks.push({
          ...previous,
          label,
          score: previous.score * 0.55 + clamp01(observation.score) * 0.45,
          box: smoothBox(previous.box, observation.box),
          hits,
          stable: hits >= 2,
          lastSeenAt: now,
        });
      } else {
        this.seq += 1;
        nextTracks.push({
          id: 'obj-' + this.seq,
          label,
          score: clamp01(observation.score),
          box: { ...observation.box },
          hits: 1,
          stable: false,
          firstSeenAt: now,
          lastSeenAt: now,
        });
      }
    }

    for (const index of unmatched) {
      const previous = this.tracks[index];
      if (now - previous.lastSeenAt <= 1_600) {
        nextTracks.push({
          ...previous,
          score: previous.score * 0.88,
        });
      }
    }

    this.tracks = nextTracks
      .filter((track) => track.score >= 0.24)
      .sort((a, b) => b.score - a.score)
      .slice(0, 12);

    return this.snapshot();
  }

  snapshot(): TrackedObject[] {
    return this.tracks.map((track) => ({ ...track, box: { ...track.box } }));
  }

  reset(): void {
    this.tracks = [];
    this.seq = 0;
  }
}

function weightedScore(objects: TrackedObject[], weights: Record<string, number>): number {
  let score = 0;
  for (const object of objects) {
    const weight = weights[object.label] || 0;
    if (!weight) continue;
    const persistence = clamp01(object.hits / 4);
    score += weight * object.score * (0.55 + persistence * 0.45);
  }
  return score;
}

export function inferEnvironment(objects: TrackedObject[], now = performance.now()): EnvironmentContext {
  const stable = objects.filter((object) => object.stable && object.score >= 0.34);
  const peopleCount = stable.filter((object) => object.label === 'person').length;
  const sceneObjects = stable.filter((object) => object.label !== 'person');

  if (!stable.length) {
    return {
      ...EMPTY_ENVIRONMENT,
      objectCount: 0,
      peopleCount: 0,
      updatedAt: now,
    };
  }

  const scores = [
    { label: 'workspace' as const, score: weightedScore(sceneObjects, WORKSPACE_WEIGHTS) },
    { label: 'rest_area' as const, score: weightedScore(sceneObjects, REST_WEIGHTS) },
    { label: 'living_area' as const, score: weightedScore(sceneObjects, LIVING_WEIGHTS) },
    { label: 'dining_area' as const, score: weightedScore(sceneObjects, DINING_WEIGHTS) },
  ].sort((a, b) => b.score - a.score);

  const top = scores[0];
  const second = scores[1];
  let label: EnvironmentLabel = 'unknown';
  let confidence = 0;

  if (peopleCount >= 2 && top.score < 0.7) {
    label = 'person_nearby';
    confidence = clamp01(0.48 + Math.min(3, peopleCount - 1) * 0.12);
  } else if (top.score >= 0.36) {
    if (second.score >= top.score * 0.82 && second.score >= 0.35) {
      label = 'mixed';
      confidence = clamp01((top.score + second.score) / 2.2);
    } else {
      label = top.label;
      confidence = clamp01(0.34 + top.score / 1.9);
    }
  }

  const evidence = sceneObjects
    .filter((object) => object.score >= 0.4)
    .slice(0, 6)
    .map((object) => object.label);

  return {
    label,
    confidence,
    objectCount: stable.length,
    peopleCount,
    evidence: [...new Set(evidence)],
    updatedAt: now,
  };
}

export function environmentPrompt(context: EnvironmentContext): string {
  if (context.confidence < 0.48 || context.label === 'unknown') return '';
  const evidence = context.evidence.length ? ' (' + context.evidence.slice(0, 4).join(', ') + ')' : '';
  const label = ({
    workspace: 'không gian giống khu vực làm việc',
    rest_area: 'không gian giống khu vực nghỉ/ngồi',
    living_area: 'không gian giống khu vực sinh hoạt',
    dining_area: 'không gian giống khu vực ăn/uống',
    person_nearby: 'có thể có thêm người trong khung',
    mixed: 'không gian có tín hiệu pha trộn',
    unknown: 'không xác định',
  } as Record<EnvironmentLabel, string>)[context.label];

  return 'Object detector local thấy ' + label + evidence +
    '. Đây chỉ là suy luận từ vật thể nhìn thấy, không khẳng định loại phòng, vị trí hay hoạt động của người dùng.';
}
