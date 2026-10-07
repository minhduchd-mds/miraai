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
import { useWebXRSpatialRuntime } from './useWebXRSpatialRuntime';
import { useVisionSpatialRuntime } from './useVisionSpatialRuntime';
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

  useWebXRSpatialRuntime({
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
  });

  useVisionSpatialRuntime({
    visionOn,
    visionModulesRef,
    settingsOpen,
    affectFollowing,
    voiceReady,
    themes: THEMES,
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
  });

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
