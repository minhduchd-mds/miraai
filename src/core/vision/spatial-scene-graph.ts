import type { ObjectBox, TrackedObject } from './environment-model';

export type SpatialRelationType =
  | 'left_of'
  | 'right_of'
  | 'above'
  | 'below'
  | 'near'
  | 'overlaps';

export interface SpatialNode {
  id: string;
  label: string;
  score: number;
  box: ObjectBox;
  centerX: number;
  centerY: number;
  kind: 'person' | 'object';
}

export interface SpatialRelation {
  from: string;
  to: string;
  type: SpatialRelationType;
  confidence: number;
}

export interface SpatialFocus {
  id: string;
  label: string;
  confidence: number;
  stableMs: number;
  centerX: number;
  centerY: number;
}

export type SpatialSceneEventType =
  | 'object_entered'
  | 'object_left'
  | 'focus_changed'
  | 'people_changed';

export interface SpatialSceneEvent {
  id: string;
  type: SpatialSceneEventType;
  label: string;
  at: number;
}

export interface SpatialSceneGraph {
  nodes: SpatialNode[];
  relations: SpatialRelation[];
  focus: SpatialFocus | null;
  pointerActive: boolean;
  peopleCount: number;
  events: SpatialSceneEvent[];
  updatedAt: number;
}

export interface SpatialPointerSample {
  active: boolean;
  x: number;
  y: number;
  confidence: number;
}

export const EMPTY_SPATIAL_SCENE: SpatialSceneGraph = {
  nodes: [],
  relations: [],
  focus: null,
  pointerActive: false,
  peopleCount: 0,
  events: [],
  updatedAt: 0,
};

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

function displayBox(source: ObjectBox): ObjectBox {
  return {
    x: clamp01(1 - (source.x + source.width)),
    y: clamp01(source.y),
    width: clamp01(source.width),
    height: clamp01(source.height),
  };
}

function center(box: ObjectBox): { x: number; y: number } {
  return {
    x: box.x + box.width / 2,
    y: box.y + box.height / 2,
  };
}

function boxArea(box: ObjectBox): number {
  return Math.max(0, box.width) * Math.max(0, box.height);
}

function pointBoxDistance(x: number, y: number, box: ObjectBox): number {
  const dx = x < box.x ? box.x - x : x > box.x + box.width ? x - (box.x + box.width) : 0;
  const dy = y < box.y ? box.y - y : y > box.y + box.height ? y - (box.y + box.height) : 0;
  return Math.hypot(dx, dy);
}

function boxIoU(a: ObjectBox, b: ObjectBox): number {
  const ix1 = Math.max(a.x, b.x);
  const iy1 = Math.max(a.y, b.y);
  const ix2 = Math.min(a.x + a.width, b.x + b.width);
  const iy2 = Math.min(a.y + a.height, b.y + b.height);
  const iw = Math.max(0, ix2 - ix1);
  const ih = Math.max(0, iy2 - iy1);
  const intersection = iw * ih;
  const union = Math.max(1e-6, boxArea(a) + boxArea(b) - intersection);
  return clamp01(intersection / union);
}

function relationBetween(a: SpatialNode, b: SpatialNode): SpatialRelation[] {
  const dx = a.centerX - b.centerX;
  const dy = a.centerY - b.centerY;
  const centerDistance = Math.hypot(dx, dy);
  const scale = Math.max(
    0.08,
    Math.sqrt(boxArea(a.box)) + Math.sqrt(boxArea(b.box)),
  );
  const relations: SpatialRelation[] = [];

  const overlap = boxIoU(a.box, b.box);
  if (overlap >= 0.16) {
    relations.push({
      from: a.id,
      to: b.id,
      type: 'overlaps',
      confidence: clamp01(0.55 + overlap * 0.45),
    });
  }

  if (centerDistance <= scale * 0.9) {
    relations.push({
      from: a.id,
      to: b.id,
      type: 'near',
      confidence: clamp01(1 - centerDistance / Math.max(0.2, scale * 1.4)),
    });
  }

  const horizontalDominant = Math.abs(dx) >= Math.abs(dy) * 0.82;
  const verticalDominant = Math.abs(dy) > Math.abs(dx) * 0.82;

  if (horizontalDominant && Math.abs(dx) >= 0.08) {
    relations.push({
      from: a.id,
      to: b.id,
      type: dx < 0 ? 'left_of' : 'right_of',
      confidence: clamp01(0.5 + Math.min(0.5, Math.abs(dx))),
    });
  }

  if (verticalDominant && Math.abs(dy) >= 0.08) {
    relations.push({
      from: a.id,
      to: b.id,
      type: dy < 0 ? 'above' : 'below',
      confidence: clamp01(0.5 + Math.min(0.5, Math.abs(dy))),
    });
  }

  return relations;
}

function selectCandidate(nodes: SpatialNode[], pointer: SpatialPointerSample): SpatialNode | null {
  if (!pointer.active || pointer.confidence < 0.45) return null;
  let best: SpatialNode | null = null;
  let bestScore = -Infinity;

  for (const node of nodes) {
    if (node.kind === 'person') continue;
    const distance = pointBoxDistance(pointer.x, pointer.y, node.box);
    if (distance > 0.14) continue;
    const area = Math.max(0.015, boxArea(node.box));
    const proximity = clamp01(1 - distance / 0.14);
    const sizePenalty = clamp01(1 - Math.max(0, area - 0.42));
    const score =
      proximity * 0.58 +
      node.score * 0.28 +
      pointer.confidence * 0.1 +
      sizePenalty * 0.04;

    if (score > bestScore) {
      bestScore = score;
      best = node;
    }
  }
  return best;
}

export class SpatialSceneGraphTracker {
  private candidateId = '';
  private candidateSince = 0;
  private focus: SpatialFocus | null = null;
  private focusLastSeenAt = 0;
  private previousNodeIds = new Map<string, string>();
  private previousPeopleCount = 0;
  private events: SpatialSceneEvent[] = [];
  private eventSeq = 0;

  private pushEvent(type: SpatialSceneEventType, label: string, now: number): void {
    this.eventSeq += 1;
    this.events.push({
      id: 'scene-' + this.eventSeq,
      type,
      label,
      at: now,
    });
    this.events = this.events.filter((event) => now - event.at <= 90_000).slice(-12);
  }

  update(
    objects: TrackedObject[],
    pointer: SpatialPointerSample,
    now = performance.now(),
  ): SpatialSceneGraph {
    const nodes: SpatialNode[] = objects
      .filter((object) => object.stable && object.score >= 0.34)
      .slice(0, 10)
      .map((object) => {
        const box = displayBox(object.box);
        const c = center(box);
        return {
          id: object.id,
          label: object.label,
          score: object.score,
          box,
          centerX: c.x,
          centerY: c.y,
          kind: object.label === 'person' ? 'person' : 'object',
        };
      });

    const currentIds = new Map(nodes.map((node) => [node.id, node.label]));
    for (const node of nodes) {
      if (!this.previousNodeIds.has(node.id)) this.pushEvent('object_entered', node.label, now);
    }
    for (const [id, label] of this.previousNodeIds) {
      if (!currentIds.has(id)) this.pushEvent('object_left', label, now);
    }
    this.previousNodeIds = currentIds;

    const peopleCount = nodes.filter((node) => node.kind === 'person').length;
    if (peopleCount !== this.previousPeopleCount) {
      this.pushEvent('people_changed', String(peopleCount), now);
      this.previousPeopleCount = peopleCount;
    }

    const primaryPerson = nodes
      .filter((node) => node.kind === 'person')
      .sort((a, b) => boxArea(b.box) * b.score - boxArea(a.box) * a.score)[0];

    const relations: SpatialRelation[] = [];
    const sceneObjects = nodes.filter((node) => node.kind === 'object');

    if (primaryPerson) {
      for (const node of sceneObjects.slice(0, 6)) {
        relations.push(...relationBetween(node, primaryPerson).slice(0, 2));
      }
    }

    for (let i = 0; i < sceneObjects.length; i += 1) {
      for (let j = i + 1; j < sceneObjects.length; j += 1) {
        const pair = relationBetween(sceneObjects[i], sceneObjects[j])
          .filter((relation) => relation.type === 'near' || relation.type === 'overlaps')
          .slice(0, 1);
        relations.push(...pair);
        if (relations.length >= 18) break;
      }
      if (relations.length >= 18) break;
    }

    const candidate = selectCandidate(nodes, pointer);
    if (candidate?.id !== this.candidateId) {
      this.candidateId = candidate?.id || '';
      this.candidateSince = candidate ? now : 0;
      if (candidate && this.focus && this.focus.id !== candidate.id) {
        this.focus = null;
      }
    }

    if (candidate) {
      const stableMs = Math.max(0, now - this.candidateSince);
      if (stableMs >= 320) {
        const changed = this.focus?.id !== candidate.id;
        this.focus = {
          id: candidate.id,
          label: candidate.label,
          confidence: clamp01(candidate.score * 0.62 + pointer.confidence * 0.38),
          stableMs,
          centerX: candidate.centerX,
          centerY: candidate.centerY,
        };
        this.focusLastSeenAt = now;
        if (changed) this.pushEvent('focus_changed', candidate.label, now);
      } else if (this.focus?.id === candidate.id) {
        this.focus = { ...this.focus, stableMs };
        this.focusLastSeenAt = now;
      }
    } else if (this.focus) {
      const releaseMs = pointer.active ? 420 : 1_600;
      if (now - this.focusLastSeenAt > releaseMs) this.focus = null;
    }

    if (this.focus && !nodes.some((node) => node.id === this.focus?.id)) {
      if (now - this.focusLastSeenAt > 800) this.focus = null;
    }

    return {
      nodes,
      relations: relations
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, 18),
      focus: this.focus ? { ...this.focus } : null,
      pointerActive: pointer.active,
      peopleCount,
      events: this.events.map((event) => ({ ...event })),
      updatedAt: now,
    };
  }

  reset(): void {
    this.candidateId = '';
    this.candidateSince = 0;
    this.focus = null;
    this.focusLastSeenAt = 0;
    this.previousNodeIds.clear();
    this.previousPeopleCount = 0;
    this.events = [];
    this.eventSeq = 0;
  }
}

function nodeLabel(graph: SpatialSceneGraph, id: string): string {
  return graph.nodes.find((node) => node.id === id)?.label || 'object';
}

function relationPhrase(type: SpatialRelationType): string {
  return ({
    left_of: 'ở bên trái',
    right_of: 'ở bên phải',
    above: 'ở phía trên',
    below: 'ở phía dưới',
    near: 'ở gần',
    overlaps: 'chồng vùng với',
  } as Record<SpatialRelationType, string>)[type];
}

export function spatialScenePrompt(graph: SpatialSceneGraph, now = performance.now()): string {
  const parts: string[] = [];

  if (graph.focus && graph.focus.confidence >= 0.52) {
    const confidence = Math.round(graph.focus.confidence * 100);
    parts.push(
      '[MIRA_VISUAL_TARGET label="' + graph.focus.label + '" confidence="' + confidence + '"] ' +
      'Bàn tay đang trỏ ổn định vào "' + graph.focus.label +
      '" với độ tin cậy khoảng ' + confidence +
      '%. Nếu người dùng nói "cái này/vật này", ưu tiên hiểu là object đó.',
    );
  } else if (graph.pointerActive) {
    parts.push(
      '[MIRA_VISUAL_POINTER target="none"] ' +
      'Bàn tay đang chỉ nhưng chưa có object ổn định nằm dưới con trỏ; không đoán "cái này" là vật gì.',
    );
  }

  const person = graph.nodes
    .filter((node) => node.kind === 'person')
    .sort((a, b) => boxArea(b.box) - boxArea(a.box))[0];

  if (person) {
    const useful = graph.relations
      .filter((relation) => relation.to === person.id && relation.confidence >= 0.56)
      .slice(0, 3)
      .map((relation) =>
        '"' + nodeLabel(graph, relation.from) + '" ' + relationPhrase(relation.type) + ' vùng person chính trong khung',
      );
    if (useful.length) parts.push('Quan hệ không gian theo ảnh camera: ' + useful.join('; ') + '.');
  }

  const recentPeopleChange = [...graph.events]
    .reverse()
    .find((event) => event.type === 'people_changed' && now - event.at <= 5_000);
  if (recentPeopleChange) {
    parts.push(
      'Object detector hiện thấy ' + recentPeopleChange.label +
      ' vùng person trong khung; đây là số box người, không phải nhận dạng danh tính.',
    );
  }

  if (!parts.length) return '';
  return parts.join(' ') +
    ' Các quan hệ là hình học 2D trên khung camera đã mirror, không phải hiểu biết chắc chắn về thế giới 3D.';
}
