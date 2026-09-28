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
