# Mira Spatial Interaction Runtime

Mira's production UI now supports a visionOS-inspired spatial interaction model over a normal webcam.

## Interaction model

### Indirect interaction

1. Calibrated gaze + head pose chooses the UI target.
2. The target must remain stable briefly before it becomes locked.
3. A hand pinch commits the focused action.
4. A nod can commit the focused action as a face-only fallback.
5. A shake cancels an active window grab.

This mirrors the interaction principle used by spatial interfaces: look to focus, then use a small hand gesture to commit. Mira does not have system-level eye tracking, so gaze is an approximation from webcam blendshapes/head pose and is deliberately confidence-gated.

### Direct interaction

When a stable pointing gesture is detected, the hand index point becomes the pointer. Pinch commits the selected control.

### Spatial windows

The camera monitor and Result Surface expose small window handles.

- pinch + hold on a focused handle starts grab;
- hand movement moves the window in x/y;
- release ends grab;
- two pinched hands scale and rotate the focused/last-active window.

Window movement stays clamped to a safe viewport range.

## Depth-ready path

The hand pipeline preserves landmark z values:

```text
MediaPipe hand landmark z
    ↓
TrackedHand.landmarks[].z
    ↓
visionSnapshot().pointerZ / hands[].z
    ↓
SpatialPoint3D.z
    ↓
grab session
```

Production now uses a guarded relative-depth mode during one-hand pinch-drag. The depth anchor requires six low-jitter samples, applies a dead zone, clamps travel, and falls back to x/y-only movement when confidence is insufficient. Monocular webcam z remains relative and is not treated as metric world depth.

The direct-hand pipeline also derives an index-finger `SpatialRay3D`. Ray hit-testing is enabled only for targets that explicitly declare a depth plane; ordinary UI keeps the safer 2D focus path.

A future metric-depth/WebXR/device adapter can replace the sensing source while keeping the same `SpatialPoint3D` / `SpatialRay3D` contracts for:

- a metric camera/hand ray;
- a world-space hit point;
- direct 3D touch/proximity;
- metric translate-z;
- real volumetric object manipulation.

This keeps the control state machine stable while swapping only the spatial sensing adapter.

## Safety and UX constraints

- No dwell-only activation; gaze alone never clicks.
- No blink-to-click because involuntary blinks create unacceptable false positives.
- Spatial control state is session-only.
- Camera/hand/gaze raw data is not added to long-term memory.
- Standard click/touch controls remain functional.
- UI feedback is intentionally minimal: focus ring, target label, and short action feedback.

## Core files

- `src/core/vision/spatial-ui-control.ts`
- `src/presence/SpatialControlOverlay.tsx`
- `src/app/AppV2.tsx`
- `src/presence/vision-runtime.ts`
- `src/core/face/gesture-tracker.ts`
- `src/core/vision/holistic-tracker.ts`
- `src/ui/vision-v2.css`
- `src/ui/result-surface.css`


## Spatial v3: fingertip collision volumes

Mira now creates session-only 3D collision volumes for spatial controls and windows.

```text
fingertip x/y/z
    ↓
SpatialAnchorVolume
    ↓
point-in-volume collision
    ↓
90 ms stable contact dwell
    ↓
direct spatial focus
    ↓
pinch required for commit / grab
```

This adds a real direct-contact state without treating noisy webcam depth as proof of physical touch.

Current rules:

- x, y and z must all fall inside the target volume;
- hand confidence must be at least 0.58;
- contact must remain stable for 90 ms;
- a short release grace prevents flicker;
- entering a volume never auto-clicks;
- pinch remains the commit/hold signal;
- direct touch state is RAM/session-only.

The current coordinate space is normalized camera-relative space. A future WebXR/depth-device adapter can supply metric world-space points and anchors while preserving the same `SpatialDirectTouchTracker` state machine.


## Spatial v4: manipulable objects

Mira now has a generic session-only `SpatialObjectRuntime`. The first production object is `mira.core`, rendered by the existing Mira Core orb rather than a separate demo surface.

Object interaction flow:

```text
gaze / hand ray / fingertip contact
    ↓
object focus
    ↓
pinch
    ↓
beginGrab
    ↓
one hand: move x / y / guarded z
two hands: scale / rotate
    ↓
release → place object
shake → cancel and restore pre-grab pose
```

Object poses use normalized interaction-space coordinates today. They are not physical meters. The runtime deliberately separates manipulation semantics from sensing, so a future WebXR/depth-device adapter can provide metric world-space poses without rewriting the grab/transform state machine.

The object runtime is bounded and ephemeral:

- x/y position is clamped to the interaction viewport;
- z is clamped to the supported relative-depth range;
- scale respects per-object min/max limits;
- rotation is normalized;
- cancel restores the exact pre-grab pose;
- object pose is not written to long-term personal memory.


## Spatial v5: world anchors and snapping

Mira now has a session-only spatial world graph above the object manipulation runtime.

```text
workspace.root
├─ dock.home
├─ dock.center
├─ surface.camera
│  └─ dock.camera
└─ surface.result
   └─ dock.result
```

When a spatial object is grabbed it detaches from its current parent. On release, `SpatialWorldRuntime` searches eligible anchors within their snap radius. A successful snap creates an `SpatialObjectAttachment` and resolves the object's world pose through the anchor hierarchy.

Because dock anchors are children of their surface anchors, an attached object follows the parent surface when that surface moves. The hierarchy is cycle-guarded and capped at eight parent levels.

Current behavior for `mira.core`:

- release near its original location → snap to `dock.home`;
- release near the viewport center → snap to `dock.center`;
- release near Camera → snap to `dock.camera`;
- release near Result Surface → snap to `dock.result`;
- release outside snap radii → remain free;
- grabbing an attached object detaches it first;
- cancel restores the pre-grab pose and previous attachment.

The current coordinates remain normalized interaction-space values. The world graph is sensor-agnostic and is designed so metric WebXR/device anchors can replace the current DOM/camera adapter later.


## Spatial v6: magnetic placement and surface constraints

Placement is now predictive rather than release-only.

During a grab, `SpatialWorldRuntime.previewSnapObject()` evaluates the current pose against eligible anchors and returns:

- target anchor and label;
- exact target pose;
- magnetic strength;
- whether the target is surface-constrained.

The dragged object is attracted progressively as it approaches an anchor, while a ghost preview shows the exact placement target. Releasing commits the normal snap attachment.

### Surface constraints

Camera and Result surfaces now expose bounded XY placement planes. When an object approaches a surface, the nearest point on that plane is used rather than forcing the object to the surface center. The point is clamped to the surface bounds.

### Object-to-object parenting

Every spatial object can expose an `object.<id>` anchor with `ownerObjectId`. Other objects may attach to it and follow its pose. Self-parenting is explicitly excluded from snap candidates.

This makes the world graph extensible to:

```text
workspace
└─ surface
   └─ parent object
      └─ child object
```

The hierarchy remains session-only and sensor-agnostic.


## Spatial v7: hand physics

Spatial object release now has interaction physics rather than stopping instantly.

```text
pinch grab
  ↓
pointer velocity estimator
  ↓
release classifier
  ├─ slow / strong magnetic target → place
  └─ fast / weak magnetic target → throw
                                   ↓
                                inertia
                                   ↓
                         damping + soft bounds
                                   ↓
                              settle / snap
```

### Velocity and throw

`SpatialPhysicsRuntime` estimates a filtered 3D pointer velocity during grab. A release becomes a throw only when the filtered speed clears the throw threshold and no strong magnetic placement target is active.

Velocity is expressed in normalized interaction-space units per second. It is an interaction model, not a physical measurement.

### Inertia and soft collision

Thrown objects continue moving after pinch release. Linear damping reduces velocity over time. Near the x/y/z world limits a soft boundary spring pushes the object inward; crossing the hard bound applies a low-restitution bounce.

The object can therefore feel weighted without being allowed to disappear outside the interaction volume.

### Spring placement

Magnetic placement now uses `applySpatialSpringConstraint()`. The object approaches a preview target progressively instead of teleporting toward it. Strong placement intent wins over throw classification.

During inertia, a slow object entering a strong magnetic target can be captured and snapped to that anchor.

Physics state is session-only and is never persisted to long-term memory.


## Spatial v8: multi-object physics and stacking

Mira now runs more than one production spatial object. `mira.core` and `mira.node` share one world graph and physics space.

### Object-object collision

Each object carries a bounded interaction-space collision radius and mass. `resolveSpatialObjectCollisions()` uses conservative sphere proxies to:

- separate overlap;
- preserve anchored/grabbed objects as static when required;
- calculate a low-restitution collision impulse;
- transfer part of the moving object's velocity into a free object.

A lighter node therefore reacts more strongly when pushed by the heavier core.

### Stack anchors

Every object exposes both:

- `object.<id>` — general parent anchor;
- `stack.<id>` — an offset dock above the parent object.

When a child snaps to a stack anchor it becomes attached through the normal world hierarchy and follows the parent as a spatial cluster.

### Anchor eligibility

Home anchors can now declare `acceptsObjectId`. This prevents Core and Node from competing for each other's home positions while keeping shared surfaces and stack anchors available.

Collision, velocity, stack and attachment state remain session-only. Radius and mass are interaction tuning values rather than physical measurements.


## Spatial v9: cluster manipulation and joints

The spatial world now exposes cluster hierarchy explicitly:

- `clusterRootObjectId(objectId)` resolves the root;
- `clusterObjectIds(rootId)` returns recursive members;
- attachment local poses can be updated without breaking the parent link.

### Cluster manipulation

A one-hand grab keeps the existing v8 behavior:

- grabbing a free/root object moves the root while attached descendants follow;
- grabbing an attached child detaches only that child;
- cancel restores the previous attachment and joint.

A two-hand transform on a fixed cluster member targets the cluster root, so scale and rotation propagate through the world hierarchy.

### Joint constraints

`SpatialJointRuntime` supports three session-only joint types:

- `fixed` — rigid child attachment;
- `hinge` — bounded angular motion;
- `slider` — bounded motion on one configured axis.

Production mapping:

- `stack.<id>` creates a fixed joint;
- `object.<id>` creates a hinge joint;
- `slide.<id>` creates an x-axis slider joint.

Two-hand input controls the active joint without detaching the child. Hinge input follows two-hand angle; slider input follows two-hand center movement. Bounds and stiffness are applied in local attachment space.

### Cluster-aware collision

Every collision body now carries a `clusterId`. Members of the same cluster do not collide with each other, preventing attached children from pushing their own parent. Different clusters continue to use v8 impulse and stack behavior.

Joint, cluster and attachment state remain ephemeral and are never written to long-term memory.


## Spatial v10: session layout and multi-selection

Spatial layout now survives React/vision surface teardown inside the same browser page session without using `localStorage`, `sessionStorage` or IndexedDB.

`SpatialSessionLayoutRuntime` captures a bounded snapshot of:

- object poses;
- object attachments;
- joint states;
- selected cluster roots.

The snapshot is restored when the spatial surface is rebuilt in the same page session. Layout data is RAM-only and disappears when the page session ends.

### Multi-selection

`SpatialSelectionRuntime` keeps at most 16 selected cluster roots.

Production gestures:

- hold **Victory** on the focused object → toggle that cluster root;
- hold **Open Palm** → clear the group selection.

Selected cluster members receive a subtle spatial outline; no extra telemetry panel is added.

## Spatial v11: multi-cluster group gestures

Two-hand manipulation now works across multiple selected cluster roots.

When two or more selected cluster roots are active and the user starts a two-hand transform on one selected object:

1. selected roots detach from non-object docks/surfaces;
2. the runtime captures a centroid-based group transform session;
3. hand-center movement translates the group;
4. hand separation scales the group;
5. hand angle rotates the group;
6. attached descendants resolve from each transformed root afterward.

The transform is bounded in normalized interaction space and preserves each cluster's child hierarchy.

## Spatial v12: device/WebXR adapter contract

`SpatialDeviceAdapterRuntime` separates the spatial controller from the current webcam coordinate source.

Current browser production input continues through:

```text
webcam hand tracking
→ webcam-relative adapter
→ Spatial UI / contact / world runtime
```

The adapter can also expose a `webxr-metric` capability contract when the browser reports `immersive-ar` support.

Important: capability detection does **not** auto-start an XR session and does not claim metric tracking when the active sensor is still the webcam. A future device integration can supply metric joint/world poses through the same adapter boundary.

## Spatial v13: reliability and long-session hardening

The final browser-spatial hardening pass adds explicit budgets and graph validation.

### World model budgets

`ShortTermWorldModelTracker` now bounds:

- visual object memories to 32;
- processed scene-event IDs to 128.

This removes an unbounded 24/7 growth path while preserving recent short-term visual context.

### Attachment-cycle protection

`SpatialWorldRuntime` rejects cyclic object graphs such as:

```text
A → B → A
```

Cycle candidates are filtered both during snap discovery and direct attachment.

### Session budgets

Session layout snapshots are bounded to:

- 32 objects;
- 32 attachments;
- 32 joints;
- 16 selected clusters.

These limits keep the browser spatial runtime deterministic and small for long-running sessions.

## Current browser-spatial milestone

The planned browser spatial stack is now complete from v1 through v13:

```text
gaze / hand
→ ray + contact
→ object manipulation
→ world anchors
→ magnetic placement
→ inertia / physics
→ multi-object collision
→ clusters / joints
→ session layout
→ multi-selection / group gestures
→ device adapter boundary
→ reliability hardening
```

Further work is device-specific rather than another required browser architecture phase: real WebXR/AR hardware sessions, metric depth calibration, and real-device UX tuning.
