import type { ObjectBox } from './environment-model';
import type { InteractionHandSample } from './object-interaction';
import type { SpatialNode, SpatialSceneGraph } from './spatial-scene-graph';

export type ActionSequenceStage =
  | 'idle'
  | 'hand_approach'
  | 'object_occluded'
  | 'object_reappeared'
  | 'possible_reposition_sequence';

export interface ActionSequenceState {
  stage: ActionSequenceStage;
  sequenceId: number;
  objectId: string;
  objectLabel: string;
  handedness: string;
  confidence: number;
  startedAt: number;
  updatedAt: number;
  cameraMotion: number;
  cameraStable: boolean;
  identityRebound: boolean;
  steps: string[];
  note: string;
}

export const EMPTY_ACTION_SEQUENCE: ActionSequenceState = {
  stage: 'idle',
  sequenceId: 0,
  objectId: '',
  objectLabel: '',
  handedness: '',
  confidence: 0,
  startedAt: 0,
  updatedAt: 0,
  cameraMotion: 0,
  cameraStable: true,
  identityRebound: false,
  steps: [],
  note: '',
};

interface ProximityMemory {
  distance: number;
  at: number;
}

interface TargetMemory {
  objectId: string;
  label: string;
  handedness: string;
  box: ObjectBox;
  lastSeenAt: number;
  startedAt: number;
}

interface ReappearanceMemory {
  objectId: string;
  since: number;
  distance: number;
  score: number;
}

interface MotionEstimate {
  magnitude: number;
  coherence: number;
  anchors: number;
  unstable: boolean;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

function copyBox(box: ObjectBox): ObjectBox {
  return { x: box.x, y: box.y, width: box.width, height: box.height };
}

function centerOf(box: ObjectBox): { x: number; y: number } {
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

function centerDistance(a: ObjectBox, b: ObjectBox): number {
  const ac = centerOf(a);
  const bc = centerOf(b);
  return Math.hypot(ac.x - bc.x, ac.y - bc.y);
}

function boxArea(box: ObjectBox): number {
  return Math.max(0, box.width) * Math.max(0, box.height);
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

function pointBoxDistance(x: number, y: number, box: ObjectBox): number {
  const dx = x < box.x ? box.x - x : x > box.x + box.width ? x - (box.x + box.width) : 0;
  const dy = y < box.y ? box.y - y : y > box.y + box.height ? y - (box.y + box.height) : 0;
  return Math.hypot(dx, dy);
}

function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function estimateGlobalMotion(previous: SpatialNode[], current: SpatialNode[]): MotionEstimate {
  const used = new Set<string>();
  const shifts: Array<{ dx: number; dy: number }> = [];

  for (const before of previous) {
    const candidates = current
      .filter((after) => after.label === before.label && !used.has(after.id))
      .map((after) => ({
        node: after,
        distance: centerDistance(before.box, after.box),
        sameId: after.id === before.id,
      }))
      .filter((item) => item.sameId || item.distance <= 0.22)
      .sort((a, b) => Number(b.sameId) - Number(a.sameId) || a.distance - b.distance);

    const match = candidates[0];
    if (!match) continue;
    used.add(match.node.id);
    shifts.push({
      dx: match.node.centerX - before.centerX,
      dy: match.node.centerY - before.centerY,
    });
  }

  if (shifts.length < 2) return { magnitude: 0, coherence: 0, anchors: shifts.length, unstable: false };

  const dx = median(shifts.map((item) => item.dx));
  const dy = median(shifts.map((item) => item.dy));
  const residual = median(shifts.map((item) => Math.hypot(item.dx - dx, item.dy - dy)));
  const coherence = clamp01(1 - residual / 0.04);
  const magnitude = Math.hypot(dx, dy);

  return {
    magnitude,
    coherence,
    anchors: shifts.length,
    unstable: magnitude >= 0.028 && coherence >= 0.55,
  };
}

function nearestHandForNode(
  node: SpatialNode,
  hands: InteractionHandSample[],
): { hand: InteractionHandSample; distance: number } | null {
  let best: { hand: InteractionHandSample; distance: number } | null = null;
  for (const hand of hands) {
    if (!Number.isFinite(hand.x) || !Number.isFinite(hand.y)) continue;
    const distance = pointBoxDistance(hand.x, hand.y, node.box);
    if (!best || distance < best.distance) best = { hand, distance };
  }
  return best;
}

function gestureSupport(hand: InteractionHandSample): number {
  if (hand.pinching) return 1;
  if (hand.gesture === 'Closed_Fist') return 0.82;
  if (hand.gesture === 'Open_Palm') return 0.68;
  if (hand.gesture === 'Pointing_Up') return 0.58;
  return 0.46;
}

/**
 * Action Sequence v12 links only short-lived visual events:
 * hand approaches -> object leaves/gets occluded -> same-label object reappears elsewhere.
 * It stays RAM-only and deliberately treats the result as a possible sequence, never proof
 * of touch, grasp, pickup, placement, ownership, or intent.
 */
export class ActionSequenceTracker {
  private proximity = new Map<string, ProximityMemory>();
  private previousNodes: SpatialNode[] = [];
  private processedEventIds = new Set<string>();
  private target: TargetMemory | null = null;
  private reappearance: ReappearanceMemory | null = null;
  private cameraMotionGuardUntil = 0;
  private sequenceSeq = 0;
  private lastTickAt = 0;
  private state: ActionSequenceState = { ...EMPTY_ACTION_SEQUENCE };

  private setState(next: ActionSequenceState): ActionSequenceState {
    this.state = next;
    if (next.updatedAt > 0) this.lastTickAt = next.updatedAt;
    return { ...next, steps: [...next.steps] };
  }

  private resetSequence(now: number): void {
    this.target = null;
    this.reappearance = null;
    this.lastTickAt = now;
    this.state = { ...EMPTY_ACTION_SEQUENCE, sequenceId: this.state.sequenceId, updatedAt: now };
  }

  private decay(now: number, cameraStable: boolean): void {
    if (this.state.stage === 'idle') {
      this.lastTickAt = now;
      return;
    }
    if (this.lastTickAt <= 0) this.lastTickAt = this.state.updatedAt || now;
    if (now <= this.lastTickAt) return;
    const elapsed = now - this.lastTickAt;
    const halfLife = cameraStable ? 2_400 : 900;
    this.state.confidence = clamp01(this.state.confidence * Math.pow(0.5, elapsed / halfLife));
    this.lastTickAt = now;
  }

  private updateProximity(
    graph: SpatialSceneGraph,
    hands: InteractionHandSample[],
    now: number,
  ): { node: SpatialNode; hand: InteractionHandSample; confidence: number } | null {
    let best: { node: SpatialNode; hand: InteractionHandSample; confidence: number } | null = null;

    for (const node of graph.nodes) {
      if (node.kind !== 'object') continue;
      const nearest = nearestHandForNode(node, hands);
      if (!nearest) continue;

      const previous = this.proximity.get(node.id);
      const elapsed = previous ? now - previous.at : 0;
      const closing = previous && elapsed >= 120 && elapsed <= 1_400
        ? previous.distance - nearest.distance
        : 0;

      if (nearest.distance <= 0.12 && closing >= 0.035) {
        const proximityScore = clamp01(1 - nearest.distance / 0.12);
        const closingScore = clamp01(closing / 0.12);
        const confidence = clamp01(
          proximityScore * 0.43 +
          node.score * 0.27 +
          closingScore * 0.2 +
          gestureSupport(nearest.hand) * 0.1
        );
        if (!best || confidence > best.confidence) {
          best = { node, hand: nearest.hand, confidence };
        }
      }

      this.proximity.set(node.id, { distance: nearest.distance, at: now });
    }

    for (const [id, memory] of this.proximity) {
      if (now - memory.at > 2_500) this.proximity.delete(id);
    }
    return best;
  }

  private continuityCandidate(graph: SpatialSceneGraph): {
    node: SpatialNode;
    rebound: boolean;
    ambiguous: boolean;
  } | null {
    if (!this.target) return null;
    const sameLabel = graph.nodes.filter((node) => node.kind === 'object' && node.label === this.target?.label);
    if (!sameLabel.length) return null;

    const exact = sameLabel.find((node) => node.id === this.target?.objectId);
    if (exact) return { node: exact, rebound: false, ambiguous: false };

    const ranked = sameLabel
      .map((node) => {
        const distance = centerDistance(this.target!.box, node.box);
        const overlap = boxIoU(this.target!.box, node.box);
        const continuity = overlap * 0.65 + clamp01(1 - distance / 0.24) * 0.35;
        return { node, distance, overlap, continuity };
      })
      .sort((a, b) => b.continuity - a.continuity);

    const best = ranked[0];
    const second = ranked[1];
    const ambiguous = Boolean(second && best.continuity - second.continuity < 0.08);
    const nearEnough = best.distance <= 0.075 || best.overlap >= 0.28;
    if (!nearEnough) return null;
    return { node: best.node, rebound: true, ambiguous };
  }

  private reappearanceCandidate(graph: SpatialSceneGraph): {
    node: SpatialNode;
    distance: number;
  } | null {
    if (!this.target) return null;
    const sameLabel = graph.nodes.filter((node) => node.kind === 'object' && node.label === this.target?.label);
    if (sameLabel.length !== 1) return null;

    const node = sameLabel[0];
    const distance = centerDistance(this.target.box, node.box);
    if (distance < 0.11) return null;
    return { node, distance };
  }

  private rememberNodes(graph: SpatialSceneGraph): void {
    this.previousNodes = graph.nodes.map((node) => ({ ...node, box: copyBox(node.box) }));
  }

  update(
    graph: SpatialSceneGraph,
    hands: InteractionHandSample[],
    now = performance.now(),
  ): ActionSequenceState {
    const motion = estimateGlobalMotion(this.previousNodes, graph.nodes);
    if (motion.unstable) this.cameraMotionGuardUntil = Math.max(this.cameraMotionGuardUntil, now + 700);
    const cameraStable = now > this.cameraMotionGuardUntil;

    this.decay(now, cameraStable);
    this.state.cameraMotion = motion.magnitude;
    this.state.cameraStable = cameraStable;

    const approach = this.updateProximity(graph, hands, now);
    const newEvents = graph.events
      .filter((event) => !this.processedEventIds.has(event.id))
      .sort((a, b) => a.at - b.at);
    for (const event of newEvents) this.processedEventIds.add(event.id);

    if (this.processedEventIds.size > 128) {
      this.processedEventIds = new Set(graph.events.slice(-32).map((event) => event.id));
    }

    if (!cameraStable) {
      if (this.state.stage !== 'idle') {
        this.state.note = 'Camera motion guard đang chặn suy luận chuỗi vì nhiều vùng cùng dịch chuyển.';
      }
      this.rememberNodes(graph);
      if (this.state.confidence < 0.18) this.resetSequence(now);
      return { ...this.state, steps: [...this.state.steps] };
    }

    if (this.state.stage === 'idle' && approach) {
      this.sequenceSeq += 1;
      this.target = {
        objectId: approach.node.id,
        label: approach.node.label,
        handedness: approach.hand.handedness,
        box: copyBox(approach.node.box),
        lastSeenAt: now,
        startedAt: now,
      };
      this.reappearance = null;
      this.setState({
        stage: 'hand_approach',
        sequenceId: this.sequenceSeq,
        objectId: approach.node.id,
        objectLabel: approach.node.label,
        handedness: approach.hand.handedness,
        confidence: approach.confidence,
        startedAt: now,
        updatedAt: now,
        cameraMotion: motion.magnitude,
        cameraStable: true,
        identityRebound: false,
        steps: ['hand_approach'],
        note: 'Bàn tay đang tiến gần box vật thể theo chuỗi thời gian.',
      });
    }

    if (this.target && (this.state.stage === 'hand_approach' || this.state.stage === 'object_reappeared')) {
      const continuity = this.continuityCandidate(graph);
      if (continuity && !continuity.ambiguous) {
        if (continuity.rebound) {
          this.state.identityRebound = true;
          this.state.note = 'Detector đổi ID gần vị trí cũ; sequence giữ cùng target và không coi là biến mất.';
        }
        this.target.objectId = continuity.node.id;
        this.target.box = copyBox(continuity.node.box);
        this.target.lastSeenAt = now;
        this.state.objectId = continuity.node.id;
      }
    }

    if (this.target && this.state.stage === 'hand_approach') {
      const leftEvent = newEvents.find((event) =>
        event.type === 'object_left' &&
        event.label === this.target?.label &&
        event.at >= this.target!.startedAt
      );

      if (leftEvent) {
        const continuity = this.continuityCandidate(graph);
        if (continuity && !continuity.ambiguous) {
          this.target.objectId = continuity.node.id;
          this.target.box = copyBox(continuity.node.box);
          this.target.lastSeenAt = now;
          this.state.objectId = continuity.node.id;
          this.state.identityRebound = this.state.identityRebound || continuity.rebound;
          this.state.note = 'ID-switch/continuity guard giữ target; object_left bị bỏ qua.';
        } else {
          this.reappearance = null;
          this.setState({
            ...this.state,
            stage: 'object_occluded',
            confidence: clamp01(this.state.confidence * 0.88),
            updatedAt: now,
            steps: [...this.state.steps, 'object_occluded'],
            note: 'Object vừa rời detector sau khi tay tiến gần; có thể là che khuất hoặc mất detection.',
          });
        }
      }
    }

    if (this.target && this.state.stage === 'object_occluded') {
      const elapsed = now - this.target.lastSeenAt;
      if (elapsed > 5_000) {
        this.resetSequence(now);
      } else if (elapsed >= 120) {
        const candidate = this.reappearanceCandidate(graph);
        if (candidate) {
          if (!this.reappearance || this.reappearance.objectId !== candidate.node.id) {
            this.reappearance = {
              objectId: candidate.node.id,
              since: now,
              distance: candidate.distance,
              score: candidate.node.score,
            };
            this.setState({
              ...this.state,
              stage: 'object_reappeared',
              objectId: candidate.node.id,
              confidence: clamp01(
                this.state.confidence * 0.68 +
                candidate.node.score * 0.18 +
                clamp01((candidate.distance - 0.11) / 0.3) * 0.14
              ),
              updatedAt: now,
              steps: [...this.state.steps, 'object_reappeared_elsewhere'],
              note: 'Object cùng nhãn xuất hiện ở vị trí khác; đang chờ ổn định để tránh detector flicker.',
            });
          }
        }
      }
    }

    if (this.target && this.state.stage === 'object_reappeared' && this.reappearance) {
      const node = graph.nodes.find((item) =>
        item.id === this.reappearance?.objectId &&
        item.label === this.target?.label &&
        item.kind === 'object'
      );
      if (!node) {
        this.reappearance = null;
        this.setState({
          ...this.state,
          stage: 'object_occluded',
          confidence: clamp01(this.state.confidence * 0.82),
          updatedAt: now,
          steps: this.state.steps.filter((step) => step !== 'object_reappeared_elsewhere'),
          note: 'Reappearance chưa ổn định; quay lại trạng thái occluded.',
        });
      } else if (now - this.reappearance.since >= 280) {
        this.target.objectId = node.id;
        this.target.box = copyBox(node.box);
        this.target.lastSeenAt = now;
        this.setState({
          ...this.state,
          stage: 'possible_reposition_sequence',
          objectId: node.id,
          confidence: clamp01(
            this.state.confidence * 0.78 +
            node.score * 0.12 +
            clamp01(this.reappearance.distance / 0.32) * 0.1
          ),
          updatedAt: now,
          note: 'Chuỗi hand approach → occlusion/lost detection → reappearance elsewhere đã đủ điều kiện temporal; vẫn chỉ là proxy 2D.',
        });
      }
    }

    if (
      this.state.stage === 'possible_reposition_sequence' &&
      now - this.state.updatedAt > 4_500
    ) {
      this.resetSequence(now);
    } else if (
      this.state.stage !== 'idle' &&
      now - this.state.startedAt > 7_000
    ) {
      this.resetSequence(now);
    } else if (this.state.stage !== 'idle' && this.state.confidence < 0.18) {
      this.resetSequence(now);
    }

    this.rememberNodes(graph);
    return { ...this.state, steps: [...this.state.steps] };
  }

  reset(): void {
    this.proximity.clear();
    this.previousNodes = [];
    this.processedEventIds.clear();
    this.target = null;
    this.reappearance = null;
    this.cameraMotionGuardUntil = 0;
    this.sequenceSeq = 0;
    this.lastTickAt = 0;
    this.state = { ...EMPTY_ACTION_SEQUENCE };
  }
}

export function actionSequencePrompt(state: ActionSequenceState, now = performance.now()): string {
  if (state.stage !== 'possible_reposition_sequence') return '';
  if (!state.cameraStable || state.confidence < 0.58 || now - state.updatedAt > 4_000) return '';

  return '[MIRA_ACTION_SEQUENCE label="' + state.objectLabel +
    '" confidence="' + Math.round(state.confidence * 100) + '"] ' +
    'Camera có một possible temporal sequence với "' + state.objectLabel +
    '": tay tiến gần → object bị che/mất detection → object cùng nhãn xuất hiện ở vị trí khác. ' +
    'Đây là proxy 2D đã qua camera-motion guard và ID-switch guard; không khẳng định người dùng đã chạm, cầm, nhấc, đặt hay cố ý di chuyển vật.';
}
