import type { ObjectBox } from './environment-model';

export type IdentityDecision = 'accept' | 'ambiguous' | 'reject';

export interface ObjectIdentityEvidence {
  sameLabel: boolean;
  previousBox: ObjectBox;
  currentBox: ObjectBox;
  ageMs: number;
  sceneContinuity: boolean;
  uniqueCandidate: boolean;
  appearanceSimilarity?: number | null;
  maskIoU?: number | null;
  causalSupport?: boolean;
}

export interface ObjectIdentityHypothesis {
  decision: IdentityDecision;
  score: number;
  centerDistance: number;
  boxIoU: number;
  scaleSimilarity: number;
  temporalContinuity: number;
  appearanceSimilarity: number | null;
  maskIoU: number | null;
  evidence: string[];
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

function area(box: ObjectBox): number {
  return Math.max(1e-6, Math.max(0, box.width) * Math.max(0, box.height));
}

function center(box: ObjectBox): { x: number; y: number } {
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

export function identityCenterDistance(a: ObjectBox, b: ObjectBox): number {
  const ac = center(a);
  const bc = center(b);
  return Math.hypot(ac.x - bc.x, ac.y - bc.y);
}

export function identityBoxIoU(a: ObjectBox, b: ObjectBox): number {
  const ix1 = Math.max(a.x, b.x);
  const iy1 = Math.max(a.y, b.y);
  const ix2 = Math.min(a.x + a.width, b.x + b.width);
  const iy2 = Math.min(a.y + a.height, b.y + b.height);
  const iw = Math.max(0, ix2 - ix1);
  const ih = Math.max(0, iy2 - iy1);
  const intersection = iw * ih;
  const union = Math.max(1e-6, area(a) + area(b) - intersection);
  return clamp01(intersection / union);
}

export function evaluateObjectIdentityHypothesis(input: ObjectIdentityEvidence): ObjectIdentityHypothesis {
  const centerDistance = identityCenterDistance(input.previousBox, input.currentBox);
  const boxIoU = identityBoxIoU(input.previousBox, input.currentBox);
  const scaleSimilarity = clamp01(
    Math.min(area(input.previousBox), area(input.currentBox)) /
    Math.max(area(input.previousBox), area(input.currentBox))
  );
  const temporalContinuity = clamp01(1 - Math.max(0, input.ageMs) / 30_000);
  const appearanceSimilarity = input.appearanceSimilarity == null
    ? null
    : clamp01(input.appearanceSimilarity);
  const maskIoU = input.maskIoU == null ? null : clamp01(input.maskIoU);

  if (!input.sameLabel) {
    return {
      decision: 'reject',
      score: 0,
      centerDistance,
      boxIoU,
      scaleSimilarity,
      temporalContinuity,
      appearanceSimilarity,
      maskIoU,
      evidence: ['label_mismatch'],
    };
  }

  const spatialContinuity = clamp01(1 - centerDistance / 0.28);
  let score =
    0.12 +
    spatialContinuity * 0.24 +
    boxIoU * 0.16 +
    scaleSimilarity * 0.12 +
    temporalContinuity * 0.1 +
    (input.sceneContinuity ? 0.14 : 0) +
    (input.uniqueCandidate ? 0.1 : 0) +
    (input.causalSupport ? 0.04 : 0);

  if (appearanceSimilarity != null) score += appearanceSimilarity * 0.05;
  if (maskIoU != null) score += maskIoU * 0.07;
  score = clamp01(score);

  const evidence: string[] = ['same_label'];
  if (centerDistance <= 0.09) evidence.push('near_position');
  if (boxIoU >= 0.28) evidence.push('box_overlap');
  if (scaleSimilarity >= 0.72) evidence.push('scale_consistent');
  if (temporalContinuity >= 0.75) evidence.push('recent_observation');
  if (input.sceneContinuity) evidence.push('scene_return_or_relocation');
  if (input.uniqueCandidate) evidence.push('unique_candidate');
  if (appearanceSimilarity != null) evidence.push('appearance_signal');
  if (maskIoU != null) evidence.push('mask_signal');
  if (input.causalSupport) evidence.push('action_hypothesis_support');

  const far = centerDistance > 0.09;
  let decision: IdentityDecision = 'reject';

  if (!far) {
    decision = score >= 0.52 && (boxIoU >= 0.16 || input.uniqueCandidate)
      ? 'accept'
      : score >= 0.4
        ? 'ambiguous'
        : 'reject';
  } else if (!input.uniqueCandidate) {
    decision = 'ambiguous';
  } else if (!input.sceneContinuity) {
    decision = score >= 0.7 && (appearanceSimilarity || 0) >= 0.78
      ? 'ambiguous'
      : 'reject';
  } else {
    const enriched = appearanceSimilarity != null || maskIoU != null;
    const threshold = enriched ? 0.56 : 0.48;
    decision = score >= threshold ? 'accept' : score >= threshold - 0.12 ? 'ambiguous' : 'reject';
  }

  return {
    decision,
    score,
    centerDistance,
    boxIoU,
    scaleSimilarity,
    temporalContinuity,
    appearanceSimilarity,
    maskIoU,
    evidence,
  };
}
