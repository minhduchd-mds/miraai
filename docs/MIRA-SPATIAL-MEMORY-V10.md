# Mira Spatial Memory v10

## Scope

Spatial Memory v10 extends the transient 2D scene graph with short-lived movement history.

It does not create long-term memory of rooms or possessions. The feature only keeps enough in-memory state to recognize that a detector box:
- moved while retaining the same session-local object ID,
- disappeared and returned near its previous position,
- disappeared and reappeared farther away with the same detector label.

## Events

New scene events:
- object_moved
- object_returned
- object_relocated

Movement distance is normalized to the mirrored camera frame.

A same-ID movement event requires a noticeable center displacement and is rate-limited to avoid flooding the timeline.

When an ID disappears, Mira keeps a small departure record for at most 12 seconds. If a new stable box with the same label appears during that window, it is matched to the nearest departure:
- under the relocation threshold -> object_returned,
- above the threshold -> object_relocated.

Because detector labels are not identities, this is deliberately called a proxy. Two different objects with the same class can be confused.

## Brain context

Recent movement can be included in Mira's transient runtime prompt.

Mira is explicitly told that box motion does **not** prove:
- who moved the object,
- that the object was picked up,
- that it was placed by a person,
- ownership or intent.

This keeps the feature useful for continuity without turning 2D detector changes into unsupported action claims.

## UI

Recent scene events show normalized displacement percentages when available, for example:

`object relocated · book · 46%`

## Privacy

Departure records, movement events and positions are session-only RAM state and are not stored in long-term memory.
