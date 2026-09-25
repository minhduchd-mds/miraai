import type { SpatialNode, SpatialSceneEvent, SpatialSceneGraph } from './spatial-scene-graph';

export interface InteractionHandSample {
  handedness: string;
  x: number;
  y: number;
  pinching: boolean;
  gesture: string;
  score: number;
}

export type ObjectInteractionStage =
  | 'none'
  | 'hand_near'
  | 'possible_manipulation'
  | 'possible_reposition';

export interface ObjectInteractionState {
  stage: ObjectInteractionStage;
  objectId: string;
  objectLabel: string;
  handedness: string;
  confidence: number;
  distance: number;
  at: number;
  note: string;
}

export const EMPTY_OBJECT_INTERACTION: ObjectInteractionState = {
  stage: 'none',
  objectId: '',
  objectLabel: '',
  handedness: '',
  confidence: 0,
  distance: 1,
  at: 0,
  note: '',
};

interface NearMemory {
  objectId: string;
  label: string;
  handedness: string;
  confidence: number;
  distance: number;
  at: number;
}

interface PendingDeparture {
  label: string;
  handedness: string;
  confidence: number;
  at: number;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

function pointBoxDistance(x: number, y: number, node: SpatialNode): number {
  const box = node.box;
  const dx = x < box.x ? box.x - x : x > box.x + box.width ? x - (box.x + box.width) : 0;
  const dy = y < box.y ? box.y - y : y > box.y + box.height ? y - (box.y + box.height) : 0;
  return Math.hypot(dx, dy);
}

function nearestHandObject(
  graph: SpatialSceneGraph,
  hands: InteractionHandSample[],
): { node: SpatialNode; hand: InteractionHandSample; distance: number; confidence: number } | null {
  let best: { node: SpatialNode; hand: InteractionHandSample; distance: number; confidence: number } | null = null;
  let bestScore = -Infinity;

  for (const hand of hands) {
    if (!Number.isFinite(hand.x) || !Number.isFinite(hand.y)) continue;
    for (const node of graph.nodes) {
      if (node.kind !== 'object') continue;
      const distance = pointBoxDistance(hand.x, hand.y, node);
      if (distance > 0.11) continue;
      const proximity = clamp01(1 - distance / 0.11);
      const gestureSupport = hand.pinching
        ? 1
        : hand.gesture === 'Closed_Fist'
          ? 0.82
          : hand.gesture === 'Open_Palm'
            ? 0.62
            : 0.5;
      const confidence = clamp01(
        proximity * 0.46 +
        node.score * 0.28 +
        Math.max(0.45, clamp01(hand.score)) * 0.16 +
        gestureSupport * 0.1,
      );
      if (confidence > bestScore) {
        bestScore = confidence;
        best = { node, hand, distance, confidence };
      }
    }
  }
  return best;
}

/**
 * Fuses 2D hand proximity with object-motion events.
 * The output is intentionally phrased as a possible interaction proxy:
 * it does not prove touch, grasp, pickup, placement, ownership, or intent.
 */
export class ObjectInteractionTracker {
  private nearById = new Map<string, NearMemory>();
  private pendingByLabel = new Map<string, PendingDeparture>();
  private processedEventIds = new Set<string>();
  private state: ObjectInteractionState = { ...EMPTY_OBJECT_INTERACTION };

  private setState(next: ObjectInteractionState): ObjectInteractionState {
    this.state = next;
    return { ...next };
  }

  private recentNearForEvent(
    event: SpatialSceneEvent,
    now: number,
  ): NearMemory | null {
    let best: NearMemory | null = null;
    for (const memory of this.nearById.values()) {
      if (memory.label !== event.label || now - memory.at > 1_500) continue;
      if (!best || memory.at > best.at) best = memory;
    }
    return best;
  }

  update(
    graph: SpatialSceneGraph,
    hands: InteractionHandSample[],
    now = performance.now(),
  ): ObjectInteractionState {
    const nearest = nearestHandObject(graph, hands);
    if (nearest) {
      const memory: NearMemory = {
        objectId: nearest.node.id,
        label: nearest.node.label,
        handedness: nearest.hand.handedness,
        confidence: nearest.confidence,
        distance: nearest.distance,
        at: now,
      };
      this.nearById.set(nearest.node.id, memory);

      if (
        this.state.stage === 'none' ||
        this.state.stage === 'hand_near' ||
        now - this.state.at > 1_200
      ) {
        this.setState({
          stage: 'hand_near',
          objectId: nearest.node.id,
          objectLabel: nearest.node.label,
          handedness: nearest.hand.handedness,
          confidence: nearest.confidence,
          distance: nearest.distance,
          at: now,
          note: 'Bàn tay ở gần box vật thể trong ảnh 2D.',
        });
      }
    }

    for (const event of graph.events) {
      if (this.processedEventIds.has(event.id)) continue;
      this.processedEventIds.add(event.id);

      if (event.type === 'object_left') {
        const near = this.recentNearForEvent(event, now);
        if (near) {
          this.pendingByLabel.set(event.label, {
            label: event.label,
            handedness: near.handedness,
            confidence: near.confidence,
            at: event.at,
          });
        }
        continue;
      }

      if (event.type === 'object_moved') {
        const current = [...this.nearById.values()]
          .filter((memory) =>
            memory.label === event.label &&
            now - memory.at <= 1_200
          )
          .sort((a, b) => b.at - a.at)[0];
        if (current) {
          return this.setState({
            stage: 'possible_manipulation',
            objectId: current.objectId,
            objectLabel: current.label,
            handedness: current.handedness,
            confidence: clamp01(current.confidence * 0.72 + Math.min(1, Number(event.distance || 0) / 0.22) * 0.28),
            distance: current.distance,
            at: now,
            note: 'Tay ở gần và box vật thể vừa dịch chuyển; đây chỉ là proxy tương tác có thể xảy ra.',
          });
        }
        continue;
      }

      if (event.type === 'object_returned' || event.type === 'object_relocated') {
        const pending = this.pendingByLabel.get(event.label);
        if (!pending || now - pending.at > 6_000) continue;
        this.pendingByLabel.delete(event.label);
        const node = [...graph.nodes]
          .filter((candidate) => candidate.kind === 'object' && candidate.label === event.label)
          .sort((a, b) => b.score - a.score)[0];
        return this.setState({
          stage: 'possible_reposition',
          objectId: node?.id || '',
          objectLabel: event.label,
          handedness: pending.handedness,
          confidence: clamp01(
            pending.confidence * 0.64 +
            (event.type === 'object_relocated' ? 0.24 : 0.12) +
            Math.min(0.12, Number(event.distance || 0) * 0.3)
          ),
          distance: Number(event.distance || 0),
          at: now,
          note: 'Vật cùng nhãn rời/đổi vị trí sau khi tay ở gần; không đủ bằng chứng để khẳng định đã cầm hay đặt vật.',
        });
      }
    }

    for (const [id, memory] of this.nearById) {
      if (now - memory.at > 2_000) this.nearById.delete(id);
    }
    for (const [label, pending] of this.pendingByLabel) {
      if (now - pending.at > 6_000) this.pendingByLabel.delete(label);
    }
    if (this.processedEventIds.size > 96) {
      const keep = new Set(graph.events.slice(-24).map((event) => event.id));
      this.processedEventIds = keep;
    }

    const holdMs = this.state.stage === 'hand_near' ? 700 : 2_800;
    if (this.state.stage !== 'none' && now - this.state.at > holdMs && !nearest) {
      this.state = { ...EMPTY_OBJECT_INTERACTION, at: now };
    }
    return { ...this.state };
  }

  reset(): void {
    this.nearById.clear();
    this.pendingByLabel.clear();
    this.processedEventIds.clear();
    this.state = { ...EMPTY_OBJECT_INTERACTION };
  }
}

export function objectInteractionPrompt(state: ObjectInteractionState, now = performance.now()): string {
  if (
    state.stage !== 'possible_manipulation' &&
    state.stage !== 'possible_reposition'
  ) return '';
  if (now - state.at > 4_000 || state.confidence < 0.52) return '';

  const action = state.stage === 'possible_reposition'
    ? 'vật cùng nhãn vừa rời/đổi vị trí sau khi tay ở gần'
    : 'tay ở gần và box vật thể vừa dịch chuyển';

  return '[MIRA_OBJECT_INTERACTION label="' + state.objectLabel +
    '" confidence="' + Math.round(state.confidence * 100) + '"] ' +
    'Camera có tín hiệu possible interaction với "' + state.objectLabel +
    '": ' + action +
    '. Chỉ mô tả đây là proxy 2D; không khẳng định người dùng đã chạm, cầm, nhấc, đặt, sở hữu hay cố ý di chuyển vật.';
}
