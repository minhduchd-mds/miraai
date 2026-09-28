# Mira World Model v14

World Model v14 is the short-term visual continuity layer behind Mira's camera mode.

## Purpose

It turns the existing Spatial Scene Graph + Action Sequence v12 + Causal Action Graph v13 into a conservative RAM-only world state:

- remembers stable objects after brief detector loss;
- decays confidence while an object is missing;
- distinguishes near return from screen-space relocation;
- can use a strong v13 action hypothesis as supporting evidence without converting it into proof;
- expires unresolved memories instead of keeping them indefinitely.

## Boundaries

This is not physical object identity, SLAM, metric depth, ownership detection, intent detection, or proof that a person touched/moved an object.

A detector ID change is treated only as a same-label continuity hypothesis. Far rebinds require one missing candidate, one visible same-label candidate, and an upstream return/relocation event.

## Lifetime

- missing grace: 0.9 s;
- confidence half-life while missing: 9 s;
- unresolved memory TTL: 30 s;
- event history: 90 s;
- prompt context window: 20 s.

The state is session RAM only and must never be persisted into long-term user memory.
