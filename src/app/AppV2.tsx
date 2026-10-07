import { lazy, Suspense, useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { useMira } from '../core/useMira';
import type { MiraState, Theme } from '../core/types';
import { IconCamera, IconCameraOff, IconMic, IconPhoneOff, IconSettings } from '../ui/app-shell-icons';
import { useDialogFocus } from '../ui/useDialogFocus';
import PhotorealMira from '../presence/PhotorealMira';
import FaceMeshOverlay, { type FaceLandmarkPoint } from '../presence/FaceMeshOverlay';
import HandSkeletonOverlay, { type HandLandmarkPoint } from '../presence/HandSkeletonOverlay';
import SpatialControlOverlay from '../presence/SpatialControlOverlay';
import { AffectTracker, neutralAffect, type AffectState } from '../intelligence/affect/mood-engine';
import { describeAffectSignal } from '../intelligence/affect/affect-control';
import { EMPTY_INTERACTION, InteractionTracker, type InteractionContext } from '../intelligence/social/interaction-engine';
import { gazePresenceLabel } from '../intelligence/social/face-social-control';
import { GazeHeadCalibrator } from '../intelligence/social/gaze-head-calibration';
import { GestureIntentTracker } from '../core/vision/gesture-intent';
import {
  EMPTY_SPATIAL_CONTROL_FRAME,
  SpatialUIController,
} from '../core/vision/spatial-ui-control';
import { SpatialDepthAnchorTracker } from '../core/vision/spatial-ray';
import {
  EMPTY_SPATIAL_TOUCH,
  SpatialDirectTouchTracker,
  spatialAnchorFromRect,
} from '../core/vision/spatial-anchor';
import { micProsodySnapshot } from '../core/audio-level';
import type { EnvironmentLabel } from '../core/vision/environment-model';
import { SpatialObjectRuntime } from '../core/vision/spatial-object';
import {
  SpatialPhysicsRuntime,
  type SpatialPhysicsState,
} from '../core/vision/spatial-physics';
import { resolveSpatialObjectCollisions } from '../core/vision/spatial-collision';
import { SpatialJointRuntime, type SpatialJointState } from '../core/vision/spatial-joint';
import { SpatialSelectionRuntime } from '../core/vision/spatial-layout';
import { SpatialDeviceAdapterRuntime } from '../core/vision/spatial-device-adapter';
import { bridgeXRHandTo21 } from '../core/vision/spatial-xr-hand-bridge';
import {
  EMPTY_HAND_KINEMATICS,
  SpatialHandKinematicsTracker,
  type SpatialHandKinematicsState,
} from '../core/vision/spatial-hand-kinematics';
import {
  EMPTY_HAND_CONTACT,
  SpatialHandContactRuntime,
  type SpatialHandContactState,
} from '../core/vision/spatial-hand-contact';
import {
  SpatialHandIntentRuntime,
  type SpatialHandIntentState,
} from '../core/vision/spatial-hand-intent';
import {
  SpatialXRProjectionRuntime,
  projectMetricPointAcrossViews,
} from '../core/vision/spatial-xr-projection';
import {
  SpatialXRSurfaceRuntime,
  type XRSurfaceProbe,
} from '../core/vision/spatial-xr-surface';
import { SpatialXRMetricManipulationRuntime } from '../core/vision/spatial-xr-manipulation';
import { SpatialXRBimanualRuntime, type XRBimanualTransform } from '../core/vision/spatial-xr-bimanual';
import { SpatialXRRigidBodyRuntime, SpatialXRHandCollisionRuntime } from '../core/vision/spatial-xr-rigid-body';
import {
  SpatialWorldRuntime,
  type SpatialObjectAttachment,
  type SpatialPlacementPreview,
  type SpatialWorldAnchor,
} from '../core/vision/spatial-world';
import {
  PRESENCE_SCENE_LABEL,
  learnedPresenceReturnMinute,
  resolvePresenceScene,
} from '../presence/presence-scene';
import { visualTestPresenceScene } from '../presence/presence-visual-test';
import {
  DEFAULT_SPATIAL_WINDOWS,
  clampSpatial,
  collectSpatialTargets,
  collectSpatialWorldAnchors,
  setXRWindowSurfaceState,
  spatialActionElement,
  spatialObjectAvailable,
  spatialObjectStyle,
  spatialPoseStyle,
  spatialWindowAvailable,
  spatialWindowStyle,
  type SpatialGrabSession,
  type SpatialWindowId,
  type SpatialWindowTransform,
  type TwoHandSpatialSession,
} from './spatial-ui-helpers';
import { usePresenceReturnLearning } from './usePresenceReturnLearning';
import { useVoiceSessionLifecycle } from './useVoiceSessionLifecycle';
import { useSpatialDomFeedback } from './useSpatialDomFeedback';
import { useAppPresentationState } from './useAppPresentationState';
import { useVisionTransport } from './useVisionTransport';
import { useWebXRTransport } from './useWebXRTransport';
import { useSpatialLayoutLifecycle } from './useSpatialLayoutLifecycle';
import { normalizeVisionPerception } from './vision-perception-normalizer';
import { useFaceSocialLifecycle } from './useFaceSocialLifecycle';
import { useFaceHeadControlLifecycle } from './useFaceHeadControlLifecycle';
import { useVisionWorldContext } from './useVisionWorldContext';
import { useVisionHandInput } from './useVisionHandInput';
import { updateVisionHandInteraction } from './vision-hand-interaction';
import { applySpatialSelectionGesture } from './spatial-selection-gesture';
import { handleSpatialObjectManipulation } from './spatial-object-manipulation';
import { handleSpatialWindowControl } from './spatial-window-control';
import { updateSpatialWindowBimanual } from './spatial-window-bimanual';
import { updateSpatialObjectBimanual, type SpatialGroupTransformState, type TwoHandObjectSession } from './spatial-object-bimanual';
import { stepSpatialObjectWorld } from './spatial-object-world-step';
import '../ui/a11y.css';

const ContentPanel = lazy(() => import('../ui/ContentPanel'));
const SettingsPanel = lazy(() => import('../settings/SettingsPanel'));

const STATE_COPY: Record<MiraState, string> = {
  idle: 'Sẵn sàng',
  listening: 'Đang nghe',
  thinking: 'Đang nghĩ',
  speaking: 'Đang nói',
  interrupted: 'Đã dừng',
  error: 'Cần kiểm tra',
};
const THEMES: Theme[] = ['nova', 'aura', 'ember', 'iris'];
export default function AppV2() {
  const mira = useMira();
  const {
    theme,
    setTheme,
    affectFollowing,
    setAffectFollowing,
  } = useAppPresentationState({ miraState: mira.state });
  const [faceActionFeedback, setFaceActionFeedback] = useState('');
  const faceActionTimerRef = useRef<number | null>(null);
  const {
    updateFaceHeadControl,
    resetFaceHeadControl,
  } = useFaceHeadControlLifecycle();
  const {
    faceSocialCue,
    presenceContinuity,
    updateFaceSocial,
    resetFaceSocial,
  } = useFaceSocialLifecycle();
  const [gazeTelemetry, setGazeTelemetry] = useState({ x: 0, y: 0 });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const {
    cameraPreviewRef,
    visionModulesRef,
    visionOn,
    visionBooting,
    visionError,
    startVisionTransport,
    stopVisionTransport,
  } = useVisionTransport();
  const [faceSeen, setFaceSeen] = useState(false);
  const [handSeen, setHandSeen] = useState(false);
  const [faceLandmarks, setFaceLandmarks] = useState<FaceLandmarkPoint[]>([]);
  const [handLandmarks, setHandLandmarks] = useState<HandLandmarkPoint[]>([]);
  const [handKinematics, setHandKinematics] = useState<SpatialHandKinematicsState>(() => ({
    ...EMPTY_HAND_KINEMATICS,
    palmCenter: { ...EMPTY_HAND_KINEMATICS.palmCenter },
    palmNormal: { ...EMPTY_HAND_KINEMATICS.palmNormal },
  }));
  const handContactRef = useRef(new SpatialHandContactRuntime());
  const [humanHandContact, setHumanHandContact] = useState<SpatialHandContactState>(() => ({
    ...EMPTY_HAND_CONTACT,
    contacts: [],
  }));
  const handIntentRef = useRef(new SpatialHandIntentRuntime());
  const [humanHandIntent, setHumanHandIntent] = useState<SpatialHandIntentState>({
    intent: 'none',
    confidence: 0,
    stableMs: 0,
    handedness: 'none',
    targetId: '',
    at: 0,
  });
  const {
    updateVisionWorldContext,
    resetVisionWorldContext,
  } = useVisionWorldContext();
  const [faceAffect, setFaceAffect] = useState<AffectState>(() => neutralAffect());
  const affectTrackerRef = useRef(new AffectTracker());
  const [interactionTelemetry, setInteractionTelemetry] = useState<InteractionContext>(() => ({ ...EMPTY_INTERACTION }));
  const { presenceClockMs, presenceReturnSamples, recentReturnAt } = usePresenceReturnLearning(
    presenceContinuity,
    interactionTelemetry.state,
  );
  const interactionTrackerRef = useRef(new InteractionTracker());
  const gazeHeadCalibratorRef = useRef(new GazeHeadCalibrator());
  const spatialUiRef = useRef(new SpatialUIController());
  const [spatialFrame, setSpatialFrame] = useState(() => ({
    ...EMPTY_SPATIAL_CONTROL_FRAME,
    pointer: { ...EMPTY_SPATIAL_CONTROL_FRAME.pointer },
  }));
  const [spatialFeedback, setSpatialFeedback] = useState('');
  const spatialFeedbackTimerRef = useRef<number | null>(null);
  const spatialCollisionFeedbackAtRef = useRef(0);
  const spatialHeadConsumedAtRef = useRef(0);
  const [spatialWindows, setSpatialWindows] = useState<Record<SpatialWindowId, SpatialWindowTransform>>(() => ({
    result: { ...DEFAULT_SPATIAL_WINDOWS.result },
    camera: { ...DEFAULT_SPATIAL_WINDOWS.camera },
  }));
  const spatialWindowsRef = useRef<Record<SpatialWindowId, SpatialWindowTransform>>({
    result: { ...DEFAULT_SPATIAL_WINDOWS.result },
    camera: { ...DEFAULT_SPATIAL_WINDOWS.camera },
  });
  const spatialGrabSessionRef = useRef<SpatialGrabSession | null>(null);
  const spatialDepthAnchorRef = useRef(new SpatialDepthAnchorTracker());
  const spatialTouchRef = useRef(new SpatialDirectTouchTracker());
  const [spatialTouch, setSpatialTouch] = useState(() => ({
    ...EMPTY_SPATIAL_TOUCH,
    point: { ...EMPTY_SPATIAL_TOUCH.point },
  }));
  const twoHandSpatialSessionRef = useRef<TwoHandSpatialSession | null>(null);
  const lastSpatialWindowRef = useRef<SpatialWindowId>('camera');
  const spatialObjectRuntimeRef = useRef(new SpatialObjectRuntime([{
    id: 'mira.core',
    label: 'Mira Core',
    minScale: 0.72,
    maxScale: 1.65,
    collisionRadius: 0.055,
    mass: 1.45,
  }, {
    id: 'mira.node',
    label: 'Mira Node',
    pose: {
      position: { x: -0.105, y: -0.085, z: 0.035 },
      scale: 0.78,
      rotation: -8,
    },
    minScale: 0.58,
    maxScale: 1.22,
    collisionRadius: 0.038,
    mass: 0.62,
  }]));
  const [spatialObjects, setSpatialObjects] = useState(() => spatialObjectRuntimeRef.current.snapshot());
  const spatialWorldRuntimeRef = useRef(new SpatialWorldRuntime());
  const spatialObjectAttachmentBeforeGrabRef = useRef<SpatialObjectAttachment | null>(null);
  const [placementPreview, setPlacementPreview] = useState<SpatialPlacementPreview | null>(null);
  const placementPreviewRef = useRef<SpatialPlacementPreview | null>(null);
  const spatialObjectDepthRef = useRef(new SpatialDepthAnchorTracker());
  const spatialPhysicsRef = useRef(new SpatialPhysicsRuntime());
  const spatialJointRuntimeRef = useRef(new SpatialJointRuntime());
  const spatialSelectionRef = useRef(new SpatialSelectionRuntime());
  const spatialDeviceAdapterRef = useRef(new SpatialDeviceAdapterRuntime());
  const {
    updateVisionHandInput,
    resetVisionHandInput,
  } = useVisionHandInput(spatialDeviceAdapterRef.current);
  const {
    webXRRuntimeRef,
    webXRAvailable,
    webXRSnapshot,
    startWebXRTransport,
    stopWebXRTransport,
  } = useWebXRTransport(spatialDeviceAdapterRef.current);
  const xrProjectionRef = useRef(new SpatialXRProjectionRuntime());
  const xrGestureIntentRef = useRef(new GestureIntentTracker());
  const xrHandKinematicsRef = useRef(new SpatialHandKinematicsTracker());
  const xrSurfaceRef = useRef(new SpatialXRSurfaceRuntime());
  const xrMetricManipulationRef = useRef(new SpatialXRMetricManipulationRuntime());
  const xrBimanualRef = useRef(new SpatialXRBimanualRuntime());
  const xrRigidBodyRef = useRef(new SpatialXRRigidBodyRuntime());
  const xrHandCollisionRef = useRef(new SpatialXRHandCollisionRuntime());
  const xrAnchoredObjectIdsRef = useRef(new Set<string>());
  const xrRigidFeedbackAtRef = useRef(0);
  const xrAnchorDepthRef = useRef(new Map<string, number>());
  const [xrObjectDepthScale, setXrObjectDepthScale] = useState<Record<string, number>>({});
  const [xrObjectBimanual, setXrObjectBimanual] = useState<Record<string, XRBimanualTransform>>({});
  const [xrWindowDepthScale, setXrWindowDepthScale] = useState<Record<SpatialWindowId, number>>({
    camera: 1,
    result: 1,
  });
  const [xrWindowBimanual, setXrWindowBimanual] = useState<Partial<Record<SpatialWindowId, XRBimanualTransform>>>({});
  const [xrSurfaceProbe, setXrSurfaceProbe] = useState<XRSurfaceProbe | null>(null);
  const xrSurfaceFeedbackAtRef = useRef(0);
  const xrAutoCalibratedRef = useRef(false);
  const [selectedClusterRoots, setSelectedClusterRoots] = useState<string[]>([]);
  const spatialJointBeforeGrabRef = useRef<SpatialJointState | null>(null);
  const spatialJointControlRef = useRef<string | null>(null);
  const [spatialPhysicsState, setSpatialPhysicsState] = useState<SpatialPhysicsState>(() =>
    spatialPhysicsRef.current.snapshot('mira.core')
  );
  const spatialGroupTransformRef = useRef<SpatialGroupTransformState | null>(null);
  const twoHandObjectSessionRef = useRef<TwoHandObjectSession | null>(null);
  const [faceTelemetry, setFaceTelemetry] = useState({
    smile: 0, frown: 0, jaw: 0, browUp: 0, browDown: 0,
    gazeX: 0, gazeY: 0, yaw: 0, pitch: 0, roll: 0, distanceM: 0, confidence: 0,
    environmentLabel: 'unknown' as EnvironmentLabel,
    environmentConfidence: 0,
    headGesture: 'none', faceGesture: 'none', faceGestureConfidence: 0,
    muscles: { brow: 0, eyes: 0, cheeks: 0, mouth: 0, jaw: 0 },
  });

  useSpatialDomFeedback({
    focusId: spatialFrame.focus?.id,
    selectedClusterRoots,
    selectionVersion: spatialObjects,
    spatialWorld: spatialWorldRuntimeRef.current,
    touchReady: spatialTouch.ready,
    touchTargetId: spatialTouch.targetId,
    humanHandContact,
  });

  useDialogFocus(settingsOpen, '.v2-settings');

  useEffect(() => () => {
    if (faceActionTimerRef.current != null) window.clearTimeout(faceActionTimerRef.current);
    if (spatialFeedbackTimerRef.current != null) window.clearTimeout(spatialFeedbackTimerRef.current);
  }, []);

  const showFaceActionFeedback = useCallback((message: string) => {
    if (faceActionTimerRef.current != null) window.clearTimeout(faceActionTimerRef.current);
    setFaceActionFeedback(message);
    faceActionTimerRef.current = window.setTimeout(() => {
      faceActionTimerRef.current = null;
      setFaceActionFeedback('');
    }, 1100);
  }, []);

  const showSpatialFeedback = useCallback((message: string) => {
    if (spatialFeedbackTimerRef.current != null) window.clearTimeout(spatialFeedbackTimerRef.current);
    setSpatialFeedback(message);
    spatialFeedbackTimerRef.current = window.setTimeout(() => {
      spatialFeedbackTimerRef.current = null;
      setSpatialFeedback('');
    }, 900);
  }, []);

  const { captureSpatialLayout } = useSpatialLayoutLifecycle({
    active: visionOn || webXRSnapshot.active,
    spatialObjects,
    selectedClusterRoots,
    objectRuntime: spatialObjectRuntimeRef.current,
    worldRuntime: spatialWorldRuntimeRef.current,
    jointRuntime: spatialJointRuntimeRef.current,
    selectionRuntime: spatialSelectionRef.current,
    setSpatialObjects,
    setSelectedClusterRoots,
    showFeedback: showSpatialFeedback,
  });

  const updateSpatialWindow = useCallback((
    id: SpatialWindowId,
    updater: (current: SpatialWindowTransform) => SpatialWindowTransform,
  ) => {
    const current = spatialWindowsRef.current[id];
    const nextValue = updater(current);
    const next = {
      ...spatialWindowsRef.current,
      [id]: nextValue,
    };
    spatialWindowsRef.current = next;
    setSpatialWindows(next);
  }, []);

  const toggleAffectFollowing = useCallback(() => {
    setAffectFollowing((previous) => {
      const next = !previous;
      if (!next) mira.observeAffect(neutralAffect());
      return next;
    });
  }, [mira.observeAffect]);

  const stopVision = useCallback(async () => {
    captureSpatialLayout();
    stopVisionTransport();
    setFaceSeen(false);
    setHandSeen(false);
    setHandLandmarks([]);
    setHandKinematics({
      ...EMPTY_HAND_KINEMATICS,
      palmCenter: { ...EMPTY_HAND_KINEMATICS.palmCenter },
      palmNormal: { ...EMPTY_HAND_KINEMATICS.palmNormal },
    });
    setHumanHandContact(handContactRef.current.reset());
    handIntentRef.current.reset();
    setHumanHandIntent({
      intent: 'none',
      confidence: 0,
      stableMs: 0,
      handedness: 'none',
      targetId: '',
      at: 0,
    });
    setFaceActionFeedback('');
    resetFaceHeadControl();
    resetFaceSocial();
    setGazeTelemetry({ x: 0, y: 0 });
    setFaceLandmarks([]);
    resetVisionWorldContext();
    resetVisionHandInput();
    setSpatialFrame(spatialUiRef.current.reset());
    spatialGrabSessionRef.current = null;
    spatialDepthAnchorRef.current.reset();
    setSpatialTouch(spatialTouchRef.current.reset());
    twoHandSpatialSessionRef.current = null;
    twoHandObjectSessionRef.current = null;
    spatialObjectDepthRef.current.reset();
    spatialWorldRuntimeRef.current.reset();
    spatialObjectAttachmentBeforeGrabRef.current = null;
    placementPreviewRef.current = null;
    setPlacementPreview(null);
    spatialPhysicsRef.current.reset();
    spatialJointRuntimeRef.current.reset();
    spatialSelectionRef.current.clear();
    setSelectedClusterRoots([]);
    spatialGroupTransformRef.current = null;
    spatialJointBeforeGrabRef.current = null;
    spatialJointControlRef.current = null;
    setSpatialPhysicsState(spatialPhysicsRef.current.snapshot('mira.core'));
    setSpatialObjects(spatialObjectRuntimeRef.current.reset());
    setSpatialFeedback('');
    spatialCollisionFeedbackAtRef.current = 0;
    setInteractionTelemetry({ ...EMPTY_INTERACTION });
    interactionTrackerRef.current.reset();
    const neutral = neutralAffect();
    setFaceAffect(neutral);
    affectTrackerRef.current = new AffectTracker();
    mira.observeAffect(neutral);
    setFaceTelemetry({
      smile: 0, frown: 0, jaw: 0, browUp: 0, browDown: 0,
      gazeX: 0, gazeY: 0, yaw: 0, pitch: 0, roll: 0, distanceM: 0, confidence: 0,
      environmentLabel: 'unknown',
      environmentConfidence: 0,
      headGesture: 'none', faceGesture: 'none', faceGestureConfidence: 0,
      muscles: { brow: 0, eyes: 0, cheeks: 0, mouth: 0, jaw: 0 },
    });
  }, [captureSpatialLayout, mira.observeAffect, resetFaceHeadControl, resetFaceSocial, resetVisionHandInput, resetVisionWorldContext, stopVisionTransport]);

  const toggleWebXR = useCallback(async () => {
    if (webXRSnapshot.active) {
      await stopWebXRTransport();
      spatialDeviceAdapterRef.current.useWebcamFallback();
      xrProjectionRef.current.reset();
      xrGestureIntentRef.current.reset();
      xrHandKinematicsRef.current.reset();
      xrSurfaceRef.current.reset();
      xrMetricManipulationRef.current.cancel();
      xrBimanualRef.current.reset();
      xrRigidBodyRef.current.reset();
      xrHandCollisionRef.current.reset();
      xrAnchoredObjectIdsRef.current.clear();
      xrAnchorDepthRef.current.clear();
      setXrObjectDepthScale({});
      setXrObjectBimanual({});
      setXrWindowDepthScale({ camera: 1, result: 1 });
      setXrWindowBimanual({});
      setXrSurfaceProbe(null);
      handContactRef.current.reset();
      handIntentRef.current.reset();
      xrAutoCalibratedRef.current = false;
      setSpatialFrame(spatialUiRef.current.reset());
      showSpatialFeedback('Đã thoát XR');
      return;
    }

    const snapshot = await startWebXRTransport();
    if (!snapshot.active) {
      showSpatialFeedback(snapshot.error || 'Không mở được XR');
      return;
    }

    const enabled = snapshot.enabledFeatures;
    spatialDeviceAdapterRef.current.useWebXRSessionFeatures(enabled);
    xrProjectionRef.current.reset();
    xrGestureIntentRef.current.reset();
    xrHandKinematicsRef.current.reset();
    xrSurfaceRef.current.reset();
    xrMetricManipulationRef.current.cancel();
    xrBimanualRef.current.reset();
    xrRigidBodyRef.current.reset();
    xrHandCollisionRef.current.reset();
    xrAnchoredObjectIdsRef.current.clear();
    xrAnchorDepthRef.current.clear();
    setXrObjectDepthScale({});
    setXrObjectBimanual({});
    setXrWindowDepthScale({ camera: 1, result: 1 });
    setXrWindowBimanual({});
    setXrSurfaceProbe(null);
    handContactRef.current.reset();
    handIntentRef.current.reset();
    xrAutoCalibratedRef.current = false;
    setSpatialFrame(spatialUiRef.current.reset());
    showSpatialFeedback(
      enabled.includes('hand-tracking')
        ? 'XR · hand tracking đã sẵn sàng'
        : 'XR · session đã mở',
    );

    if (visionOn) {
      stopVisionTransport();
      setFaceSeen(false);
      setHandSeen(false);
      setFaceLandmarks([]);
    }
  }, [showSpatialFeedback, startWebXRTransport, stopVisionTransport, stopWebXRTransport, visionOn, webXRSnapshot.active]);

  const toggleVision = useCallback(async () => {
    if (visionBooting) return;
    if (visionOn) {
      await stopVision();
      return;
    }

    const on = await startVisionTransport();
    if (!on) await stopVision();
  }, [startVisionTransport, stopVision, visionBooting, visionOn]);

  const {
    voiceReady,
    voiceBooting,
    activateVoice,
    voiceSessionActive,
  } = useVoiceSessionLifecycle({
    mira,
    settingsOpen,
    visionOn,
    visionBooting,
    toggleVision,
  });

  useEffect(() => {
    if (!webXRSnapshot.active) return;
    const primaryHand = webXRSnapshot.hands.find((hand) => hand.indexTip) || null;
    const secondaryHand = webXRSnapshot.hands.find((hand) => hand !== primaryHand && hand.indexTip && hand.thumbTip) || null;
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
        .filter((anchor) => anchor.tracked && anchor.id.startsWith('object.'))
        .map((anchor) => anchor.id.slice('object.'.length)),
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
    const projectedLandmarks = bridged.worldLandmarks.map((point) => {
      const screen = projectMetricPointAcrossViews(point, webXRSnapshot.views);
      return {
        x: screen?.x ?? projected.x,
        y: screen?.y ?? projected.y,
        z: Math.max(-0.22, Math.min(0.22, (point.z - wristWorld.z) / handMetricLength * 0.08)),
      };
    });
    const xrKinematics = xrHandKinematicsRef.current.update({
      handedness: primaryHand.handedness,
      landmarks: projectedLandmarks,
      worldLandmarks: bridged.worldLandmarks,
      confidence: projected.confidence,
    }, performance.now());

    const now = performance.now();
    const targets = settingsOpen ? [] : collectSpatialTargets();
    const contactAnchors = targets.map((target) => spatialAnchorFromRect({
      ...target,
      depthRadius: Math.max(Number(target.depthRadius || 0), target.kind === 'window' ? 0.1 : 0.12),
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
        if (!xrAnchorDepthRef.current.has(objectId)) xrAnchorDepthRef.current.set(objectId, baselineDepth);
        const perspectiveScale = clampSpatial(baselineDepth / metricDepth, 0.72, 1.42);
        setXrObjectDepthScale((current) => (
          Math.abs((current[objectId] || 1) - perspectiveScale) < 0.015
            ? current
            : { ...current, [objectId]: perspectiveScale }
        ));

        const element = Array.from(document.querySelectorAll<HTMLElement>('[data-spatial-object]'))
          .find((node) => node.dataset.spatialObject === objectId && node.offsetParent !== null);
        if (!element) continue;
        const rect = element.getBoundingClientRect();
        const screenX = (rect.left + rect.right) / 2 / Math.max(1, window.innerWidth);
        const screenY = (rect.top + rect.bottom) / 2 / Math.max(1, window.innerHeight);
        const pose = {
          ...object.pose,
          position: {
            ...object.pose.position,
            x: clampSpatial(object.pose.position.x + (anchorProjection.x - screenX), -0.48, 0.48),
            y: clampSpatial(object.pose.position.y + (anchorProjection.y - screenY), -0.48, 0.48),
          },
        };
        spatialObjectRuntimeRef.current.setPose(objectId, pose);
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
        const element = document.querySelector<HTMLElement>(`[data-spatial-window="${id}"]`);
        if (!element || element.offsetParent === null) continue;
        const anchorProjection = projectMetricPointAcrossViews(anchor, webXRSnapshot.views);
        if (!anchorProjection?.visible) continue;

        const metricDepth = Math.max(0.08, -anchorProjection.depth);
        const depthKey = `window.${id}`;
        const baselineDepth = xrAnchorDepthRef.current.get(depthKey) || metricDepth;
        if (!xrAnchorDepthRef.current.has(depthKey)) xrAnchorDepthRef.current.set(depthKey, baselineDepth);
        const perspectiveScale = clampSpatial(baselineDepth / metricDepth, 0.72, 1.42);
        setXrWindowDepthScale((current) => (
          Math.abs((current[id] || 1) - perspectiveScale) < 0.015
            ? current
            : { ...current, [id]: perspectiveScale }
        ));

        const rect = element.getBoundingClientRect();
        const screenX = (rect.left + rect.right) / 2 / Math.max(1, window.innerWidth);
        const screenY = (rect.top + rect.bottom) / 2 / Math.max(1, window.innerHeight);
        updateSpatialWindow(id, (current) => ({
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
        const target = Array.from(document.querySelectorAll<HTMLElement>('[data-spatial-action]'))
          .find((element) => element.dataset.spatialAction === event.targetId);
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
          setXrWindowDepthScale((current) => ({ ...current, [id]: 1 }));
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
            setXrWindowBimanual((current) => ({ ...current, [id]: bimanualStart }));
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
            setXrWindowBimanual((current) => ({ ...current, [session.id]: bimanualMove }));
          }
          updateSpatialWindow(session.id, (current) => ({
            ...current,
            x: clampSpatial(session.base.x + dx, -window.innerWidth * 0.42, window.innerWidth * 0.42),
            y: clampSpatial(session.base.y + dy, -window.innerHeight * 0.34, window.innerHeight * 0.34),
            z: clampSpatial(
              session.base.z + (metricMove?.normalizedDepthDelta || 0) * 180,
              -160,
              160,
            ),
          }));
          if (metricMove) {
            setXrWindowDepthScale((current) => ({
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
            setXrWindowBimanual((current) => ({ ...current, [session.id]: bimanualRelease }));
          }
          const canRealAnchor = Boolean(
            surfaceProbe?.nearSurface &&
            surfaceProbe.confidence >= 0.45 &&
            webXRSnapshot.hit &&
            webXRSnapshot.enabledFeatures.includes('anchors')
          );
          const queuedRealAnchor = canRealAnchor
            ? webXRRuntimeRef.current.requestAnchorAtCurrentHit(windowKey, session.id, false)
            : false;
          if (!queuedRealAnchor) {
            setXrWindowDepthScale((current) => ({ ...current, [session.id]: 1 }));
          }
          setXRWindowSurfaceState(session.id, surfaceProbe);
          spatialGrabSessionRef.current = null;
          showSpatialFeedback(
            queuedRealAnchor
              ? metricRelease?.constrainedToSurface
                ? 'XR · cửa sổ bám bề mặt'
                : 'XR · đã neo cửa sổ'
              : 'XR · đã đặt cửa sổ'
          );
          continue;
        }
      }

      if (event.targetKind === 'object') {
        if (event.type === 'grab_start' && spatialObjectAvailable(event.targetId)) {
          webXRRuntimeRef.current.removeAnchor(`object.${event.targetId}`);
          xrAnchorDepthRef.current.delete(event.targetId);
          setXrObjectDepthScale((current) => ({ ...current, [event.targetId]: 1 }));
          spatialObjectAttachmentBeforeGrabRef.current = spatialWorldRuntimeRef.current.detachObject(event.targetId);
          spatialJointBeforeGrabRef.current = spatialJointRuntimeRef.current.removeForChild(event.targetId);
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
            setXrObjectBimanual((current) => ({ ...current, [event.targetId]: bimanualStart }));
          }
          setSpatialPhysicsState(spatialPhysicsRef.current.beginGrab(event.targetId, event.point, now));
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
            setXrObjectBimanual((current) => ({ ...current, [event.targetId]: bimanualMove }));
          }
          spatialObjectRuntimeRef.current.moveGrab(event.point, {
            depthDelta: metricMove?.normalizedDepthDelta ?? 0,
            xyGain: 1.05,
            depthGain: 1,
          });
          if (metricMove) {
            setXrObjectDepthScale((current) => ({
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
            setXrObjectBimanual((current) => ({ ...current, [event.targetId]: bimanualRelease }));
          }
          const placed = spatialObjectRuntimeRef.current.endGrab();
          const canRealAnchor = Boolean(
            placed &&
            surfaceProbe?.nearSurface &&
            surfaceProbe.confidence >= 0.45 &&
            webXRSnapshot.hit &&
            webXRSnapshot.enabledFeatures.includes('anchors')
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
          if (snapped) spatialObjectRuntimeRef.current.setPose(event.targetId, snapped.worldPose);
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
            setXrObjectDepthScale((current) => ({ ...current, [event.targetId]: 1 }));
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
                  : 'XR · đã đặt vật thể'
          );
        }
      }
    }
  }, [settingsOpen, showSpatialFeedback, updateSpatialWindow, webXRSnapshot]);

  useEffect(() => {
    if (!webXRSnapshot.active) return;

    let frame = 0;
    let cancelled = false;
    const tick = (now: number) => {
      if (cancelled) return;
      let changed = false;

      const rigidSteps = xrRigidBodyRef.current.stepAll(now);
      if (rigidSteps.length) {
        setXrObjectBimanual((current) => {
          const next = { ...current };
          for (const step of rigidSteps) {
            const committed = xrBimanualRef.current.commitExternal(step.objectId, step.transform);
            next[step.objectId] = committed;
          }
          return next;
        });
      }

      let objects = spatialObjectRuntimeRef.current.snapshot();
      for (const object of objects) {
        if (
          !object.grabbed &&
          !xrAnchoredObjectIdsRef.current.has(object.id) &&
          spatialPhysicsRef.current.isActive(object.id)
        ) {
          const inertiaStep = spatialPhysicsRef.current.step(object.id, object.pose, now);
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
        Object.fromEntries(objects.map((object) => [
          object.id,
          spatialPhysicsRef.current.velocity(object.id),
        ])),
      );

      if (collision.contacts.length) {
        for (const object of objects) {
          if (
            !object.grabbed &&
            !spatialWorldRuntimeRef.current.attachment(object.id) &&
            !xrAnchoredObjectIdsRef.current.has(object.id)
          ) {
            spatialObjectRuntimeRef.current.setPose(object.id, collision.poses[object.id]);
          }
          const impulse = collision.velocityDeltas[object.id];
          if (impulse && Math.hypot(impulse.x, impulse.y, impulse.z) > 0.012) {
            setSpatialPhysicsState(spatialPhysicsRef.current.addVelocity(object.id, impulse, now));
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
        if (selectionGesture.resetGroupTransform) spatialGroupTransformRef.current = null;
        showSpatialFeedback(selectionGesture.feedback);
      }

      const pinchedHands = rawHands.filter((hand) => Boolean(hand?.pinching));
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
        })) continue;

        if (event.type === 'activate') {
          const target = spatialActionElement(event.targetId);
          if (target) {
            target.click();
            showSpatialFeedback(`${event.source === 'face' ? 'Gật đầu' : 'Pinch'} · ${target.dataset.spatialLabel || 'Đã chọn'}`);
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
        })) continue;
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
        (String(snapshot?.gesture || 'None') === 'Pointing_Up' && gestureScoreNow >= 0.48) ||
        intent.intent === 'point_hold'
      );
      const interactionHands = rawHands
        .map((hand: any) => ({
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
          setAffectFollowing((previous) => !previous);
          showFaceActionFeedback('Nháy mắt trái · đổi chế độ phản ứng');
        } else if (socialEvent.action === 'cycle_theme') {
          setTheme((current) => THEMES[(THEMES.indexOf(current) + 1) % THEMES.length]);
          showFaceActionFeedback('Nháy mắt phải · đổi màu');
        }
      }

      const { promptContext: socialContext } = updateVisionWorldContext({
        environmentObjects,
        pointer: {
          active: pointingActive,
          x: rawPointerX,
          y: rawPointerY,
          confidence: pointingActive ? Math.max(gestureScoreNow, intent.confidence) : 0,
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
      if (socialContext) nextAffect.promptContext = nextAffect.promptContext + ' ' + socialContext;
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
        environmentLabel: (environmentContext.label || 'unknown') as EnvironmentLabel,
        environmentConfidence: Number(environmentContext.confidence || 0),
        headGesture: String(face?.headGesture || 'none'),
        faceGesture: String(face?.faceGesture || 'none'),
        faceGestureConfidence: Number(face?.faceGestureConfidence || 0),
        muscles: face?.muscles || { brow: 0, eyes: 0, cheeks: 0, mouth: 0, jaw: 0 },
      });
    }, 120);
    return () => window.clearInterval(timer);
  }, [affectFollowing, mira.interrupt, mira.observeAffect, mira.startListening, mira.stateRef, settingsOpen, showFaceActionFeedback, showSpatialFeedback, updateFaceHeadControl, updateFaceSocial, updateSpatialWindow, updateVisionHandInput, updateVisionWorldContext, visionOn, voiceReady]);

  const cycleTheme = () => setTheme(THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length]);
  const openLabs = () => {
    const url = new URL(window.location.href);
    url.searchParams.set('legacy', '1');
    window.location.assign(url.toString());
  };
  const moodLabel = ({
    happy: 'Tín hiệu tích cực',
    sad: 'Tín hiệu trầm',
    tired: 'Hoạt động thấp',
    angry: 'Tín hiệu căng',
    surprised: 'Phản ứng mở',
    neutral: 'Trung tính',
  } as Record<AffectState['mood'], string>)[faceAffect.mood];

  const affectSignal = describeAffectSignal({
    faceSeen,
    mood: faceAffect.mood,
    confidence: faceAffect.confidence,
    faceChannel: faceAffect.channels.face,
  });
  const gazeLabel = gazePresenceLabel(interactionTelemetry.state);

  const constellationContext = [
    ...mira.history.slice(-6).map((turn) => turn.text),
    mira.caption,
  ].join(' ');

  const expectedReturnMinute = learnedPresenceReturnMinute(presenceReturnSamples);
  const visualTestScene = typeof window === 'undefined'
    ? null
    : visualTestPresenceScene(window.location.search);
  const presenceScene = visualTestScene ?? resolvePresenceScene({
    now: presenceClockMs,
    presenceCue: presenceContinuity.cue,
    presenceMode: presenceContinuity.mode,
    interactionState: interactionTelemetry.state,
    expectedReturnMinute,
    recentReturnAt,
  });
  const cameraConnected = Boolean(
    webXRSnapshot.active ||
    (visionOn && (faceSeen || handSeen)),
  );

  return (
    <div
      className={`mira-v2 voice-only holographic-ui presence-${presenceScene} user-mood-${faceAffect.mood}${voiceBooting ? ' voice-booting' : ''}${webXRSnapshot.active ? ' xr-active' : ''}${mira.content ? ' has-result' : ''}`}
      data-xr-hands={webXRSnapshot.hands.length}
      data-xr-hit={webXRSnapshot.hit ? 'true' : 'false'}
      data-xr-depth={webXRSnapshot.depth.available ? 'true' : 'false'}
      data-xr-surface={xrSurfaceProbe?.occluded ? 'occluded' : xrSurfaceProbe?.touchingSurface ? 'touch' : xrSurfaceProbe?.nearSurface ? 'near' : 'clear'}
    >
      <a className="v2-skip" href="#main-content">Chuyển tới nội dung chính</a>

      <header className="v2-header voice-header">
        <div className="v2-brand" aria-label="Mira">
          <span className="v2-mark" aria-hidden="true"><i /></span>
          <span className="v2-wordmark"><b>Mira</b><small>Voice Companion</small></span>
        </div>
        <div className="v2-status compact" role="status" aria-live="polite" aria-atomic="true" title={STATE_COPY[mira.state]}>
          <span className={`v2-status-dot ${mira.state}`} aria-hidden="true" />
          <span className="sr-only">{STATE_COPY[mira.state]}</span>
        </div>
        <nav className="v2-actions" aria-label="Điều khiển Mira">
          <button
            type="button"
            className={visionOn ? 'vision-active' : ''}
            onClick={() => void toggleVision()}
            aria-pressed={visionOn}
            title={visionOn ? 'Tắt camera nhận diện' : 'Bật camera nhận diện'}
            data-spatial-action="camera.toggle"
            data-spatial-label={visionOn ? 'Tắt camera' : 'Bật camera'}
          >
            {visionOn ? <IconCameraOff /> : <IconCamera />}
            <span className="sr-only">{visionOn ? 'Tắt camera nhận diện' : 'Bật camera nhận diện'}</span>
          </button>
          {(webXRAvailable || webXRSnapshot.active) && (
            <button
              type="button"
              className={webXRSnapshot.active ? 'xr-active' : ''}
              onClick={() => void toggleWebXR()}
              aria-pressed={webXRSnapshot.active}
              title={webXRSnapshot.active ? 'Thoát WebXR' : 'Mở WebXR AR'}
              data-spatial-action="xr.toggle"
              data-spatial-label={webXRSnapshot.active ? 'Thoát XR' : 'Mở XR'}
            >
              <span className="v2-xr-glyph" aria-hidden="true">XR</span>
              <span className="sr-only">{webXRSnapshot.active ? 'Thoát WebXR' : 'Mở WebXR AR'}</span>
            </button>
          )}
          <button type="button" onClick={cycleTheme} title="Đổi màu" data-spatial-action="theme.cycle" data-spatial-label="Đổi màu"><span className="v2-theme-dot" aria-hidden="true" /><span className="sr-only">Đổi màu</span></button>
          <button type="button" onClick={() => setSettingsOpen(true)} title="Cài đặt" data-spatial-action="settings.open" data-spatial-label="Cài đặt"><IconSettings /><span className="sr-only">Mở cài đặt</span></button>
        </nav>
      </header>

      {(mira.error || visionError) && <div className="v2-error" role="alert">{visionError || mira.error}</div>}

      {(visionOn || webXRSnapshot.active) && (
        <div
          className={`v2-vision-monitor${webXRSnapshot.active && !visionOn ? ' xr-spatial-monitor' : ''}${visionOn && !cameraConnected ? ' camera-awaiting' : ''}`}
          aria-live="polite"
          aria-hidden={visionOn && !cameraConnected ? 'true' : undefined}
          style={spatialWindowStyle(
            spatialWindows.camera,
            xrWindowDepthScale.camera,
            xrWindowBimanual.camera,
          )}
          data-spatial-window="camera"
        >
          <div
            className={`v2-camera-frame${handSeen ? ' hand-depth-active' : ''}`}
            data-hand-intent={humanHandIntent.intent}
            data-hand-contact={humanHandContact.phase}
            style={{
              '--hand-depth-x': `${Math.max(0, Math.min(1, handKinematics.palmCenter.x)) * 100}%`,
              '--hand-depth-y': `${Math.max(0, Math.min(1, handKinematics.palmCenter.y)) * 100}%`,
              '--hand-depth-z': String(Math.max(0, Math.min(1, 0.5 - handKinematics.index.tip.z * 2.5))),
              '--hand-pressure': String(humanHandContact.pressure),
            } as CSSProperties}
          >
            {visionOn
              ? <video ref={cameraPreviewRef} className="v2-camera-preview" autoPlay muted playsInline aria-label="Camera preview" />
              : <div className="v2-xr-spatial-sensor" aria-label="XR spatial sensor" aria-hidden="true"><i /><span>XR</span></div>}
            {visionOn && handSeen && <span className="v2-hand-depth-field" aria-hidden="true" />}
            {visionOn && (
              <div className="v2-camera-status face-only" role="status" aria-live="polite">
                <span className={faceSeen ? 'detected' : 'scanning'}>
                  {faceSeen ? 'Đã nhận diện khuôn mặt' : 'Đang quét khuôn mặt'}
                </span>
              </div>
            )}
            {visionOn && faceSeen && (
              <FaceMeshOverlay
                points={faceLandmarks}
                active={faceSeen}
                muscles={faceTelemetry.muscles}
              />
            )}
            {visionOn && handSeen && (
              <HandSkeletonOverlay
                points={handLandmarks}
                active={handSeen}
                kinematics={handKinematics}
                contact={humanHandContact}
                intent={humanHandIntent}
              />
            )}
            {visionOn && faceSeen && (
              <>
                <div className={`v2-affect-readout tone-${affectSignal.tone}${affectSignal.ready ? ' ready' : ' reading'}`}>
                  <span>Biểu cảm</span>
                  <b>{affectSignal.label}</b>
                </div>
                <div className={`v2-gaze-readout state-${interactionTelemetry.state}`}>
                  <i aria-hidden="true" />
                  <span>{gazeLabel}</span>
                </div>
                <button
                  type="button"
                  className={`v2-affect-follow${affectFollowing ? ' active' : ''}`}
                  aria-pressed={affectFollowing}
                  onClick={toggleAffectFollowing}
                  title={affectFollowing ? 'Tắt phản ứng theo biểu cảm' : 'Bật phản ứng theo biểu cảm'}
                  data-spatial-action="affect.toggle"
                  data-spatial-label={affectFollowing ? 'Tắt phản ứng' : 'Bật phản ứng'}
                >
                  <i aria-hidden="true" />
                  <span>{affectFollowing ? 'Phản ứng · Bật' : 'Chỉ quan sát'}</span>
                </button>
                {faceActionFeedback && <div className="v2-face-action-feedback" role="status">{faceActionFeedback}</div>}
              </>
            )}
          </div>
          <div
            className="v2-spatial-window-bar"
            data-spatial-grab-handle="camera"
            data-spatial-label="Di chuyển camera"
            data-spatial-depth={spatialWindows.camera.z / 120}
            data-spatial-depth-radius="0.035"
            aria-hidden="true"
          ><i /></div>
        </div>
      )}
      {visionBooting && <div className="v2-vision-loading">Đang mở camera…</div>}
      <main className="v2-workspace voice-workspace" id="main-content" tabIndex={-1}>
        <div className="voice-stage holographic-stage">
          <PhotorealMira
            state={mira.state}
            onActivate={activateVoice}
            contextText={constellationContext}
            live={mira.live}
            voiceReady={voiceReady}
            caption={mira.caption}
            who={mira.who}
            brainName={mira.brainName}
            sttAvailable={mira.sttAvailable}
            observedMood={affectFollowing ? faceAffect.mood : 'neutral'}
            moodConfidence={faceAffect.confidence}
            affectActive={visionOn && faceSeen}
            affectFollowing={affectFollowing}
            interactionState={interactionTelemetry.state}
            attention={interactionTelemetry.attention}
            eyeContact={interactionTelemetry.eyeContact}
            gazeX={gazeTelemetry.x}
            gazeY={gazeTelemetry.y}
            cameraPoseEnabled={visionOn && faceSeen}
            headYaw={faceTelemetry.yaw}
            headPitch={faceTelemetry.pitch}
            headRoll={faceTelemetry.roll}
            cameraDistanceM={faceTelemetry.distanceM}
            cameraPoseConfidence={faceTelemetry.confidence}
            environmentLabel={faceTelemetry.environmentLabel}
            environmentConfidence={faceTelemetry.environmentConfidence}
            socialCue={faceSocialCue}
            presenceMode={presenceContinuity.mode}
            presenceCue={presenceContinuity.cue}
            presenceContinuity={presenceContinuity.continuity}
            presenceScene={presenceScene}
            spatialCoreStyle={spatialObjectStyle(
              spatialObjects.find((object) => object.id === 'mira.core') || null,
              xrObjectDepthScale['mira.core'] || 1,
              xrObjectBimanual['mira.core'],
            )}
            spatialCorePreviewStyle={placementPreview?.objectId === 'mira.core'
              ? spatialPoseStyle(placementPreview.targetPose)
              : undefined}
            spatialCorePreviewVisible={placementPreview?.objectId === 'mira.core'}
            spatialCorePhysicsMode={spatialPhysicsRef.current.snapshot('mira.core').mode}
            spatialCoreDepth={spatialObjects.find((object) => object.id === 'mira.core')?.pose.position.z || 0}
            spatialNodeStyle={spatialObjectStyle(
              spatialObjects.find((object) => object.id === 'mira.node') || null,
              xrObjectDepthScale['mira.node'] || 1,
              xrObjectBimanual['mira.node'],
            )}
            spatialNodePreviewStyle={placementPreview?.objectId === 'mira.node'
              ? spatialPoseStyle(placementPreview.targetPose)
              : undefined}
            spatialNodePreviewVisible={placementPreview?.objectId === 'mira.node'}
            spatialNodePhysicsMode={spatialPhysicsRef.current.snapshot('mira.node').mode}
            spatialNodeDepth={spatialObjects.find((object) => object.id === 'mira.node')?.pose.position.z || 0}
            spatialCoreActive={visionOn || webXRSnapshot.active}
          />
        </div>

        <div className="sr-only" aria-live="polite" aria-atomic="true">
          {mira.who}: {mira.caption}
        </div>

        {mira.content && (
          <aside className="v2-result" aria-label="Kết quả trực quan">
            <Suspense fallback={null}>
              <ContentPanel
                content={mira.content}
                onClose={mira.clearContent}
                spatialStyle={spatialWindowStyle(
                  spatialWindows.result,
                  xrWindowDepthScale.result,
                  xrWindowBimanual.result,
                )}
                spatialDepth={spatialWindows.result.z / 120}
              />
            </Suspense>
          </aside>
        )}
      </main>

      <SpatialControlOverlay
        frame={spatialFrame}
        touch={spatialTouch}
        placementPreview={placementPreview}
        visible={(visionOn || webXRSnapshot.active) && !settingsOpen && (faceSeen || handSeen || webXRSnapshot.hands.length > 0)}
        feedback={spatialFeedback}
      />

      <div className={`voice-footer state-${mira.state}${mira.live ? ' is-live' : ''}`}>
        <div className="voice-session-caption" role="status" aria-live="polite" aria-atomic="true">
          <small>{mira.state === 'idle' ? `Tự động · ${PRESENCE_SCENE_LABEL[presenceScene]}` : STATE_COPY[mira.state]}</small>
          <span>{mira.caption}</span>
        </div>
        <div className="voice-control-dock">
          <span className="voice-wave-mini" aria-hidden="true">
            {Array.from({ length: 9 }, (_, index) => <i key={index} />)}
          </span>
          <button
            type="button"
            className={`voice-primary state-${mira.state}${voiceSessionActive ? ' active' : ''}`}
            onClick={mira.live ? mira.toggleMic : activateVoice}
            aria-label={mira.live ? 'Điều khiển micro Mira' : 'Bắt đầu trò chuyện bằng giọng nói'}
            title={mira.live ? STATE_COPY[mira.state] : 'Nói với Mira'}
            data-spatial-action="voice.primary"
            data-spatial-label="Nói với Mira"
          >
            <IconMic />
          </button>
          <button
            type="button"
            className="voice-end"
            onClick={mira.stopLive}
            disabled={!mira.live}
            aria-label="Kết thúc trò chuyện"
            title="Kết thúc trò chuyện"
            data-spatial-action="voice.end"
            data-spatial-label="Kết thúc trò chuyện"
          >
            <IconPhoneOff />
          </button>
        </div>
      </div>

      {settingsOpen && (
        <Suspense fallback={null}>
          <SettingsPanel
            open
            onClose={() => setSettingsOpen(false)}
            theme={theme}
            onTheme={setTheme}
            voices={mira.voices}
            voiceURI={mira.voiceURI}
            onSelectVoice={mira.selectVoice}
            onTestVoice={mira.testVoice}
            getVoiceDiagnostics={mira.ttsDiagnostics}
            onOpenLabs={openLabs}
          />
        </Suspense>
      )}
    </div>
  );
}
