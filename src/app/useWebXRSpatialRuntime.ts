import { useEffect } from 'react';
import { bridgeXRHandTo21 } from '../core/vision/spatial-xr-hand-bridge';
import { projectMetricPointAcrossViews } from '../core/vision/spatial-xr-projection';
import { resolveSpatialObjectCollisions } from '../core/vision/spatial-collision';
import { spatialAnchorFromRect } from '../core/vision/spatial-anchor';
import type { SpatialPhysicsState } from '../core/vision/spatial-physics';
import type { SpatialObjectState } from '../core/vision/spatial-object';
import {
  clampSpatial,
  collectSpatialTargets,
  collectSpatialWorldAnchors,
  setXRWindowSurfaceState,
  spatialObjectAvailable,
  spatialWindowAvailable,
  type SpatialWindowId,
} from './spatial-ui-helpers';

export function useWebXRSpatialRuntime(options: any) {
  const {
    webXRSnapshot,
    settingsOpen,
    showSpatialFeedback,
    updateSpatialWindow,
    setHandSeen,
    xrAutoCalibratedRef,
    xrProjectionRef,
    xrSurfaceRef,
    setXrSurfaceProbe,
    xrAnchoredObjectIdsRef,
    xrHandKinematicsRef,
    handContactRef,
    handIntentRef,
    setHandKinematics,
    setHumanHandContact,
    setHumanHandIntent,
    xrHandCollisionRef,
    spatialObjectRuntimeRef,
    spatialWorldRuntimeRef,
    spatialJointRuntimeRef,
    spatialPhysicsRef,
    setSpatialPhysicsState,
    xrRigidFeedbackAtRef,
    xrGestureIntentRef,
    spatialUiRef,
    setSpatialFrame,
    xrSurfaceFeedbackAtRef,
    xrAnchorDepthRef,
    setXrObjectDepthScale,
    setXrWindowDepthScale,
    setSpatialObjects,
    lastSpatialWindowRef,
    webXRRuntimeRef,
    spatialGrabSessionRef,
    spatialWindowsRef,
    xrMetricManipulationRef,
    xrBimanualRef,
    setXrWindowBimanual,
    xrRigidBodyRef,
    setXrObjectBimanual,
    spatialObjectAttachmentBeforeGrabRef,
    spatialJointBeforeGrabRef,
    spatialCollisionFeedbackAtRef,
  } = options;

  useEffect(() => {
    if (!webXRSnapshot.active) return;

    const primaryHand = webXRSnapshot.hands.find((hand: any) => hand.indexTip) || null;
    const secondaryHand = webXRSnapshot.hands.find(
      (hand: any) => hand !== primaryHand && hand.indexTip && hand.thumbTip,
    ) || null;

    if (!primaryHand?.indexTip || !webXRSnapshot.views.length) {
      setHandSeen(false);
      return;
    }

    if (!xrAutoCalibratedRef.current && webXRSnapshot.hit) {
      const rawHit = projectMetricPointAcrossViews(webXRSnapshot.hit, webXRSnapshot.views);
      if (rawHit?.visible) {
        xrProjectionRef.current.calibrateCenter(rawHit);
        xrAutoCalibratedRef.current = true;
        showSpatialFeedback('XR · đã căn tâm DOM');
      }
    }

    const projected = xrProjectionRef.current.project(primaryHand.indexTip, webXRSnapshot.views);
    if (!projected) {
      setHandSeen(false);
      return;
    }

    xrSurfaceRef.current.update(webXRSnapshot.depth);
    const surfaceProbe = xrSurfaceRef.current.probe(
      projected.x,
      projected.y,
      Math.max(0, -projected.depth),
    );
    setXrSurfaceProbe(surfaceProbe);

    xrAnchoredObjectIdsRef.current = new Set(
      webXRSnapshot.anchors
        .filter((anchor: any) => anchor.tracked && anchor.id.startsWith('object.'))
        .map((anchor: any) => anchor.id.slice('object.'.length)),
    );

    const bridged = bridgeXRHandTo21(primaryHand);
    const wristWorld = bridged.worldLandmarks[0] || { x: 0, y: 0, z: 0 };
    const middleTipWorld = bridged.worldLandmarks[12] || wristWorld;
    const handMetricLength = Math.max(
      0.03,
      Math.hypot(
        middleTipWorld.x - wristWorld.x,
        middleTipWorld.y - wristWorld.y,
        middleTipWorld.z - wristWorld.z,
      ),
    );

    const projectedLandmarks = bridged.worldLandmarks.map((point: any) => {
      const screen = projectMetricPointAcrossViews(point, webXRSnapshot.views);
      return {
        x: screen?.x ?? projected.x,
        y: screen?.y ?? projected.y,
        z: Math.max(
          -0.22,
          Math.min(0.22, ((point.z - wristWorld.z) / handMetricLength) * 0.08),
        ),
      };
    });

    const now = performance.now();
    const xrKinematics = xrHandKinematicsRef.current.update({
      handedness: primaryHand.handedness,
      landmarks: projectedLandmarks,
      worldLandmarks: bridged.worldLandmarks,
      confidence: projected.confidence,
    }, now);

    const targets = settingsOpen ? [] : collectSpatialTargets();
    const contactAnchors = targets.map((target) => spatialAnchorFromRect({
      ...target,
      depthRadius: Math.max(
        Number(target.depthRadius || 0),
        target.kind === 'window' ? 0.1 : 0.12,
      ),
    }));

    const xrContact = handContactRef.current.update(
      xrKinematics,
      contactAnchors.map((anchor) => ({
        id: anchor.id,
        label: anchor.label,
        kind: anchor.kind,
        center: { ...anchor.center },
        halfExtents: { ...anchor.halfExtents },
        priority: anchor.priority,
      })),
      now,
    );
    const xrHumanIntent = handIntentRef.current.update(xrKinematics, xrContact, now);

    setHandKinematics(xrKinematics);
    setHumanHandContact(xrContact);
    setHumanHandIntent(xrHumanIntent);

    const handCollision = xrHandCollisionRef.current.update(xrKinematics, xrContact, now);
    if (
      handCollision &&
      spatialObjectAvailable(handCollision.targetId) &&
      !spatialObjectRuntimeRef.current.get(handCollision.targetId)?.grabbed &&
      !spatialWorldRuntimeRef.current.attachment(handCollision.targetId) &&
      !xrAnchoredObjectIdsRef.current.has(handCollision.targetId)
    ) {
      setSpatialPhysicsState(
        spatialPhysicsRef.current.applyImpulse(
          handCollision.targetId,
          handCollision.impulse,
          now,
        ),
      );
      if (now - xrRigidFeedbackAtRef.current >= 520) {
        xrRigidFeedbackAtRef.current = now;
        showSpatialFeedback('XR · tay chạm vật thể · truyền lực');
      }
    }

    const intent = xrGestureIntentRef.current.update({
      gesture: xrKinematics.pointingConfidence >= 0.56 ? 'Pointing_Up' : 'None',
      score: Math.max(projected.confidence, xrKinematics.pointingConfidence),
      pinching: xrKinematics.pinching,
    }, now);

    const nextFrame = spatialUiRef.current.update({
      face: {
        present: false,
        confidence: 0,
        gazeX: 0,
        gazeY: 0,
        yaw: 0,
        pitch: 0,
        calibrationProgress: 0,
      },
      hand: {
        present: projected.visible,
        confidence: Math.max(projected.confidence, xrKinematics.pointingConfidence),
        x: projected.x,
        y: projected.y,
        z: 0,
        pinching: xrKinematics.pinching,
        direct: xrKinematics.pointingConfidence >= 0.5 || xrContact.active,
      },
      gestureIntent: intent,
      headGesture: 'none',
      targets,
    }, now);

    setHandSeen(projected.visible);
    setSpatialFrame(nextFrame);

    if (
      surfaceProbe?.touchingSurface &&
      surfaceProbe.confidence >= 0.5 &&
      now - xrSurfaceFeedbackAtRef.current >= 900
    ) {
      xrSurfaceFeedbackAtRef.current = now;
      showSpatialFeedback('XR · surface contact');
    }

    document.querySelectorAll<HTMLElement>('[data-xr-occluded="true"]')
      .forEach((element) => element.removeAttribute('data-xr-occluded'));

    let trackedSpatialObject = false;
    for (const anchor of webXRSnapshot.anchors) {
      if (!anchor.tracked) continue;

      if (anchor.id.startsWith('object.')) {
        const objectId = anchor.id.slice('object.'.length);
        const object = spatialObjectRuntimeRef.current.get(objectId);
        if (!object) continue;

        const anchorProjection = projectMetricPointAcrossViews(anchor, webXRSnapshot.views);
        if (!anchorProjection?.visible) continue;

        const metricDepth = Math.max(0.08, -anchorProjection.depth);
        const baselineDepth = xrAnchorDepthRef.current.get(objectId) || metricDepth;
        if (!xrAnchorDepthRef.current.has(objectId)) {
          xrAnchorDepthRef.current.set(objectId, baselineDepth);
        }
        const perspectiveScale = clampSpatial(baselineDepth / metricDepth, 0.72, 1.42);
        setXrObjectDepthScale((current: Record<string, number>) => (
          Math.abs((current[objectId] || 1) - perspectiveScale) < 0.015
            ? current
            : { ...current, [objectId]: perspectiveScale }
        ));

        const element = Array.from(
          document.querySelectorAll<HTMLElement>('[data-spatial-object]'),
        ).find(
          (node) => node.dataset.spatialObject === objectId && node.offsetParent !== null,
        );
        if (!element) continue;

        const rect = element.getBoundingClientRect();
        const screenX = (rect.left + rect.right) / 2 / Math.max(1, window.innerWidth);
        const screenY = (rect.top + rect.bottom) / 2 / Math.max(1, window.innerHeight);
        spatialObjectRuntimeRef.current.setPose(objectId, {
          ...object.pose,
          position: {
            ...object.pose.position,
            x: clampSpatial(
              object.pose.position.x + (anchorProjection.x - screenX),
              -0.48,
              0.48,
            ),
            y: clampSpatial(
              object.pose.position.y + (anchorProjection.y - screenY),
              -0.48,
              0.48,
            ),
          },
        });
        trackedSpatialObject = true;

        const objectSurface = xrSurfaceRef.current.probe(
          anchorProjection.x,
          anchorProjection.y,
          Math.max(0, -anchorProjection.depth),
        );
        if (objectSurface?.occluded) element.setAttribute('data-xr-occluded', 'true');
        else element.removeAttribute('data-xr-occluded');
        continue;
      }

      if (anchor.id.startsWith('window.')) {
        const id = anchor.id.slice('window.'.length) as SpatialWindowId;
        if (id !== 'camera' && id !== 'result') continue;

        const element = document.querySelector<HTMLElement>(
          `[data-spatial-window="${id}"]`,
        );
        if (!element || element.offsetParent === null) continue;

        const anchorProjection = projectMetricPointAcrossViews(anchor, webXRSnapshot.views);
        if (!anchorProjection?.visible) continue;

        const metricDepth = Math.max(0.08, -anchorProjection.depth);
        const depthKey = `window.${id}`;
        const baselineDepth = xrAnchorDepthRef.current.get(depthKey) || metricDepth;
        if (!xrAnchorDepthRef.current.has(depthKey)) {
          xrAnchorDepthRef.current.set(depthKey, baselineDepth);
        }
        const perspectiveScale = clampSpatial(baselineDepth / metricDepth, 0.72, 1.42);

        setXrWindowDepthScale((current: Record<string, number>) => (
          Math.abs((current[id] || 1) - perspectiveScale) < 0.015
            ? current
            : { ...current, [id]: perspectiveScale }
        ));

        const rect = element.getBoundingClientRect();
        const screenX = (rect.left + rect.right) / 2 / Math.max(1, window.innerWidth);
        const screenY = (rect.top + rect.bottom) / 2 / Math.max(1, window.innerHeight);

        updateSpatialWindow(id, (current: any) => ({
          ...current,
          x: clampSpatial(
            current.x + (anchorProjection.x - screenX) * window.innerWidth,
            -window.innerWidth * 0.48,
            window.innerWidth * 0.48,
          ),
          y: clampSpatial(
            current.y + (anchorProjection.y - screenY) * window.innerHeight,
            -window.innerHeight * 0.42,
            window.innerHeight * 0.42,
          ),
        }));

        const windowSurface = xrSurfaceRef.current.probe(
          anchorProjection.x,
          anchorProjection.y,
          Math.max(0, -anchorProjection.depth),
        );
        setXRWindowSurfaceState(id, windowSurface);
      }
    }

    if (trackedSpatialObject) {
      setSpatialObjects(spatialObjectRuntimeRef.current.snapshot());
    }

    for (const event of nextFrame.events) {
      if (event.type === 'activate' && event.targetKind === 'action') {
        const target = Array.from(
          document.querySelectorAll<HTMLElement>('[data-spatial-action]'),
        ).find((element) => element.dataset.spatialAction === event.targetId);
        target?.click();
        continue;
      }

      if (event.targetKind === 'window') {
        if (event.type === 'grab_start' && spatialWindowAvailable(event.targetId)) {
          const id = event.targetId;
          const windowKey = `window.${id}`;
          lastSpatialWindowRef.current = id;
          webXRRuntimeRef.current.removeAnchor(windowKey);
          xrAnchorDepthRef.current.delete(windowKey);
          setXrWindowDepthScale((current: Record<string, number>) => ({
            ...current,
            [id]: 1,
          }));
          spatialGrabSessionRef.current = {
            id,
            start: { x: event.point.x, y: event.point.y, z: event.point.z },
            base: { ...spatialWindowsRef.current[id] },
          };
          xrMetricManipulationRef.current.begin(
            windowKey,
            Math.max(0.05, -projected.depth),
            spatialWindowsRef.current[id].scale,
            surfaceProbe?.environmentDepthM ?? null,
            0.035,
          );
          const bimanualStart = secondaryHand
            ? xrBimanualRef.current.begin(windowKey, [primaryHand, secondaryHand])
            : null;
          if (bimanualStart) {
            setXrWindowBimanual((current: any) => ({ ...current, [id]: bimanualStart }));
          }
          setXRWindowSurfaceState(id, surfaceProbe);
          continue;
        }

        const session = spatialGrabSessionRef.current;
        if (event.type === 'grab_move' && session && session.id === event.targetId) {
          const windowKey = `window.${session.id}`;
          const dx = (event.point.x - session.start.x) * window.innerWidth;
          const dy = (event.point.y - session.start.y) * window.innerHeight;
          const metricMove = xrMetricManipulationRef.current.update(
            windowKey,
            Math.max(0.05, -projected.depth),
            surfaceProbe?.environmentDepthM ?? null,
            surfaceProbe?.confidence ?? 0,
          );
          const xrHands = secondaryHand ? [primaryHand, secondaryHand] : [primaryHand];
          const bimanualMove = secondaryHand && primaryHand.pinching && secondaryHand.pinching
            ? (
                xrBimanualRef.current.update(windowKey, xrHands) ||
                xrBimanualRef.current.begin(windowKey, xrHands)
              )
            : xrBimanualRef.current.end(windowKey);

          if (bimanualMove) {
            setXrWindowBimanual((current: any) => ({
              ...current,
              [session.id]: bimanualMove,
            }));
          }

          updateSpatialWindow(session.id, (current: any) => ({
            ...current,
            x: clampSpatial(
              session.base.x + dx,
              -window.innerWidth * 0.42,
              window.innerWidth * 0.42,
            ),
            y: clampSpatial(
              session.base.y + dy,
              -window.innerHeight * 0.34,
              window.innerHeight * 0.34,
            ),
            z: clampSpatial(
              session.base.z + (metricMove?.normalizedDepthDelta || 0) * 180,
              -160,
              160,
            ),
          }));

          if (metricMove) {
            setXrWindowDepthScale((current: Record<string, number>) => ({
              ...current,
              [session.id]: metricMove.visualScaleRatio,
            }));
          }
          setXRWindowSurfaceState(session.id, surfaceProbe);
          continue;
        }

        if (event.type === 'grab_end' && session?.id === event.targetId) {
          const windowKey = `window.${session.id}`;
          const metricRelease = xrMetricManipulationRef.current.end(windowKey);
          const bimanualRelease = xrBimanualRef.current.end(windowKey);
          if (bimanualRelease) {
            setXrWindowBimanual((current: any) => ({
              ...current,
              [session.id]: bimanualRelease,
            }));
          }

          const canRealAnchor = Boolean(
            surfaceProbe?.nearSurface &&
            surfaceProbe.confidence >= 0.45 &&
            webXRSnapshot.hit &&
            webXRSnapshot.enabledFeatures.includes('anchors'),
          );
          const queuedRealAnchor = canRealAnchor
            ? webXRRuntimeRef.current.requestAnchorAtCurrentHit(
                windowKey,
                session.id,
                false,
              )
            : false;

          if (!queuedRealAnchor) {
            setXrWindowDepthScale((current: Record<string, number>) => ({
              ...current,
              [session.id]: 1,
            }));
          }

          setXRWindowSurfaceState(session.id, surfaceProbe);
          spatialGrabSessionRef.current = null;
          showSpatialFeedback(
            queuedRealAnchor
              ? metricRelease?.constrainedToSurface
                ? 'XR · cửa sổ bám bề mặt'
                : 'XR · đã neo cửa sổ'
              : 'XR · đã đặt cửa sổ',
          );
          continue;
        }
      }

      if (event.targetKind === 'object') {
        if (event.type === 'grab_start' && spatialObjectAvailable(event.targetId)) {
          webXRRuntimeRef.current.removeAnchor(`object.${event.targetId}`);
          xrAnchorDepthRef.current.delete(event.targetId);
          setXrObjectDepthScale((current: Record<string, number>) => ({
            ...current,
            [event.targetId]: 1,
          }));
          spatialObjectAttachmentBeforeGrabRef.current =
            spatialWorldRuntimeRef.current.detachObject(event.targetId);
          spatialJointBeforeGrabRef.current =
            spatialJointRuntimeRef.current?.removeForChild?.(event.targetId) ?? null;

          const object = spatialObjectRuntimeRef.current.get(event.targetId);
          xrAnchoredObjectIdsRef.current.delete(event.targetId);
          xrRigidBodyRef.current.stop(event.targetId);
          spatialObjectRuntimeRef.current.beginGrab(event.targetId, event.point);

          xrMetricManipulationRef.current.begin(
            event.targetId,
            Math.max(0.05, -projected.depth),
            object?.pose.scale || 1,
            surfaceProbe?.environmentDepthM ?? null,
            0.03,
          );

          const bimanualStart = secondaryHand
            ? xrBimanualRef.current.begin(event.targetId, [primaryHand, secondaryHand])
            : null;
          if (bimanualStart) {
            xrRigidBodyRef.current.begin(event.targetId, bimanualStart, now);
            setXrObjectBimanual((current: any) => ({
              ...current,
              [event.targetId]: bimanualStart,
            }));
          }

          setSpatialPhysicsState(
            spatialPhysicsRef.current.beginGrab(event.targetId, event.point, now),
          );
          setSpatialObjects(spatialObjectRuntimeRef.current.snapshot());
          continue;
        }

        if (event.type === 'grab_move') {
          spatialPhysicsRef.current.sampleGrab(event.targetId, event.point, now);
          const metricMove = xrMetricManipulationRef.current.update(
            event.targetId,
            Math.max(0.05, -projected.depth),
            surfaceProbe?.environmentDepthM ?? null,
            surfaceProbe?.confidence ?? 0,
          );
          const xrHands = secondaryHand ? [primaryHand, secondaryHand] : [primaryHand];
          const bimanualMove = secondaryHand && primaryHand.pinching && secondaryHand.pinching
            ? (
                xrBimanualRef.current.update(event.targetId, xrHands) ||
                xrBimanualRef.current.begin(event.targetId, xrHands)
              )
            : xrBimanualRef.current.end(event.targetId);

          if (bimanualMove) {
            if (bimanualMove.active) {
              xrRigidBodyRef.current.sample(event.targetId, bimanualMove, now);
            }
            setXrObjectBimanual((current: any) => ({
              ...current,
              [event.targetId]: bimanualMove,
            }));
          }

          spatialObjectRuntimeRef.current.moveGrab(event.point, {
            depthDelta: metricMove?.normalizedDepthDelta ?? 0,
            xyGain: 1.05,
            depthGain: 1,
          });

          if (metricMove) {
            setXrObjectDepthScale((current: Record<string, number>) => ({
              ...current,
              [event.targetId]: metricMove.visualScaleRatio,
            }));
          }
          setSpatialObjects(spatialObjectRuntimeRef.current.snapshot());
          continue;
        }

        if (event.type === 'grab_end') {
          const metricRelease = xrMetricManipulationRef.current.end(event.targetId);
          const bimanualRelease = xrBimanualRef.current.end(event.targetId);
          const rigidRelease = xrRigidBodyRef.current.release(event.targetId, now);

          if (bimanualRelease) {
            setXrObjectBimanual((current: any) => ({
              ...current,
              [event.targetId]: bimanualRelease,
            }));
          }

          const placed = spatialObjectRuntimeRef.current.endGrab();
          const canRealAnchor = Boolean(
            placed &&
            surfaceProbe?.nearSurface &&
            surfaceProbe.confidence >= 0.45 &&
            webXRSnapshot.hit &&
            webXRSnapshot.enabledFeatures.includes('anchors'),
          );
          const queuedRealAnchor = canRealAnchor
            ? webXRRuntimeRef.current.requestAnchorAtCurrentHit(
                `object.${event.targetId}`,
                event.targetId,
                false,
              )
            : false;

          spatialWorldRuntimeRef.current.setAnchors(
            collectSpatialWorldAnchors(spatialObjectRuntimeRef.current.snapshot()),
          );
          const snapped = !queuedRealAnchor && placed
            ? spatialWorldRuntimeRef.current.snapObject(event.targetId, placed.pose, now)
            : null;
          if (snapped) {
            spatialObjectRuntimeRef.current.setPose(event.targetId, snapped.worldPose);
          }

          let nextPhysicsState: SpatialPhysicsState;
          if (queuedRealAnchor || snapped) {
            xrRigidBodyRef.current.stop(event.targetId);
            nextPhysicsState = spatialPhysicsRef.current.stop(event.targetId, now);
            if (queuedRealAnchor) xrAnchoredObjectIdsRef.current.add(event.targetId);
          } else {
            spatialPhysicsRef.current.release(event.targetId, 0, now);
            nextPhysicsState = rigidRelease?.throwing
              ? spatialPhysicsRef.current.addVelocity(
                  event.targetId,
                  rigidRelease.linearVelocity,
                  now,
                )
              : spatialPhysicsRef.current.snapshot(event.targetId);
          }

          setSpatialPhysicsState(nextPhysicsState);
          setSpatialObjects(spatialObjectRuntimeRef.current.snapshot());
          spatialObjectAttachmentBeforeGrabRef.current = null;
          spatialJointBeforeGrabRef.current = null;

          if (!queuedRealAnchor) {
            setXrObjectDepthScale((current: Record<string, number>) => ({
              ...current,
              [event.targetId]: 1,
            }));
          }

          showSpatialFeedback(
            queuedRealAnchor
              ? metricRelease?.constrainedToSurface
                ? 'XR · đặt sát bề mặt và đang neo'
                : 'XR · đang neo vào bề mặt thật'
              : snapped
                ? `XR · neo ${snapped.anchorLabel}`
                : rigidRelease?.throwing
                  ? 'XR · rigid release · quán tính'
                  : 'XR · đã đặt vật thể',
          );
        }
      }
    }
  }, [
    settingsOpen,
    showSpatialFeedback,
    updateSpatialWindow,
    webXRSnapshot,
  ]);

  useEffect(() => {
    if (!webXRSnapshot.active) return;

    let frame = 0;
    let cancelled = false;

    const tick = (now: number) => {
      if (cancelled) return;
      let changed = false;

      const rigidSteps = xrRigidBodyRef.current.stepAll(now);
      if (rigidSteps.length) {
        setXrObjectBimanual((current: any) => {
          const next = { ...current };
          for (const step of rigidSteps) {
            const committed = xrBimanualRef.current.commitExternal(
              step.objectId,
              step.transform,
            );
            next[step.objectId] = committed;
          }
          return next;
        });
      }

      let objects: SpatialObjectState[] = spatialObjectRuntimeRef.current.snapshot();
      for (const object of objects) {
        if (
          !object.grabbed &&
          !xrAnchoredObjectIdsRef.current.has(object.id) &&
          spatialPhysicsRef.current.isActive(object.id)
        ) {
          const inertiaStep = spatialPhysicsRef.current.step(
            object.id,
            object.pose,
            now,
          );
          spatialObjectRuntimeRef.current.setPose(object.id, inertiaStep.pose);
          setSpatialPhysicsState(inertiaStep.state);
          changed = true;
        }
      }

      objects = spatialObjectRuntimeRef.current.snapshot();
      const collision = resolveSpatialObjectCollisions(
        objects.map((object) => ({
          id: object.id,
          pose: object.pose,
          radius: object.collisionRadius,
          mass: object.mass,
          dynamic:
            !object.grabbed &&
            !spatialWorldRuntimeRef.current.attachment(object.id) &&
            !xrAnchoredObjectIdsRef.current.has(object.id),
          clusterId: spatialWorldRuntimeRef.current.clusterRootObjectId(object.id),
        })),
        Object.fromEntries(
          objects.map((object) => [
            object.id,
            spatialPhysicsRef.current.velocity(object.id),
          ]),
        ),
      );

      if (collision.contacts.length) {
        for (const object of objects) {
          if (
            !object.grabbed &&
            !spatialWorldRuntimeRef.current.attachment(object.id) &&
            !xrAnchoredObjectIdsRef.current.has(object.id)
          ) {
            spatialObjectRuntimeRef.current.setPose(
              object.id,
              collision.poses[object.id],
            );
          }
          const impulse = collision.velocityDeltas[object.id];
          if (impulse && Math.hypot(impulse.x, impulse.y, impulse.z) > 0.012) {
            setSpatialPhysicsState(
              spatialPhysicsRef.current.addVelocity(object.id, impulse, now),
            );
          }
        }

        if (now - spatialCollisionFeedbackAtRef.current >= 650) {
          spatialCollisionFeedbackAtRef.current = now;
          showSpatialFeedback('XR · rigid collision');
        }
        changed = true;
      }

      if (changed) {
        spatialWorldRuntimeRef.current.setAnchors(
          collectSpatialWorldAnchors(spatialObjectRuntimeRef.current.snapshot()),
        );
        setSpatialObjects(spatialObjectRuntimeRef.current.snapshot());
      }

      frame = window.requestAnimationFrame(tick);
    };

    frame = window.requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frame);
    };
  }, [showSpatialFeedback, webXRSnapshot.active]);
}
