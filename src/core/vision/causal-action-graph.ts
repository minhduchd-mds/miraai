import type { ObjectBox } from './environment-model';
import type { ActionSequenceState } from './action-sequence';
import type { InteractionHandSample } from './object-interaction';
import type { SpatialNode, SpatialSceneEvent, SpatialSceneGraph } from './spatial-scene-graph';

export type CausalHypothesisStage =
  | 'approach'
  | 'occluded'
  | 'reappeared'
  | 'supported'
  | 'suppressed';

export type CausalEvidenceKind =
  | 'hand_approach'
  | 'object_disappeared'
  | 'object_reappeared_elsewhere'
  | 'hand_withdraw'
  | 'identity_rebind'
  | 'detector_return'
  | 'camera_motion_guard';

export interface CausalEvidence {
  id: string;
  kind: CausalEvidenceKind;
  strength: number;
  at: number;
  note: string;
}

export interface CausalEdge {
  from: CausalEvidenceKind;
  to: CausalEvidenceKind;
  relation: 'precedes' | 'supports' | 'alternative';
  weight: number;
}

export interface CausalHypothesis {
  id: string;
  objectId: string;
  objectLabel: string;
  handedness: string;
  stage: CausalHypothesisStage;
  confidence: number;
  startedAt: number;
  updatedAt: number;
  lastEvidenceAt: number;
  identityRebound: boolean;
  evidence: CausalEvidence[];
  edges: CausalEdge[];
  note: string;
}

export interface CausalActionGraphState {
  hypotheses: CausalHypothesis[];
  leader: CausalHypothesis | null;
  competingCount: number;
  margin: number;
  cameraStable: boolean;
  updatedAt: number;
  note: string;
}

export const EMPTY_CAUSAL_ACTION_GRAPH: CausalActionGraphState = {
  hypotheses: [],
  leader: null,
  competingCount: 0,
  margin: 0,
  cameraStable: true,
  updatedAt: 0,
  note: '',
};

interface MutableHypothesis extends CausalHypothesis {
  originBox: ObjectBox;
  currentBox: ObjectBox;
  reappearedSince: number;
  lastTickAt: number;
}

interface PairMemory {
  distance: number;
  at: number;
}

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

function gestureSupport(hand: InteractionHandSample): number {
  if (hand.pinching) return 1;
  if (hand.gesture === 'Closed_Fist') return 0.82;
  if (hand.gesture === 'Open_Palm') return 0.68;
  if (hand.gesture === 'Pointing_Up') return 0.58;
  return 0.46;
}

function publicHypothesis(hypothesis: MutableHypothesis): CausalHypothesis {
  return {
    id: hypothesis.id,
    objectId: hypothesis.objectId,
    objectLabel: hypothesis.objectLabel,
    handedness: hypothesis.handedness,
    stage: hypothesis.stage,
    confidence: hypothesis.confidence,
    startedAt: hypothesis.startedAt,
    updatedAt: hypothesis.updatedAt,
    lastEvidenceAt: hypothesis.lastEvidenceAt,
    identityRebound: hypothesis.identityRebound,
    evidence: hypothesis.evidence.map((item) => ({ ...item })),
    edges: hypothesis.edges.map((edge) => ({ ...edge })),
    note: hypothesis.note,
  };
}

function latestEvidence(hypothesis: MutableHypothesis): CausalEvidenceKind | null {
  return hypothesis.evidence[hypothesis.evidence.length - 1]?.kind || null;
}

/**
 * v13 is an evidence graph, not a physical-causality oracle.
 * Multiple hand/object explanations can coexist. A leader is exposed only when
 * one completed hypothesis has enough evidence and a clear margin over competitors.
 * Temporal order is evidence structure, not proof of causality.
 */
export class CausalActionGraphTracker {
  private pairMemory = new Map<string, PairMemory>();
  private hypotheses = new Map<string, MutableHypothesis>();
  private processedEventIds = new Set<string>();
  private seq = 0;
  private evidenceSeq = 0;

  private pushEvidence(
    hypothesis: MutableHypothesis,
    kind: CausalEvidenceKind,
    strength: number,
    now: number,
    note: string,
    relation: CausalEdge['relation'] = 'supports',
  ): void {
    const previous = latestEvidence(hypothesis);
    this.evidenceSeq += 1;
    hypothesis.evidence.push({
      id: 'cause-evidence-' + this.evidenceSeq,
      kind,
      strength: clamp01(strength),
      at: now,
      note,
    });
    if (previous) {
      hypothesis.edges.push({
        from: previous,
        to: kind,
        relation,
        weight: clamp01(strength),
      });
    }
    hypothesis.evidence = hypothesis.evidence.slice(-8);
    hypothesis.edges = hypothesis.edges.slice(-8);
    hypothesis.updatedAt = now;
    hypothesis.lastEvidenceAt = now;
    hypothesis.lastTickAt = now;
  }

  private createHypothesis(
    node: SpatialNode,
    hand: InteractionHandSample,
    confidence: number,
    now: number,
  ): MutableHypothesis {
    this.seq += 1;
    const hypothesis: MutableHypothesis = {
      id: 'cause-' + this.seq,
      objectId: node.id,
      objectLabel: node.label,
      handedness: hand.handedness,
      stage: 'approach',
      confidence,
      startedAt: now,
      updatedAt: now,
      lastEvidenceAt: now,
      identityRebound: false,
      evidence: [],
      edges: [],
      note: 'Bàn tay đang tiến gần object; đây mới là hypothesis quan sát.',
      originBox: copyBox(node.box),
      currentBox: copyBox(node.box),
      reappearedSince: 0,
      lastTickAt: now,
    };
    this.pushEvidence(
      hypothesis,
      'hand_approach',
      confidence,
      now,
      'Khoảng cách tay-object giảm theo thời gian.',
    );
    this.hypotheses.set(hypothesis.id, hypothesis);
    return hypothesis;
  }

  private activeHypothesisFor(node: SpatialNode, handedness: string): MutableHypothesis | null {
    const candidates = [...this.hypotheses.values()]
      .filter((hypothesis) =>
        hypothesis.stage !== 'suppressed' &&
        hypothesis.handedness === handedness &&
        hypothesis.objectLabel === node.label &&
        (
          hypothesis.objectId === node.id ||
          centerDistance(hypothesis.currentBox, node.box) <= 0.085
        )
      )
      .sort((a, b) => b.confidence - a.confidence);
    return candidates[0] || null;
  }

  private continuity(
    hypothesis: MutableHypothesis,
    graph: SpatialSceneGraph,
  ): { node: SpatialNode; rebound: boolean; ambiguous: boolean } | null {
    const sameLabel = graph.nodes.filter((node) =>
      node.kind === 'object' && node.label === hypothesis.objectLabel
    );
    const exact = sameLabel.find((node) => node.id === hypothesis.objectId);
    if (exact) return { node: exact, rebound: false, ambiguous: false };
    if (!sameLabel.length) return null;

    const ranked = sameLabel
      .map((node) => {
        const distance = centerDistance(hypothesis.currentBox, node.box);
        const overlap = boxIoU(hypothesis.currentBox, node.box);
        const continuityScore = overlap * 0.64 + clamp01(1 - distance / 0.24) * 0.36;
        return { node, distance, overlap, continuityScore };
      })
      .sort((a, b) => b.continuityScore - a.continuityScore);

    const best = ranked[0];
    const second = ranked[1];
    const nearEnough = best.distance <= 0.075 || best.overlap >= 0.28;
    if (!nearEnough) return null;
    return {
      node: best.node,
      rebound: true,
      ambiguous: Boolean(second && best.continuityScore - second.continuityScore < 0.08),
    };
  }

  private findHand(
    hands: InteractionHandSample[],
    handedness: string,
  ): InteractionHandSample | null {
    return hands.find((hand) => hand.handedness === handedness) || null;
  }

  private updateApproaches(
    graph: SpatialSceneGraph,
    hands: InteractionHandSample[],
    now: number,
  ): void {
    for (const hand of hands) {
      if (!Number.isFinite(hand.x) || !Number.isFinite(hand.y)) continue;
      for (const node of graph.nodes) {
        if (node.kind !== 'object') continue;
        const distance = pointBoxDistance(hand.x, hand.y, node.box);
        const key = hand.handedness + ':' + node.id;
        const previous = this.pairMemory.get(key);
        const elapsed = previous ? now - previous.at : 0;
        const closing = previous && elapsed >= 120 && elapsed <= 1_400
          ? previous.distance - distance
          : 0;
        this.pairMemory.set(key, { distance, at: now });

        if (distance > 0.12 || closing < 0.035) continue;
        const proximityScore = clamp01(1 - distance / 0.12);
        const confidence = clamp01(
          proximityScore * 0.42 +
          clamp01(closing / 0.12) * 0.22 +
          node.score * 0.26 +
          gestureSupport(hand) * 0.1
        );
        const existing = this.activeHypothesisFor(node, hand.handedness);
        if (existing) {
          existing.confidence = Math.max(existing.confidence, confidence);
          existing.currentBox = copyBox(node.box);
          existing.objectId = node.id;
          existing.lastTickAt = now;
        } else {
          this.createHypothesis(node, hand, confidence, now);
        }
      }
    }

    for (const [key, memory] of this.pairMemory) {
      if (now - memory.at > 2_600) this.pairMemory.delete(key);
    }
  }

  private applyContinuity(graph: SpatialSceneGraph, now: number): void {
    for (const hypothesis of this.hypotheses.values()) {
      if (hypothesis.stage === 'suppressed' || hypothesis.stage === 'occluded') continue;
      const continuity = this.continuity(hypothesis, graph);
      if (!continuity || continuity.ambiguous) continue;
      if (continuity.rebound && continuity.node.id !== hypothesis.objectId) {
        hypothesis.objectId = continuity.node.id;
        hypothesis.identityRebound = true;
        hypothesis.currentBox = copyBox(continuity.node.box);
        hypothesis.confidence = clamp01(hypothesis.confidence * 0.96);
        hypothesis.note = 'Detector đổi ID gần box cũ; hypothesis được rebind thay vì tạo disappearance giả.';
        this.pushEvidence(
          hypothesis,
          'identity_rebind',
          0.76,
          now,
          'Same-label box gần vị trí cũ được coi là continuity.',
          'alternative',
        );
      } else {
        hypothesis.currentBox = copyBox(continuity.node.box);
      }
    }
  }

  private eventMatches(
    hypothesis: MutableHypothesis,
    event: SpatialSceneEvent,
  ): boolean {
    return event.label === hypothesis.objectLabel && event.at >= hypothesis.startedAt;
  }

  private applyEvents(
    graph: SpatialSceneGraph,
    newEvents: SpatialSceneEvent[],
    now: number,
  ): void {
    for (const event of newEvents) {
      if (event.type !== 'object_left') continue;
      for (const hypothesis of this.hypotheses.values()) {
        if (hypothesis.stage !== 'approach' || !this.eventMatches(hypothesis, event)) continue;
        const continuity = this.continuity(hypothesis, graph);
        if (continuity && !continuity.ambiguous) {
          if (continuity.node.id !== hypothesis.objectId) {
            hypothesis.objectId = continuity.node.id;
            hypothesis.currentBox = copyBox(continuity.node.box);
            hypothesis.identityRebound = true;
            hypothesis.note = 'object_left bị bỏ qua vì continuity/ID-switch guard.';
            this.pushEvidence(
              hypothesis,
              'identity_rebind',
              0.74,
              now,
              'Một box cùng nhãn vẫn tồn tại gần vị trí trước đó.',
              'alternative',
            );
          }
          continue;
        }

        hypothesis.stage = 'occluded';
        hypothesis.confidence = clamp01(hypothesis.confidence * 0.86 + 0.08);
        hypothesis.note = 'Object biến mất sau hand approach; có thể là occlusion hoặc detector miss.';
        this.pushEvidence(
          hypothesis,
          'object_disappeared',
          hypothesis.confidence,
          now,
          'object_left xảy ra sau hand approach.',
        );
      }
    }

    for (const event of newEvents) {
      if (event.type !== 'object_returned') continue;
      for (const hypothesis of this.hypotheses.values()) {
        if (hypothesis.stage !== 'occluded' || !this.eventMatches(hypothesis, event)) continue;
        const nearReturn = graph.nodes
          .filter((node) => node.kind === 'object' && node.label === hypothesis.objectLabel)
          .some((node) => centerDistance(hypothesis.originBox, node.box) < 0.09);
        if (!nearReturn) continue;
        hypothesis.stage = 'suppressed';
        hypothesis.confidence = clamp01(hypothesis.confidence * 0.42);
        hypothesis.note = 'Object trở lại gần vị trí cũ; detector flicker/occlusion là alternative mạnh hơn.';
        this.pushEvidence(
          hypothesis,
          'detector_return',
          0.72,
          now,
          'Return gần vị trí cũ làm giảm hypothesis reposition.',
          'alternative',
        );
      }
    }
  }

  private applyReappearance(graph: SpatialSceneGraph, now: number): void {
    for (const hypothesis of this.hypotheses.values()) {
      if (hypothesis.stage !== 'occluded') continue;
      const elapsed = now - hypothesis.lastEvidenceAt;
      if (elapsed < 120 || elapsed > 5_000) continue;

      const candidates = graph.nodes
        .filter((node) => node.kind === 'object' && node.label === hypothesis.objectLabel)
        .map((node) => ({
          node,
          distance: centerDistance(hypothesis.originBox, node.box),
        }))
        .filter((item) => item.distance >= 0.11)
        .sort((a, b) => b.node.score - a.node.score);

      if (!candidates.length) continue;
      if (
        candidates.length > 1 &&
        Math.abs(candidates[0].node.score - candidates[1].node.score) < 0.08
      ) {
        hypothesis.note = 'Nhiều object cùng nhãn có điểm gần nhau; giữ ambiguous, chưa nối reappearance.';
        continue;
      }

      const candidate = candidates[0];
      hypothesis.stage = 'reappeared';
      hypothesis.objectId = candidate.node.id;
      hypothesis.currentBox = copyBox(candidate.node.box);
      hypothesis.reappearedSince = now;
      hypothesis.confidence = clamp01(
        hypothesis.confidence * 0.72 +
        candidate.node.score * 0.15 +
        clamp01(candidate.distance / 0.32) * 0.13
      );
      hypothesis.note = 'Same-label object xuất hiện xa vị trí gốc; chờ ổn định và hand withdrawal.';
      this.pushEvidence(
        hypothesis,
        'object_reappeared_elsewhere',
        hypothesis.confidence,
        now,
        'Object cùng nhãn xuất hiện ở vị trí khác.',
      );
    }
  }

  private applyWithdrawal(
    graph: SpatialSceneGraph,
    hands: InteractionHandSample[],
    now: number,
  ): void {
    for (const hypothesis of this.hypotheses.values()) {
      if (hypothesis.stage !== 'reappeared' || now - hypothesis.reappearedSince < 280) continue;
      const node = graph.nodes.find((item) =>
        item.kind === 'object' &&
        item.id === hypothesis.objectId &&
        item.label === hypothesis.objectLabel
      );
      if (!node) continue;

      const hand = this.findHand(hands, hypothesis.handedness);
      if (!hand) {
        hypothesis.note = 'Object reappearance ổn định nhưng chưa thấy evidence hand withdrawal.';
        continue;
      }

      const distance = pointBoxDistance(hand.x, hand.y, node.box);
      const withdrawThreshold = Math.max(
        0.1,
        Math.min(0.16, Math.sqrt(boxArea(node.box)) * 0.6),
      );
      if (distance < withdrawThreshold) continue;

      hypothesis.currentBox = copyBox(node.box);
      hypothesis.stage = 'supported';
      hypothesis.confidence = clamp01(
        hypothesis.confidence * 0.88 +
        clamp01((distance - withdrawThreshold) / 0.25) * 0.07 +
        node.score * 0.05
      );
      hypothesis.note = 'Evidence graph đủ 4 bước, nhưng vẫn chỉ hỗ trợ một possible hand-mediated reposition.';
      this.pushEvidence(
        hypothesis,
        'hand_withdraw',
        hypothesis.confidence,
        now,
        'Bàn tay cùng phía đã rời xa object sau reappearance.',
      );
    }
  }

  private decay(now: number, cameraStable: boolean): void {
    for (const hypothesis of this.hypotheses.values()) {
      if (now <= hypothesis.lastTickAt) continue;
      const elapsed = now - hypothesis.lastTickAt;
      const halfLife = cameraStable
        ? hypothesis.stage === 'supported' ? 3_200 : 2_400
        : 850;
      hypothesis.confidence = clamp01(
        hypothesis.confidence * Math.pow(0.5, elapsed / halfLife)
      );
      hypothesis.lastTickAt = now;
    }
  }

  private prune(now: number): void {
    for (const [id, hypothesis] of this.hypotheses) {
      const stale = now - hypothesis.startedAt > 8_000;
      const supportedStale = hypothesis.stage === 'supported' && now - hypothesis.lastEvidenceAt > 5_000;
      if (
        hypothesis.confidence < 0.16 ||
        hypothesis.stage === 'suppressed' && now - hypothesis.lastEvidenceAt > 1_500 ||
        stale ||
        supportedStale
      ) {
        this.hypotheses.delete(id);
      }
    }

    if (this.hypotheses.size > 6) {
      const keep = [...this.hypotheses.values()]
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, 6);
      this.hypotheses = new Map(keep.map((item) => [item.id, item]));
    }
  }

  private snapshot(cameraStable: boolean, now: number): CausalActionGraphState {
    const ranked = [...this.hypotheses.values()]
      .filter((hypothesis) => hypothesis.stage !== 'suppressed')
      .sort((a, b) => b.confidence - a.confidence);

    const supported = ranked.filter((hypothesis) =>
      hypothesis.stage === 'supported' && hypothesis.confidence >= 0.62
    );
    const first = supported[0] || null;
    const competitor = ranked.find((hypothesis) => hypothesis.id !== first?.id) || null;
    const margin = first
      ? clamp01(first.confidence - (competitor?.confidence || 0))
      : 0;
    const leader = first && (!competitor || margin >= 0.08)
      ? first
      : null;

    const competingCount = ranked.length;
    const note = !cameraStable
      ? 'Camera-motion guard đang khóa causal graph.'
      : first && competitor && margin < 0.08
        ? 'Nhiều hypothesis có điểm gần nhau; Mira giữ ambiguous.'
        : leader
          ? 'Có leading hypothesis với margin đủ lớn; đây vẫn là evidence-based proxy, không phải chứng minh nhân quả.'
          : competingCount
            ? 'Đang tích lũy evidence cho nhiều hypothesis song song.'
            : '';

    return {
      hypotheses: ranked.map(publicHypothesis),
      leader: leader ? publicHypothesis(leader) : null,
      competingCount,
      margin,
      cameraStable,
      updatedAt: now,
      note,
    };
  }

  update(
    graph: SpatialSceneGraph,
    hands: InteractionHandSample[],
    actionSequence: ActionSequenceState,
    now = performance.now(),
  ): CausalActionGraphState {
    const cameraStable = actionSequence.cameraStable !== false;
    this.decay(now, cameraStable);

    const newEvents = graph.events
      .filter((event) => !this.processedEventIds.has(event.id))
      .sort((a, b) => a.at - b.at);
    for (const event of newEvents) this.processedEventIds.add(event.id);
    if (this.processedEventIds.size > 128) {
      this.processedEventIds = new Set(graph.events.slice(-32).map((event) => event.id));
    }

    if (!cameraStable) {
      for (const hypothesis of this.hypotheses.values()) {
        hypothesis.note = 'Camera-motion guard đang chặn evidence mới.';
      }
      this.prune(now);
      return this.snapshot(false, now);
    }

    this.updateApproaches(graph, hands, now);
    this.applyContinuity(graph, now);
    this.applyEvents(graph, newEvents, now);
    this.applyReappearance(graph, now);
    this.applyWithdrawal(graph, hands, now);
    this.prune(now);
    return this.snapshot(true, now);
  }

  reset(): void {
    this.pairMemory.clear();
    this.hypotheses.clear();
    this.processedEventIds.clear();
    this.seq = 0;
    this.evidenceSeq = 0;
  }
}

export function causalActionGraphPrompt(
  state: CausalActionGraphState,
  now = performance.now(),
): string {
  const leader = state.leader;
  if (!leader || !state.cameraStable) return '';
  if (
    leader.stage !== 'supported' ||
    leader.confidence < 0.62 ||
    state.margin < 0.08 ||
    now - leader.lastEvidenceAt > 4_000
  ) return '';

  return '[MIRA_CAUSAL_ACTION_GRAPH label="' + leader.objectLabel +
    '" hand="' + leader.handedness +
    '" confidence="' + Math.round(leader.confidence * 100) +
    '" margin="' + Math.round(state.margin * 100) + '"] ' +
    'Evidence graph quan sát được chuỗi tay tiến gần → object mất/che → object cùng nhãn xuất hiện nơi khác → tay rời xa. ' +
    'Đây chỉ là leading hypothesis phù hợp với possible hand-mediated reposition; thứ tự thời gian không chứng minh nguyên nhân, chạm/cầm/đặt hay ý định.';
}
