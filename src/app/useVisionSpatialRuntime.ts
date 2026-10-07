import { useEffect } from 'react';
import { neutralAffect } from '../intelligence/affect/mood-engine';
import { micProsodySnapshot } from '../core/audio-level';
import { normalizeVisionPerception } from './vision-perception-normalizer';
import { collectSpatialTargets, spatialActionElement } from './spatial-ui-helpers';
import { stepSpatialObjectWorld } from './spatial-object-world-step';
import { updateVisionHandInteraction } from './vision-hand-interaction';
import { applySpatialSelectionGesture } from './spatial-selection-gesture';
import { handleSpatialObjectManipulation } from './spatial-object-manipulation';
import { handleSpatialWindowControl } from './spatial-window-control';
import { updateSpatialWindowBimanual } from './spatial-window-bimanual';
import { updateSpatialObjectBimanual } from './spatial-object-bimanual';

export function useVisionSpatialRuntime(options: any) {
  const {
    visionOn,
    visionModulesRef,
    settingsOpen,
    affectFollowing,
    voiceReady,
    themes,
    mira,
    setFaceSeen,
    setHandSeen,
    setFaceLandmarks,
    gazeHeadCalibratorRef,
    setGazeTelemetry,
    interactionTrackerRef,
    setInteractionTelemetry,
    updateVisionHandInput,
    setHandLandmarks,
    setHandKinematics,
    spatialObjectRuntimeRef,
    spatialWorldRuntimeRef,
    spatialPhysicsRef,
    spatialJointRuntimeRef,
    spatialCollisionFeedbackAtRef,
    setSpatialPhysicsState,
    setSpatialObjects,
    showSpatialFeedback,
    handContactRef,
    handIntentRef,
    spatialTouchRef,
    setHumanHandContact,
    setHumanHandIntent,
    setSpatialTouch,
    spatialUiRef,
    setSpatialFrame,
    spatialSelectionRef,
    setSelectedClusterRoots,
    spatialGroupTransformRef,
    spatialObjectDepthRef,
    spatialObjectAttachmentBeforeGrabRef,
    spatialJointBeforeGrabRef,
    placementPreviewRef,
    spatialJointControlRef,
    twoHandObjectSessionRef,
    setPlacementPreview,
    spatialGrabSessionRef,
    spatialDepthAnchorRef,
    spatialWindowsRef,
    lastSpatialWindowRef,
    twoHandSpatialSessionRef,
    spatialHeadConsumedAtRef,
    updateSpatialWindow,
    updateFaceSocial,
    setAffectFollowing,
    showFaceActionFeedback,
    setTheme,
    updateVisionWorldContext,
    affectTrackerRef,
    setFaceAffect,
    updateFaceHeadControl,
    setFaceTelemetry,
  } = options;

  useEffect(() => {
    if (!visionOn) return;

    const timer = window.setInterval(() => {
      const current = visionModulesRef.current;
      const snapshot = current?.visionSnapshot();

      setFaceSeen(Boolean(snapshot?.faceSeen));
      setHandSeen(Boolean(snapshot?.handSeen));

      const {
        face,
        micro,
        posture,
        pulse,
        environmentContext,
        environmentObjects,
        spatial,
        faceConfidence,
      } = normalizeVisionPerception(snapshot);

      setFaceLandmarks(Array.isArray(face?.landmarks) ? face.landmarks : []);
      const now = performance.now();

      gazeHeadCalibratorRef.current.observe({
        facePresent: Boolean(face?.present),
        confidence: faceConfidence,
        gazeX: Number(face?.gazeX || 0),
        gazeY: Number(face?.gazeY || 0),
        yaw: Number(face?.yaw || 0),
        pitch: Number(face?.pitch || 0),
        motion: Number(posture.motion || 0),
      });

      const calibrated = gazeHeadCalibratorRef.current.apply({
        gazeX: Number(face?.gazeX || 0),
        gazeY: Number(face?.gazeY || 0),
        yaw: Number(face?.yaw || 0),
        pitch: Number(face?.pitch || 0),
      });
      setGazeTelemetry({ x: calibrated.gazeX, y: calibrated.gazeY });

      const interaction = interactionTrackerRef.current.update({
        facePresent: Boolean(face?.present),
        faceConfidence,
        yaw: calibrated.yaw,
        pitch: calibrated.pitch,
        gazeX: calibrated.gazeX,
        gazeY: calibrated.gazeY,
        posturePresent: Boolean(posture.present),
        postureConfidence: Number(posture.confidence || 0),
        postureMotion: Number(posture.motion || 0),
        distanceM: Number(spatial.distanceM || 0),
      }, now);
      setInteractionTelemetry(interaction);

      const {
        intent,
        rawHands,
        primaryHand,
        primaryPinching,
        screenKinematics,
        primaryPointerX,
        primaryPointerY,
        primaryPointerZ,
        pointingHand,
        handConfidence,
      } = updateVisionHandInput(snapshot, now);

      setHandLandmarks(Array.isArray(primaryHand?.landmarks) ? primaryHand.landmarks : []);
      setHandKinematics(screenKinematics);

      const spatialTargets = settingsOpen ? [] : collectSpatialTargets();

      stepSpatialObjectWorld({
        now,
        objectRuntime: spatialObjectRuntimeRef.current,
        worldRuntime: spatialWorldRuntimeRef.current,
        physicsRuntime: spatialPhysicsRef.current,
        jointRuntime: spatialJointRuntimeRef.current,
        collisionFeedbackAtRef: spatialCollisionFeedbackAtRef,
        setPhysicsState: setSpatialPhysicsState,
        setSpatialObjects,
        showFeedback: showSpatialFeedback,
      });

      const handRay = primaryHand?.ray || snapshot?.pointerRay || null;
      const {
        humanContact,
        humanIntent,
        directTouch,
        directHand,
        rayHit,
      } = updateVisionHandInteraction({
        spatialTargets,
        handActive: Boolean(snapshot?.handSeen && primaryHand),
        screenKinematics,
        handConfidence,
        primaryPointerX,
        primaryPointerY,
        primaryPointerZ,
        primaryPinching,
        pointingHand,
        handRay,
        contactRuntime: handContactRef.current,
        intentRuntime: handIntentRef.current,
        touchRuntime: spatialTouchRef.current,
        now,
      });

      setHumanHandContact(humanContact);
      setHumanHandIntent(humanIntent);
      setSpatialTouch(directTouch);

      const spatialFrameNext = spatialUiRef.current.update({
        face: {
          present: Boolean(face?.present),
          confidence: faceConfidence,
          gazeX: calibrated.gazeX,
          gazeY: calibrated.gazeY,
          yaw: calibrated.yaw,
          pitch: calibrated.pitch,
          calibrationProgress: calibrated.calibration.progress,
        },
        hand: {
          present: Boolean(snapshot?.handSeen && primaryHand),
          confidence: handConfidence,
          x: primaryPointerX,
          y: primaryPointerY,
          z: primaryPointerZ,
          pinching: primaryPinching,
          direct: directHand,
          ray: handRay,
        },
        rayHit,
        gestureIntent: intent,
        headGesture: String(face?.headGesture || 'none'),
        targets: spatialTargets,
      }, now);
      setSpatialFrame(spatialFrameNext);

      const selectionGesture = applySpatialSelectionGesture({
        intent: intent.intent,
        focus: spatialFrameNext.focus,
        selectionRuntime: spatialSelectionRef.current,
        worldRuntime: spatialWorldRuntimeRef.current,
      });
      if (selectionGesture) {
        setSelectedClusterRoots(selectionGesture.selectedClusterRoots);
        if (selectionGesture.resetGroupTransform) {
          spatialGroupTransformRef.current = null;
        }
        showSpatialFeedback(selectionGesture.feedback);
      }

      const pinchedHands = rawHands.filter((hand: any) => Boolean(hand?.pinching));
      const twoHandsActive = pinchedHands.length >= 2;

      for (const event of spatialFrameNext.events) {
        if (handleSpatialObjectManipulation({
          event,
          twoHandsActive,
          humanIntent: humanIntent.intent,
          now,
          objectRuntime: spatialObjectRuntimeRef.current,
          worldRuntime: spatialWorldRuntimeRef.current,
          physicsRuntime: spatialPhysicsRef.current,
          jointRuntime: spatialJointRuntimeRef.current,
          depthRuntime: spatialObjectDepthRef.current,
          attachmentBeforeGrabRef: spatialObjectAttachmentBeforeGrabRef,
          jointBeforeGrabRef: spatialJointBeforeGrabRef,
          placementPreviewRef,
          jointControlRef: spatialJointControlRef,
          twoHandObjectSessionRef,
          setPhysicsState: setSpatialPhysicsState,
          setSpatialObjects,
          setPlacementPreview,
          showFeedback: showSpatialFeedback,
        })) {
          continue;
        }

        if (event.type === 'activate') {
          const target = spatialActionElement(event.targetId);
          if (target) {
            target.click();
            showSpatialFeedback(
              `${event.source === 'face' ? 'Gật đầu' : 'Pinch'} · ${target.dataset.spatialLabel || 'Đã chọn'}`,
            );
            if (event.source === 'face') spatialHeadConsumedAtRef.current = now;
          }
          continue;
        }

        if (handleSpatialWindowControl({
          event,
          twoHandsActive,
          now,
          grabSessionRef: spatialGrabSessionRef,
          depthRuntime: spatialDepthAnchorRef.current,
          windowsRef: spatialWindowsRef,
          lastWindowRef: lastSpatialWindowRef,
          twoHandSessionRef: twoHandSpatialSessionRef,
          spatialHeadConsumedAtRef,
          updateWindow: updateSpatialWindow,
          showFeedback: showSpatialFeedback,
        })) {
          continue;
        }
      }

      updateSpatialWindowBimanual({
        pinchedHands,
        focus: spatialFrameNext.focus,
        lastWindowId: lastSpatialWindowRef.current,
        now,
        sessionRef: twoHandSpatialSessionRef,
        windowsRef: spatialWindowsRef,
        updateWindow: updateSpatialWindow,
        showFeedback: showSpatialFeedback,
      });

      updateSpatialObjectBimanual({
        pinchedHands,
        focusObjectId: spatialFrameNext.focus?.kind === 'object'
          ? spatialFrameNext.focus.id
          : '',
        now,
        objectRuntime: spatialObjectRuntimeRef.current,
        worldRuntime: spatialWorldRuntimeRef.current,
        physicsRuntime: spatialPhysicsRef.current,
        jointRuntime: spatialJointRuntimeRef.current,
        selectionRuntime: spatialSelectionRef.current,
        groupTransformRef: spatialGroupTransformRef,
        objectSessionRef: twoHandObjectSessionRef,
        jointControlRef: spatialJointControlRef,
        setPhysicsState: setSpatialPhysicsState,
        setSpatialObjects,
        showFeedback: showSpatialFeedback,
      });

      const gestureScoreNow = Number(snapshot?.gestureScore || 0);
      const rawPointerX = Math.max(0, Math.min(1, Number(snapshot?.pointerX ?? 0.5)));
      const rawPointerY = Math.max(0, Math.min(1, Number(snapshot?.pointerY ?? 0.5)));
      const pointingActive = Boolean(snapshot?.handSeen) && (
        (
          String(snapshot?.gesture || 'None') === 'Pointing_Up' &&
          gestureScoreNow >= 0.48
        ) ||
        intent.intent === 'point_hold'
      );

      const interactionHands = rawHands.map((hand: any) => ({
        handedness: String(hand?.handedness || 'Unknown'),
        x: Number(hand?.x ?? 0.5),
        y: Number(hand?.y ?? 0.5),
        pinching: Boolean(hand?.pinching),
        gesture: String(hand?.gesture || 'None'),
        score: Number(hand?.score || 0),
      }));

      const { socialEvent, continuity } = updateFaceSocial({
        faceSeen: Boolean(face?.present),
        faceConfidence,
        gesture: String(face?.faceGesture || 'none'),
        gestureConfidence: Number(face?.faceGestureConfidence || 0),
        interactionState: interaction.state,
        attention: interaction.attention,
      }, now);

      if (socialEvent.eventId > 0 && socialEvent.cue !== 'none') {
        if (socialEvent.action === 'toggle_affect') {
          setAffectFollowing((previous: boolean) => !previous);
          showFaceActionFeedback('Nháy mắt trái · đổi chế độ phản ứng');
        } else if (socialEvent.action === 'cycle_theme') {
          setTheme((currentTheme: string) => (
            themes[(themes.indexOf(currentTheme) + 1) % themes.length]
          ));
          showFaceActionFeedback('Nháy mắt phải · đổi màu');
        }
      }

      const { promptContext: socialContext } = updateVisionWorldContext({
        environmentObjects,
        pointer: {
          active: pointingActive,
          x: rawPointerX,
          y: rawPointerY,
          confidence: pointingActive
            ? Math.max(gestureScoreNow, intent.confidence)
            : 0,
        },
        hands: interactionHands,
        interaction,
        continuity,
        microKind: String(micro.kind || 'none'),
        microConfidence: Number(micro.confidence || 0),
        postureLabel: String(posture.label || 'unknown'),
        postureConfidence: Number(posture.confidence || 0),
        gesture: String(snapshot?.gesture || 'None'),
        gestureScore: Number(snapshot?.gestureScore || 0),
        proximity: String(spatial.proximity || 'unknown'),
        environmentContext,
      }, now);

      const nextAffect = affectTrackerRef.current.update({
        ...(face || { present: false }),
        voice: micProsodySnapshot(),
        posture,
        physiology: {
          quality: Number(pulse.quality || 0),
          relativeActivation: Number(pulse.relativeActivation || 0),
        },
        microExpression: micro,
      }, now);

      nextAffect.interaction = interaction;
      if (socialContext) {
        nextAffect.promptContext = nextAffect.promptContext + ' ' + socialContext;
      }
      setFaceAffect(nextAffect);
      mira.observeAffect(affectFollowing ? nextAffect : neutralAffect());

      const faceAction = updateFaceHeadControl({
        faceSeen: Boolean(face?.present),
        faceConfidence,
        headGesture: String(face?.headGesture || 'none'),
        state: mira.stateRef.current,
        voiceReady,
        spatialHeadConsumedAt: spatialHeadConsumedAtRef.current,
      }, now);

      if (faceAction === 'interrupt') {
        mira.interrupt();
        showFaceActionFeedback('Lắc đầu · Mira đã dừng');
      } else if (faceAction === 'listen') {
        mira.startListening();
        showFaceActionFeedback('Gật đầu · Mira đang nghe');
      }

      setFaceTelemetry({
        smile: Number(face?.smile || 0),
        frown: Number(face?.frown || 0),
        jaw: Number(face?.jaw || 0),
        browUp: Number(face?.browUp || 0),
        browDown: Number(face?.browDown || 0),
        gazeX: Number(face?.gazeX || 0),
        gazeY: Number(face?.gazeY || 0),
        yaw: calibrated.yaw,
        pitch: calibrated.pitch,
        roll: Number(face?.roll || 0),
        distanceM: Number(spatial.distanceM || 0),
        confidence: faceConfidence,
        environmentLabel: environmentContext.label || 'unknown',
        environmentConfidence: Number(environmentContext.confidence || 0),
        headGesture: String(face?.headGesture || 'none'),
        faceGesture: String(face?.faceGesture || 'none'),
        faceGestureConfidence: Number(face?.faceGestureConfidence || 0),
        muscles: face?.muscles || {
          brow: 0,
          eyes: 0,
          cheeks: 0,
          mouth: 0,
          jaw: 0,
        },
      });
    }, 120);

    return () => window.clearInterval(timer);
  }, [
    affectFollowing,
    mira.interrupt,
    mira.observeAffect,
    mira.startListening,
    mira.stateRef,
    settingsOpen,
    showFaceActionFeedback,
    showSpatialFeedback,
    updateFaceHeadControl,
    updateFaceSocial,
    updateSpatialWindow,
    updateVisionHandInput,
    updateVisionWorldContext,
    visionOn,
    voiceReady,
  ]);
}
