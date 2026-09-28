import type { ObjectBox } from './environment-model';
import type { CausalActionGraphState } from './causal-action-graph';
import type { SpatialNode, SpatialSceneGraph } from './spatial-scene-graph';

export type WorldObjectStatus =
  | 'visible'
  | 'temporarily_missing'
  | 'returned'
  | 'relocated';

export type WorldModelEventType =
  | 'seen'
  | 'missing'
  | 'returned'
  | 'relocated'
  | 'moved'
  | 'expired'
  | 'identity_rebind';

export interface WorldObjectMemory {
  id: string;
  sourceObjectId: string;
  label: string;
  status: WorldObjectStatus;
  confidence: number;
  firstSeenAt: number;
  lastSeenAt: number;
  missingSince: number;
  observationCount: number;
  relocationDistance: number;
  lastKnownBox: ObjectBox;
  supportedByActionHypothesis: boolean;
}

export interface WorldModelEvent {
  id: string;
  type: WorldModelEventType;
  worldObjectId: string;
  label: string;
  confidence: number;
  distance: number;
  at: number;
  note: string;
}

export interface ShortTermWorldState {
  version: 14;
  objects: WorldObjectMemory[];
  events: WorldModelEvent[];
  visibleCount: number;
  missingCount: number;
  updatedAt: number;
}

export const EMPTY_WORLD_STATE: ShortTermWorldState = {
  version: 14,
  objects: [],
  events: [],
  visibleCount: 0,
  missingCount: 0,
  updatedAt: 0,
};

interface MutableWorldObject extends WorldObjectMemory {
  visibleConfidence: number;
}

const MISSING_GRACE_MS = 900;
const MISSING_TTL_MS = 30_000;
const CONFIDENCE_HALF_LIFE_MS = 9_000;
const EVENT_TTL_MS = 90_000;
const PROMPT_EVENT_WINDOW_MS = 20_000;
const NEAR_REBIND_DISTANCE = 0.09;
const RELOCATION_DISTANCE = 0.12;

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

function copyBox(box: ObjectBox): ObjectBox {
  return { x: box.x, y: box.y, width: box.width, height: box.height };
}

function center(box: ObjectBox): { x: number; y: number } {
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

function centerDistance(a: ObjectBox, b: ObjectBox): number {
  const ac = center(a);
  const bc = center(b);
  return Math.hypot(ac.x - bc.x, ac.y - bc.y);
}

function publicObject(memory: MutableWorldObject): WorldObjectMemory {
  const { visibleConfidence: _visibleConfidence, ...value } = memory;
  return { ...value, lastKnownBox: copyBox(value.lastKnownBox) };
}

function causalSupportsLabel(
  causal: CausalActionGraphState | null,
  label: string,
  now: number,
): boolean {
  const leader = causal?.leader;
  if (!leader) return false;
  if (leader.objectLabel !== label || leader.confidence < 0.62) return false;
  if (leader.stage !== 'supported' && leader.stage !== 'reappeared') return false;
  return now - leader.updatedAt <= 5_000;
}

/**
 * World Model v14 is a short-term, RAM-only visual memory.
 *
 * It provides object permanence across brief detector misses and conservative
 * same-label reappearance. It never claims physical identity, ownership,
 * intent, touch, pickup or human causality from camera evidence.
 */
export class ShortTermWorldModelTracker {
  private memories = new Map<string, MutableWorldObject>();
  private events: WorldModelEvent[] = [];
  private seq = 0;
  private eventSeq = 0;

  private pushEvent(
    type: WorldModelEventType,
    memory: MutableWorldObject,
    now: number,
    note: string,
    distance = 0,
    confidence = memory.confidence,
  ): void {
    this.eventSeq += 1;
    this.events.push({
      id: 'world-event-' + this.eventSeq,
      type,
      worldObjectId: memory.id,
      label: memory.label,
      confidence: clamp01(confidence),
      distance: Math.max(0, Number.isFinite(distance) ? distance : 0),
      at: now,
      note,
    });
    this.events = this.events
      .filter((event) => now - event.at <= EVENT_TTL_MS)
      .slice(-24);
  }

  private create(node: SpatialNode, now: number): MutableWorldObject {
    this.seq += 1;
    const confidence = clamp01(0.5 + node.score * 0.42);
    const memory: MutableWorldObject = {
      id: 'world-' + this.seq,
      sourceObjectId: node.id,
      label: node.label,
      status: 'visible',
      confidence,
      visibleConfidence: confidence,
      firstSeenAt: now,
      lastSeenAt: now,
      missingSince: 0,
      observationCount: 1,
      relocationDistance: 0,
      lastKnownBox: copyBox(node.box),
      supportedByActionHypothesis: false,
    };
    this.memories.set(memory.id, memory);
    this.pushEvent('seen', memory, now, 'Object ổn định xuất hiện trong scene graph.');
    return memory;
  }

  private exactMatch(node: SpatialNode, used: Set<string>): MutableWorldObject | null {
    for (const memory of this.memories.values()) {
      if (used.has(memory.id)) continue;
      if (memory.sourceObjectId === node.id) return memory;
    }
    return null;
  }

  private conservativeRebind(
    node: SpatialNode,
    graph: SpatialSceneGraph,
    used: Set<string>,
    now: number,
  ): { memory: MutableWorldObject; far: boolean } | null {
    const candidates = [...this.memories.values()]
      .filter((memory) =>
        !used.has(memory.id) &&
        memory.label === node.label &&
        now - memory.lastSeenAt <= MISSING_TTL_MS
      )
      .map((memory) => ({
        memory,
        distance: centerDistance(memory.lastKnownBox, node.box),
      }))
      .sort((a, b) => a.distance - b.distance);

    if (!candidates.length) return null;

    const nearest = candidates[0];
    const second = candidates[1];
    if (
      nearest.distance <= NEAR_REBIND_DISTANCE &&
      (!second || second.distance - nearest.distance >= 0.035)
    ) {
      return { memory: nearest.memory, far: false };
    }

    // Far rebind is allowed only when both sides are unambiguous and the
    // upstream scene graph has already emitted a return/relocation event.
    const missing = candidates.filter((item) => item.memory.status === 'temporarily_missing');
    const visibleSameLabel = graph.nodes.filter((item) =>
      item.kind === 'object' && item.label === node.label
    );
    const hasContinuityEvent = graph.events.some((event) =>
      event.label === node.label &&
      (event.type === 'object_relocated' || event.type === 'object_returned') &&
      now - event.at <= 2_500
    );
    if (missing.length === 1 && visibleSameLabel.length === 1 && hasContinuityEvent) {
      return { memory: missing[0].memory, far: true };
    }
    return null;
  }

  private observeNode(
    node: SpatialNode,
    graph: SpatialSceneGraph,
    causal: CausalActionGraphState | null,
    used: Set<string>,
    now: number,
  ): void {
    let memory = this.exactMatch(node, used);
    let rebound = false;
    let farRebind = false;
    if (!memory) {
      const match = this.conservativeRebind(node, graph, used, now);
      memory = match?.memory || null;
      rebound = Boolean(match);
      farRebind = Boolean(match?.far);
    }
    if (!memory) {
      memory = this.create(node, now);
      used.add(memory.id);
      return;
    }

    used.add(memory.id);
    const previousBox = copyBox(memory.lastKnownBox);
    const previousStatus = memory.status;
    const distance = centerDistance(previousBox, node.box);
    const causalSupport = causalSupportsLabel(causal, node.label, now);

    memory.sourceObjectId = node.id;
    memory.lastKnownBox = copyBox(node.box);
    memory.lastSeenAt = now;
    memory.observationCount += 1;
    memory.missingSince = 0;
    memory.relocationDistance = distance;
    memory.supportedByActionHypothesis = causalSupport;
    memory.visibleConfidence = clamp01(
      memory.visibleConfidence * 0.42 + node.score * 0.46 + 0.12
    );
    memory.confidence = clamp01(
      memory.visibleConfidence + (causalSupport ? 0.05 : 0)
    );

    if (previousStatus === 'temporarily_missing') {
      memory.status = distance >= RELOCATION_DISTANCE || farRebind ? 'relocated' : 'returned';
      this.pushEvent(
        memory.status,
        memory,
        now,
        memory.status === 'relocated'
          ? 'Same-label object reappeared away from its last screen position.'
          : 'Same-label object reappeared near its last screen position.',
        distance,
        memory.confidence,
      );
    } else {
      memory.status = 'visible';
    }

    if (rebound && memory.sourceObjectId !== node.id) {
      // Kept for readability; sourceObjectId is assigned above.
      memory.sourceObjectId = node.id;
    }
    if (rebound) {
      this.pushEvent(
        'identity_rebind',
        memory,
        now,
        'Detector ID changed; continuity remains a conservative same-label hypothesis.',
        distance,
        memory.confidence * (farRebind ? 0.72 : 0.88),
      );
    }

    const movedEvent = graph.events.find((event) =>
      event.type === 'object_moved' &&
      event.label === memory.label &&
      now - event.at <= 1_500
    );
    if (movedEvent && distance >= 0.06) {
      this.pushEvent(
        'moved',
        memory,
        now,
        'Visible box position changed while the object remained tracked.',
        distance,
        memory.confidence,
      );
    }
  }

  update(
    graph: SpatialSceneGraph,
    causal: CausalActionGraphState | null = null,
    now = performance.now(),
  ): ShortTermWorldState {
    const used = new Set<string>();
    const nodes = graph.nodes.filter((node) => node.kind === 'object');

    for (const node of nodes) {
      this.observeNode(node, graph, causal, used, now);
    }

    for (const memory of [...this.memories.values()]) {
      if (used.has(memory.id)) continue;

      const unseenFor = Math.max(0, now - memory.lastSeenAt);
      if (unseenFor >= MISSING_GRACE_MS && memory.status !== 'temporarily_missing') {
        memory.status = 'temporarily_missing';
        memory.missingSince = now;
        memory.supportedByActionHypothesis = causalSupportsLabel(causal, memory.label, now);
        this.pushEvent(
          'missing',
          memory,
          now,
          'Object is absent from the current stable scene graph; memory is retained briefly.',
          0,
          memory.confidence * 0.9,
        );
      }

      if (memory.status === 'temporarily_missing') {
        const decay = Math.pow(0.5, unseenFor / CONFIDENCE_HALF_LIFE_MS);
        memory.confidence = clamp01(memory.visibleConfidence * decay);
      }

      if (unseenFor > MISSING_TTL_MS || memory.confidence < 0.12) {
        this.pushEvent(
          'expired',
          memory,
          now,
          'Short-term visual memory expired without a confident reappearance.',
          0,
          memory.confidence,
        );
        this.memories.delete(memory.id);
      }
    }

    this.events = this.events
      .filter((event) => now - event.at <= EVENT_TTL_MS)
      .slice(-24);

    const objects = [...this.memories.values()]
      .sort((a, b) => b.confidence - a.confidence)
      .map(publicObject);

    return {
      version: 14,
      objects,
      events: this.events.map((event) => ({ ...event })),
      visibleCount: objects.filter((item) => item.status !== 'temporarily_missing').length,
      missingCount: objects.filter((item) => item.status === 'temporarily_missing').length,
      updatedAt: now,
    };
  }

  snapshot(now = performance.now()): ShortTermWorldState {
    return this.update({
      nodes: [],
      relations: [],
      focus: null,
      pointerActive: false,
      peopleCount: 0,
      events: [],
      updatedAt: now,
    }, null, now);
  }

  reset(): void {
    this.memories.clear();
    this.events = [];
    this.seq = 0;
    this.eventSeq = 0;
  }
}

export function worldModelPrompt(
  state: ShortTermWorldState,
  now = performance.now(),
): string {
  const recent = state.events
    .filter((event) =>
      now - event.at <= PROMPT_EVENT_WINDOW_MS &&
      event.confidence >= 0.42 &&
      event.type !== 'seen' &&
      event.type !== 'identity_rebind' &&
      event.type !== 'expired'
    )
    .slice(-4);

  const missing = state.objects
    .filter((item) => item.status === 'temporarily_missing' && item.confidence >= 0.4)
    .slice(0, 2);

  if (!recent.length && !missing.length) return '';

  const parts: string[] = [];
  for (const event of recent) {
    if (event.type === 'relocated') {
      parts.push(event.label + ' vừa biến mất rồi xuất hiện ở vị trí màn hình khác.');
    } else if (event.type === 'returned') {
      parts.push(event.label + ' vừa xuất hiện lại gần vị trí màn hình trước đó.');
    } else if (event.type === 'moved') {
      parts.push(event.label + ' vừa đổi vị trí box trong khung hình.');
    } else if (event.type === 'missing') {
      parts.push(event.label + ' vừa tạm mất khỏi scene graph.');
    }
  }
  for (const item of missing) {
    if (!parts.some((part) => part.startsWith(item.label + ' '))) {
      parts.push(item.label + ' vẫn đang được giữ trong bộ nhớ hình ảnh ngắn hạn.');
    }
  }

  const maxConfidence = Math.round(
    Math.max(
      0,
      ...recent.map((event) => event.confidence),
      ...missing.map((item) => item.confidence),
    ) * 100
  );

  return '[MIRA_WORLD_MODEL version="14" confidence="' + maxConfidence + '"] ' +
    parts.join(' ') +
    ' Đây là object permanence ngắn hạn từ detection 2D; không xác nhận danh tính vật thể khi detector đổi ID và không suy ra ai hoặc điều gì đã gây ra thay đổi.';
}
