# Mira Causal Action Graph v13

## Goal

v13 upgrades one linear Action Sequence into a small **competing evidence graph**.

It tracks multiple hand/object hypotheses at the same time and links observations:

`hand_approach → object_disappeared → object_reappeared_elsewhere → hand_withdraw`

The graph never treats temporal order as proof of physical causality.

## Competing hypotheses

Each candidate keeps its own:
- hand side,
- object label and current detector ID,
- confidence,
- evidence nodes,
- temporal edges,
- ID-rebind state,
- decay clock.

Up to six active hypotheses are retained. Only a supported hypothesis with a clear score margin may become the leader.

If candidates are close in score, Mira exposes the state as ambiguous instead of selecting one.

## Negative and alternative evidence

v13 explicitly handles alternatives:
- camera motion pauses all evidence advancement,
- a near same-label ID switch is rebound to the existing target,
- a same-label object returning near its old position suppresses reposition evidence,
- multiple similar reappearance candidates remain ambiguous.

## Confidence

Confidence decays continuously:
- active hypotheses: roughly 2.4 s half-life,
- supported hypothesis: roughly 3.2 s half-life,
- camera-motion guard: roughly 0.85 s half-life.

Low-confidence and stale hypotheses are removed.

## Leader gate

A hypothesis reaches `supported` only after the four-step evidence chain, including visible hand withdrawal.

It is exposed to Mira Brain only when:
- confidence >= 0.62,
- camera is stable,
- score margin over the strongest competitor >= 0.08,
- final evidence is recent.

## Wording boundary

The prompt deliberately says **leading hypothesis**, not cause.

Mira must not claim:
- touch,
- grasp,
- pickup,
- placement,
- ownership,
- intention,
- proven causation.

## Privacy

The graph is RAM-only. Boxes, evidence edges, hand/object distances and hypotheses are not written to long-term memory.
