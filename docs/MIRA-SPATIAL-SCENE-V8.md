# Mira Spatial Scene Graph v8

## Goal

Spatial Scene Graph v8 upgrades Environment Awareness from a flat list of detected objects into a small, transient 2D graph of visible relationships.

It is designed for interactions such as:
- pointing at an object and asking "cái này là gì?",
- understanding that a laptop is left/right of the main person region,
- noticing that a second person-shaped detection entered the camera frame,
- keeping object context stable across low-frequency detector frames.

## Coordinate system

The camera preview is mirrored for the user. Object detector boxes are therefore mirrored before they enter the spatial graph.

All relations are **screen-relative 2D geometry**, not world-space 3D facts.

Supported relation types:
- left_of
- right_of
- above
- below
- near
- overlaps

The graph does not claim depth, ownership, identity or real-world attachment.

## Person reference

When one or more person boxes exist, the graph chooses the largest/highest-confidence person region as a temporary geometric reference.

This is not face recognition and does not establish that the person is the owner.

## Pointing target

A Pointing Up hand gesture can activate the screen pointer.

The target does not lock immediately:
1. the pointer must be close to a stable non-person object,
2. the object must remain the same candidate for at least 320 ms,
3. object and gesture confidence are fused into target confidence.

If the pointer moves away while still active, the target is released quickly. If the hand stops pointing, the target can remain briefly so a spoken follow-up such as "cái này là gì?" still has context.

## Mira Brain context

When a pointing target is stable, the transient prompt explicitly tells Mira which detected object "cái này/vật này" most likely refers to.

If pointing is active but no object is stable under the pointer, the prompt tells Mira **not to guess**.

The prompt may also include a few high-confidence object-to-person 2D relations and a recent change in the count of person boxes.

## Scene events

The graph keeps a short in-memory event list:
- object_entered
- object_left
- focus_changed
- people_changed

These events use session-local detector IDs only.

## Privacy and memory

Spatial nodes, boxes, relations, pointing targets and events are ephemeral runtime state.

They are not written into Mira long-term memory, and no identity embedding, OCR or precise location is introduced by this feature.


## Deterministic deictic bridge

When a target is locked, the transient context also carries a machine-readable marker:

`[MIRA_VISUAL_TARGET label="..." confidence="..."]`

TurnManager checks a very narrow class of direct deictic questions such as:
- "Cái này là gì?"
- "Đây là gì?"
- "What is this?"

If a stable target exists, Mira answers from the local detector result immediately and states that camera recognition may be wrong. This path does not require the LLM.

If the hand is pointing but no stable target exists, Mira returns a no-guess response and asks the user to hold the pointing gesture or show the object more clearly.
