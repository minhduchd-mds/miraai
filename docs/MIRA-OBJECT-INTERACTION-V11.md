# Mira Object Interaction Proxy v11

## Goal

This layer combines **hand proximity** with the transient spatial scene graph to estimate when an object interaction may have happened.

It is intentionally conservative. The camera cannot prove physical contact or human intent from 2D boxes, so Mira never upgrades these signals into factual claims such as:
- "you picked it up",
- "you touched it",
- "you placed it there",
- "you own it",
- "you intentionally moved it".

## Inputs

The tracker receives:
- stable object nodes from Spatial Scene Graph,
- mirrored hand/palm coordinates,
- current gesture/pinch state,
- temporal object events such as object_moved, object_left, object_returned and object_relocated.

## Stages

### hand_near

A visible hand is close to a stable non-person object box.

This stage is UI telemetry only and is not sent to Mira Brain as an interaction claim.

### possible_manipulation

A hand was recently close to the same object and the object's detector box then moved.

The signal means only:
"hand proximity and object motion occurred close together in time."

### possible_reposition

A hand was near an object before it disappeared, and a same-label object returned or appeared farther away within a short temporal window.

This is still only a proxy because:
- detector IDs are session-local,
- two objects of the same class can be confused,
- occlusion can look like disappearance,
- 2D motion does not prove touch or grasp.

## Temporal memory

Hand/object proximity is kept for about 2 seconds.

A disappearance can remain eligible for a possible reposition for up to about 6 seconds.

All state is RAM-only and is reset when Vision stops.

## Brain context

Only possible_manipulation and possible_reposition can enter the transient prompt, and only above a confidence threshold.

The prompt explicitly says that Mira must not claim touch, grasp, pickup, placement, ownership or intent.

## UI

The Spatial Graph panel now adds an OBJECT INTERACTION row:
- No interaction proxy
- Hand near · object
- Possible interaction · object
- Possible reposition · object

Confidence is shown when available.

## Privacy

No frames, hand/object trajectories, interaction states or inferred events are written to long-term memory.
