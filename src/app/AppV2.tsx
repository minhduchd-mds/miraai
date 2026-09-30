import { lazy, Suspense, useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { useMira } from '../core/useMira';
import type { MiraState, Theme } from '../core/types';
import { IconCamera, IconCameraOff, IconSettings } from '../ui/icons';
import { useDialogFocus } from '../ui/useDialogFocus';
import PhotorealMira from '../presence/PhotorealMira';
import FaceMeshOverlay, { type FaceLandmarkPoint } from '../presence/FaceMeshOverlay';
import HandSkeletonOverlay, { type HandLandmarkPoint } from '../presence/HandSkeletonOverlay';
import SpatialControlOverlay from '../presence/SpatialControlOverlay';
import { AffectTracker, neutralAffect, type AffectState } from '../intelligence/affect/mood-engine';
import { describeAffectSignal, resolveFaceControlAction } from '../intelligence/affect/affect-control';
import { EMPTY_INTERACTION, InteractionTracker, interactionPrompt, type InteractionContext } from '../intelligence/social/interaction-engine';
import { FaceSocialControlTracker, gazePresenceLabel, type FaceSocialCue } from '../intelligence/social/face-social-control';
import { EMPTY_PRESENCE_CONTINUITY, PresenceContinuityTracker, presenceContinuityPrompt, type PresenceContinuityState } from '../intelligence/social/presence-continuity';
import { BehaviorTimeline } from '../intelligence/social/behavior-timeline';
import { GazeHeadCalibrator } from '../intelligence/social/gaze-head-calibration';
import { GestureIntentTracker } from '../core/vision/gesture-intent';
import {
  EMPTY_SPATIAL_CONTROL_FRAME,
  SpatialUIController,
  type SpatialTargetGeometry,
} from '../core/vision/spatial-ui-control';
import { measureTwoHands, rotationFromAngles, scaleFromDistance, smoothValue } from '../presence/spatial-math';
import { hitTestSpatialRay, SpatialDepthAnchorTracker } from '../core/vision/spatial-ray';
import {
  EMPTY_SPATIAL_TOUCH,
  SpatialDirectTouchTracker,
  spatialAnchorFromRect,
} from '../core/vision/spatial-anchor';
import { micProsodySnapshot } from '../core/audio-level';
import { disableBackgroundCompanion, enableBackgroundCompanion } from '../runtime/background-companion';
import { EMPTY_ENVIRONMENT, environmentPrompt } from '../core/vision/environment-model';
import {
  SpatialSceneGraphTracker,
  spatialScenePrompt,
} from '../core/vision/spatial-scene-graph';
import {
  ObjectInteractionTracker,
  objectInteractionPrompt,
} from '../core/vision/object-interaction';
import {
  ActionSequenceTracker,
  actionSequencePrompt,
} from '../core/vision/action-sequence';
import {
  CausalActionGraphTracker,
  causalActionGraphPrompt,
} from '../core/vision/causal-action-graph';
import {
  ShortTermWorldModelTracker,
  worldModelPrompt,
} from '../core/vision/world-model';
import { EMPTY_REAL_PRESENCE_POSE } from '../core/vision/real-presence';
import { SpatialObjectRuntime, type SpatialObjectPose, type SpatialObjectState } from '../core/vision/spatial-object';
import {
  SpatialPhysicsRuntime,
  applySpatialSpringConstraint,
  type SpatialPhysicsState,
} from '../core/vision/spatial-physics';
import { resolveSpatialObjectCollisions } from '../core/vision/spatial-collision';
import { SpatialJointRuntime, type SpatialJointState } from '../core/vision/spatial-joint';
import {
  SpatialSelectionRuntime,
  spatialSessionLayoutRuntime,
} from '../core/vision/spatial-layout';
import {
  applySpatialGroupTransform,
  beginSpatialGroupTransform,
  type SpatialGroupTransformSession,
} from '../core/vision/spatial-group';
import { SpatialDeviceAdapterRuntime } from '../core/vision/spatial-device-adapter';
import { bridgeXRHandTo21 } from '../core/vision/spatial-xr-hand-bridge';
import {
  EMPTY_HAND_KINEMATICS,
  SpatialHandKinematicsTracker,
  mirrorSpatialHandKinematicsX,
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
  SpatialWebXRSessionRuntime,
  type WebXRSessionSnapshot,
} from '../core/vision/spatial-webxr-session';
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
const VOICE_HANDSHAKE_TEXT = 'Em nghe anh. Chế độ trò chuyện liên tục đã bật.';
const VOICE_HANDSHAKE_TIMEOUT = 5000;


type SpatialWindowId = 'result' | 'camera';

interface SpatialWindowTransform {
  x: number;
  y: number;
  z: number;
  scale: number;
  rotation: number;
}

interface SpatialGrabSession {
  id: SpatialWindowId;
  start: { x: number; y: number; z: number };
  base: SpatialWindowTransform;
}

interface TwoHandSpatialSession {
  id: SpatialWindowId;
  since: number;
  active: boolean;
  startDistance: number;
  startAngle: number;
  baseScale: number;
  baseRotation: number;
}

const DEFAULT_SPATIAL_WINDOWS: Record<SpatialWindowId, SpatialWindowTransform> = {
  result: { x: 0, y: 0, z: 0, scale: 1, rotation: 0 },
  camera: { x: 0, y: 0, z: 0, scale: 1, rotation: 0 },
};

function clampSpatial(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Number.isFinite(value) ? value : 0));
}

function spatialWindowStyle(
  transform: SpatialWindowTransform,
  xrDepthScale = 1,
  xrBimanual?: XRBimanualTransform | null,
): CSSProperties {
  return {
    '--spatial-x': `${transform.x}px`,
    '--spatial-y': `${transform.y}px`,
    '--spatial-z': `${transform.z}px`,
    '--spatial-scale': String(transform.scale),
    '--spatial-rotation': `${transform.rotation}deg`,
    '--xr-window-depth-scale': String(clampSpatial(xrDepthScale, 0.72, 1.42)),
    '--xr-window-bimanual-scale': String(clampSpatial(xrBimanual?.scaleRatio || 1, 0.58, 1.72)),
    '--xr-window-yaw': `${clampSpatial(xrBimanual?.yawDeg || 0, -72, 72)}deg`,
    '--xr-window-pitch': `${clampSpatial(xrBimanual?.pitchDeg || 0, -58, 58)}deg`,
    '--xr-window-roll': `${clampSpatial(xrBimanual?.rollDeg || 0, -95, 95)}deg`,
  } as CSSProperties;
}

function setXRWindowSurfaceState(id: SpatialWindowId, probe: XRSurfaceProbe | null): void {
  if (typeof document === 'undefined') return;
  const element = document.querySelector<HTMLElement>(`[data-spatial-window="${id}"]`);
  if (!element) return;
  const state = probe?.occluded
    ? 'occluded'
    : probe?.touchingSurface
      ? 'touch'
      : probe?.nearSurface
        ? 'near'
        : 'clear';
  element.dataset.xrSurface = state;
  if (probe?.occluded) element.setAttribute('data-xr-occluded', 'true');
  else element.removeAttribute('data-xr-occluded');
}

function collectSpatialTargets(): SpatialTargetGeometry[] {
  if (typeof document === 'undefined' || typeof window === 'undefined') return [];
  const width = Math.max(1, window.innerWidth);
  const height = Math.max(1, window.innerHeight);
  const targets: SpatialTargetGeometry[] = [];

  const push = (element: HTMLElement, id: string, label: string, kind: 'action' | 'window' | 'object', priority: number) => {
    if (!id || !label || element.offsetParent === null) return;
    const rect = element.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2) return;
    targets.push({
      id,
      label,
      kind,
      left: clampSpatial(rect.left / width, 0, 1),
      top: clampSpatial(rect.top / height, 0, 1),
      right: clampSpatial(rect.right / width, 0, 1),
      bottom: clampSpatial(rect.bottom / height, 0, 1),
      z: Number.isFinite(Number(element.dataset.spatialDepth))
        ? Number(element.dataset.spatialDepth)
        : undefined,
      depthRadius: Number.isFinite(Number(element.dataset.spatialDepthRadius))
        ? Number(element.dataset.spatialDepthRadius)
        : undefined,
      priority,
    });
  };

  document.querySelectorAll<HTMLElement>('[data-spatial-action]').forEach((element) => {
    if (element.hasAttribute('disabled')) return;
    push(
      element,
      String(element.dataset.spatialAction || ''),
      String(element.dataset.spatialLabel || element.getAttribute('aria-label') || element.title || 'Điều khiển'),
      'action',
      0.14,
    );
  });

  document.querySelectorAll<HTMLElement>('[data-spatial-grab-handle]').forEach((element) => {
    push(
      element,
      String(element.dataset.spatialGrabHandle || ''),
      String(element.dataset.spatialLabel || 'Di chuyển cửa sổ'),
      'window',
      0.08,
    );
  });

  document.querySelectorAll<HTMLElement>('[data-spatial-object]').forEach((element) => {
    push(
      element,
      String(element.dataset.spatialObject || ''),
      String(element.dataset.spatialLabel || 'Vật thể không gian'),
      'object',
      0.18,
    );
  });

  return targets;
}

function spatialActionElement(id: string): HTMLElement | null {
  if (typeof document === 'undefined') return null;
  return Array.from(document.querySelectorAll<HTMLElement>('[data-spatial-action]'))
    .find((element) => element.dataset.spatialAction === id) || null;
}

function spatialWindowAvailable(id: string): id is SpatialWindowId {
  if (id !== 'result' && id !== 'camera') return false;
  return typeof document !== 'undefined' &&
    Boolean(Array.from(document.querySelectorAll<HTMLElement>('[data-spatial-grab-handle]'))
      .find((element) => element.dataset.spatialGrabHandle === id && element.offsetParent !== null));
}

function spatialObjectAvailable(id: string): boolean {
  return typeof document !== 'undefined' &&
    Boolean(Array.from(document.querySelectorAll<HTMLElement>('[data-spatial-object]'))
      .find((element) => element.dataset.spatialObject === id && element.offsetParent !== null));
}

function spatialPoseStyle(pose: SpatialObjectPose | null | undefined): CSSProperties {
  return {
    '--spatial-object-x': `${(pose?.position.x || 0) * 100}vw`,
    '--spatial-object-y': `${(pose?.position.y || 0) * 100}vh`,
    '--spatial-object-z': `${(pose?.position.z || 0) * 180}px`,
    '--spatial-object-scale': String(pose?.scale || 1),
    '--spatial-object-rotation': `${pose?.rotation || 0}deg`,
  } as CSSProperties;
}

function spatialObjectStyle(
  object: SpatialObjectState | null,
  xrDepthScale = 1,
  xrBimanual?: XRBimanualTransform | null,
): CSSProperties {
  return {
    ...spatialPoseStyle(object?.pose),
    '--xr-depth-scale': String(clampSpatial(xrDepthScale, 0.72, 1.42)),
    '--xr-bimanual-scale': String(clampSpatial(xrBimanual?.scaleRatio || 1, 0.58, 1.72)),
    '--xr-bimanual-yaw': `${clampSpatial(xrBimanual?.yawDeg || 0, -72, 72)}deg`,
    '--xr-bimanual-pitch': `${clampSpatial(xrBimanual?.pitchDeg || 0, -58, 58)}deg`,
    '--xr-bimanual-roll': `${clampSpatial(xrBimanual?.rollDeg || 0, -95, 95)}deg`,
  } as CSSProperties;
}

function collectSpatialWorldAnchors(objects: SpatialObjectState[]): SpatialWorldAnchor[] {
  const identityPose = { position: { x: 0, y: 0, z: 0 }, scale: 1, rotation: 0 };
  const anchors: SpatialWorldAnchor[] = [{
    id: 'workspace.root',
    label: 'Không gian Mira',
    kind: 'workspace',
    pose: identityPose,
    snapRadius: 0.025,
    priority: -1,
  }, {
    id: 'dock.home',
    label: 'Vị trí Mira Core',
    kind: 'dock',
    parentId: 'workspace.root',
    pose: identityPose,
    snapRadius: 0.13,
    priority: 0.35,
    acceptsObjectId: 'mira.core',
  }, {
    id: 'dock.node.home',
    label: 'Vị trí Mira Node',
    kind: 'dock',
    parentId: 'workspace.root',
    pose: {
      position: { x: -0.105, y: -0.085, z: 0.035 },
      scale: 1,
      rotation: 0,
    },
    snapRadius: 0.12,
    priority: 0.32,
    acceptsObjectId: 'mira.node',
  }];

  if (!objects.length || typeof document === 'undefined' || typeof window === 'undefined') return anchors;
  const primary = objects[0];
  const element = Array.from(document.querySelectorAll<HTMLElement>('[data-spatial-object]'))
    .find((node) => node.dataset.spatialObject === primary.id && node.offsetParent !== null);
  if (!element) return anchors;

  const width = Math.max(1, window.innerWidth);
  const height = Math.max(1, window.innerHeight);
  const rect = element.getBoundingClientRect();
  const objectScreen = {
    x: (rect.left + rect.right) / 2 / width,
    y: (rect.top + rect.bottom) / 2 / height,
  };

  const poseForScreenPoint = (x: number, y: number, z = primary.pose.position.z) => ({
    position: {
      x: clampSpatial(primary.pose.position.x + (x - objectScreen.x), -0.48, 0.48),
      y: clampSpatial(primary.pose.position.y + (y - objectScreen.y), -0.48, 0.48),
      z: clampSpatial(z, -0.7, 0.7),
    },
    scale: 1,
    rotation: 0,
  });

  objects.forEach((object) => {
    anchors.push({
      id: `object.${object.id}`,
      label: object.label,
      kind: 'object',
      parentId: 'workspace.root',
      pose: object.pose,
      snapRadius: 0.14,
      priority: 0.45,
      ownerObjectId: object.id,
    }, {
      id: `stack.${object.id}`,
      label: `Xếp trên ${object.label}`,
      kind: 'dock',
      parentId: `object.${object.id}`,
      pose: {
        position: {
          x: 0,
          y: -(object.collisionRadius * 2.05),
          z: object.collisionRadius * 0.55,
        },
        scale: 1,
        rotation: 0,
      },
      snapRadius: Math.max(0.08, object.collisionRadius * 2.35),
      priority: 0.58,
      ownerObjectId: object.id,
    }, {
      id: `slide.${object.id}`,
      label: `Trượt cạnh ${object.label}`,
      kind: 'dock',
      parentId: `object.${object.id}`,
      pose: {
        position: {
          x: object.collisionRadius * 2.35,
          y: 0,
          z: object.collisionRadius * 0.2,
        },
        scale: 1,
        rotation: 0,
      },
      snapRadius: Math.max(0.075, object.collisionRadius * 2.05),
      priority: 0.54,
      ownerObjectId: object.id,
    });
  });

  anchors.push({
    id: 'dock.center',
    label: 'Trung tâm không gian',
    kind: 'dock',
    parentId: 'workspace.root',
    pose: poseForScreenPoint(0.5, 0.5),
    snapRadius: 0.12,
    priority: 0.2,
  });

  document.querySelectorAll<HTMLElement>('[data-spatial-window]').forEach((windowElement) => {
    if (windowElement.offsetParent === null) return;
    const id = String(windowElement.dataset.spatialWindow || '');
    if (!id) return;
    const windowRect = windowElement.getBoundingClientRect();
    const cx = (windowRect.left + windowRect.right) / 2 / width;
    const cy = (windowRect.top + windowRect.bottom) / 2 / height;
    const handle = Array.from(document.querySelectorAll<HTMLElement>('[data-spatial-grab-handle]'))
      .find((node) => node.dataset.spatialGrabHandle === id);
    const surfaceZ = clampSpatial(Number(handle?.dataset.spatialDepth || primary.pose.position.z), -0.7, 0.7);
    const surfaceId = `surface.${id}`;

    anchors.push({
      id: surfaceId,
      label: id === 'camera' ? 'Mặt phẳng Camera' : 'Mặt phẳng Kết quả',
      kind: 'surface',
      parentId: 'workspace.root',
      pose: poseForScreenPoint(cx, cy, surfaceZ),
      snapRadius: 0.12,
      priority: -0.15,
      constraint: {
        axis: 'xy',
        halfExtents: {
          x: clampSpatial(windowRect.width / width / 2, 0.05, 0.45),
          y: clampSpatial(windowRect.height / height / 2, 0.04, 0.45),
          z: 0.04,
        },
        offset: 0,
      },
    }, {
      id: `dock.${id}`,
      label: id === 'camera' ? 'Neo cạnh Camera' : 'Neo cạnh Kết quả',
      kind: 'dock',
      parentId: surfaceId,
      pose: {
        position: { x: 0, y: -0.065, z: 0.025 },
        scale: 1,
        rotation: 0,
      },
      snapRadius: 0.16,
      priority: 0.5,
    });
  });

  return anchors;
}


function spatialJointForAttachment(
  childObjectId: string,
  parentObjectId: string | null,
  anchorId: string,
) {
  if (!parentObjectId) return null;
  if (anchorId.startsWith('stack.')) {
    return {
      id: `joint.${childObjectId}`,
      kind: 'fixed' as const,
      parentObjectId,
      childObjectId,
      stiffness: 1,
    };
  }
  if (anchorId.startsWith('slide.')) {
    return {
      id: `joint.${childObjectId}`,
      kind: 'slider' as const,
      parentObjectId,
      childObjectId,
      axis: 'x' as const,
      min: -0.11,
      max: 0.11,
      stiffness: 0.9,
    };
  }
  if (anchorId.startsWith('object.')) {
    return {
      id: `joint.${childObjectId}`,
      kind: 'hinge' as const,
      parentObjectId,
      childObjectId,
      axis: 'z' as const,
      min: -42,
      max: 42,
      stiffness: 0.9,
    };
  }
  return null;
}


function loadTheme(): Theme {
  try {
    const raw = localStorage.getItem('mira.theme');
    if (raw === 'nova' || raw === 'aura' || raw === 'ember' || raw === 'iris') return raw;
  } catch {
    // noop
  }
  return 'nova';
}

function loadAffectFollowing(): boolean {
  try {
    return localStorage.getItem('mira.affect.follow') !== '0';
  } catch {
    return true;
  }
}

export default function AppV2() {
  const mira = useMira();
  const [theme, setTheme] = useState<Theme>(loadTheme);
  const [affectFollowing, setAffectFollowing] = useState(loadAffectFollowing);
  const [faceActionFeedback, setFaceActionFeedback] = useState('');
  const faceActionTimerRef = useRef<number | null>(null);
  const lastHeadGestureRef = useRef('none');
  const lastFaceActionAtRef = useRef(0);
  const faceSocialTrackerRef = useRef(new FaceSocialControlTracker());
  const presenceContinuityRef = useRef(new PresenceContinuityTracker());
  const [presenceContinuity, setPresenceContinuity] = useState<PresenceContinuityState>(() => ({ ...EMPTY_PRESENCE_CONTINUITY }));
  const [faceSocialCue, setFaceSocialCue] = useState<FaceSocialCue>('none');
  const faceSocialCueTimerRef = useRef<number | null>(null);
  const [gazeTelemetry, setGazeTelemetry] = useState({ x: 0, y: 0 });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [voiceReady, setVoiceReady] = useState(false);
  const [voiceBooting, setVoiceBooting] = useState(false);
  const bootPendingRef = useRef(false);
  const bootSawSpeakingRef = useRef(false);
  const bootTimerRef = useRef<number | null>(null);
  const cameraPreviewRef = useRef<HTMLVideoElement>(null);
  const visionModulesRef = useRef<typeof import('../presence/vision-runtime') | null>(null);
  const [visionOn, setVisionOn] = useState(false);
  const [visionBooting, setVisionBooting] = useState(false);
  const [visionError, setVisionError] = useState('');
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
  const sceneGraphTrackerRef = useRef(new SpatialSceneGraphTracker());
  const objectInteractionTrackerRef = useRef(new ObjectInteractionTracker());
  const actionSequenceTrackerRef = useRef(new ActionSequenceTracker());
  const causalActionGraphTrackerRef = useRef(new CausalActionGraphTracker());
  const worldModelTrackerRef = useRef(new ShortTermWorldModelTracker());
  const [faceAffect, setFaceAffect] = useState<AffectState>(() => neutralAffect());
  const affectTrackerRef = useRef(new AffectTracker());
  const [interactionTelemetry, setInteractionTelemetry] = useState<InteractionContext>(() => ({ ...EMPTY_INTERACTION }));
  const interactionTrackerRef = useRef(new InteractionTracker());
  const behaviorTimelineRef = useRef(new BehaviorTimeline());
  const gazeHeadCalibratorRef = useRef(new GazeHeadCalibrator());
  const gestureIntentTrackerRef = useRef(new GestureIntentTracker());
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
  const spatialLayoutRef = useRef(spatialSessionLayoutRuntime());
  const spatialLayoutSkipCaptureRef = useRef(false);
  const spatialDeviceAdapterRef = useRef(new SpatialDeviceAdapterRuntime());
  const webXRRuntimeRef = useRef(new SpatialWebXRSessionRuntime());
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
  const [webXRAvailable, setWebXRAvailable] = useState(false);
  const [webXRSnapshot, setWebXRSnapshot] = useState<WebXRSessionSnapshot>(() =>
    webXRRuntimeRef.current.snapshot()
  );
  const [selectedClusterRoots, setSelectedClusterRoots] = useState<string[]>([]);
  const spatialJointBeforeGrabRef = useRef<SpatialJointState | null>(null);
  const spatialJointControlRef = useRef<string | null>(null);
  const [spatialPhysicsState, setSpatialPhysicsState] = useState<SpatialPhysicsState>(() =>
    spatialPhysicsRef.current.snapshot('mira.core')
  );
  const spatialGroupTransformRef = useRef<{
    key: string;
    since: number;
    active: boolean;
    startDistance: number;
    startAngle: number;
    startCenter: { x: number; y: number };
    session: SpatialGroupTransformSession;
  } | null>(null);
  const twoHandObjectSessionRef = useRef<{
    id: string;
    since: number;
    active: boolean;
    startDistance: number;
    startAngle: number;
    baseScale: number;
    baseRotation: number;
    transformObjectId?: string;
    jointId?: string;
    jointKind?: 'fixed' | 'hinge' | 'slider';
    baseJointValue?: number;
    startCenterX?: number;
    baseAttachmentLocalPose?: SpatialObjectPose;
  } | null>(null);
  const [faceTelemetry, setFaceTelemetry] = useState({
    smile: 0, frown: 0, jaw: 0, browUp: 0, browDown: 0,
    gazeX: 0, gazeY: 0, yaw: 0, pitch: 0, roll: 0, distanceM: 0, confidence: 0,
    environmentLabel: 'unknown',
    environmentConfidence: 0,
    headGesture: 'none', faceGesture: 'none', faceGestureConfidence: 0,
    muscles: { brow: 0, eyes: 0, cheeks: 0, mouth: 0, jaw: 0 },
  });

  useDialogFocus(settingsOpen, '.v2-settings');

  useEffect(() => {
    let cancelled = false;
    void spatialDeviceAdapterRef.current.detectWebXR().then((capabilities) => {
      if (!cancelled) setWebXRAvailable(capabilities.mode === 'webxr-metric');
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!webXRSnapshot.active) return;
    const timer = window.setInterval(() => {
      const snapshot = webXRRuntimeRef.current.snapshot();
      setWebXRSnapshot(snapshot);
      if (!snapshot.active) setWebXRAvailable(true);
    }, 100);
    return () => window.clearInterval(timer);
  }, [webXRSnapshot.active]);

  useEffect(() => {
    document.body.dataset.state = mira.state;
    document.body.dataset.theme = theme;
  }, [mira.state, theme]);

  useEffect(() => {
    try { localStorage.setItem('mira.theme', theme); } catch { /* noop */ }
  }, [theme]);

  useEffect(() => {
    try { localStorage.setItem('mira.affect.follow', affectFollowing ? '1' : '0'); } catch { /* noop */ }
  }, [affectFollowing]);

  useEffect(() => () => {
    if (faceActionTimerRef.current != null) window.clearTimeout(faceActionTimerRef.current);
    if (faceSocialCueTimerRef.current != null) window.clearTimeout(faceSocialCueTimerRef.current);
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

  const loadVisionModules = useCallback(async () => {
    if (visionModulesRef.current) return visionModulesRef.current;
    const [runtime] = await Promise.all([
      import('../presence/vision-runtime'),
      import('../ui/vision-v2.css'),
    ]);
    visionModulesRef.current = runtime;
    return runtime;
  }, []);

  const stopVision = useCallback(async () => {
    spatialLayoutRef.current.capture({
      objects: spatialObjectRuntimeRef.current.snapshot(),
      attachments: spatialWorldRuntimeRef.current.attachmentSnapshot(),
      joints: spatialJointRuntimeRef.current.snapshot(),
      selectedClusterRoots: spatialSelectionRef.current.snapshot(),
    });

    const modules = visionModulesRef.current;
    modules?.stopVision();
    if (cameraPreviewRef.current) cameraPreviewRef.current.srcObject = null;
    setVisionOn(false);
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
    lastHeadGestureRef.current = 'none';
    lastFaceActionAtRef.current = 0;
    faceSocialTrackerRef.current.reset();
    presenceContinuityRef.current.reset();
    setPresenceContinuity({ ...EMPTY_PRESENCE_CONTINUITY });
    setFaceSocialCue('none');
    setGazeTelemetry({ x: 0, y: 0 });
    setFaceLandmarks([]);
    sceneGraphTrackerRef.current.reset();
    objectInteractionTrackerRef.current.reset();
    actionSequenceTrackerRef.current.reset();
    causalActionGraphTrackerRef.current.reset();
    worldModelTrackerRef.current.reset();
    gestureIntentTrackerRef.current.reset();
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
    behaviorTimelineRef.current.reset();
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
  }, [mira.observeAffect]);

  const toggleWebXR = useCallback(async () => {
    if (webXRSnapshot.active) {
      const snapshot = await webXRRuntimeRef.current.stop();
      setWebXRSnapshot(snapshot);
      setWebXRAvailable(true);
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

    const snapshot = await webXRRuntimeRef.current.start(globalThis, document.body);
    setWebXRSnapshot(snapshot);
    if (!snapshot.active) {
      setWebXRAvailable(false);
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
    setWebXRAvailable(true);
    showSpatialFeedback(
      enabled.includes('hand-tracking')
        ? 'XR · hand tracking đã sẵn sàng'
        : 'XR · session đã mở',
    );

    if (visionOn) {
      const modules = visionModulesRef.current;
      modules?.stopVision();
      if (cameraPreviewRef.current) cameraPreviewRef.current.srcObject = null;
      setVisionOn(false);
      setFaceSeen(false);
      setHandSeen(false);
      setFaceLandmarks([]);
    }
  }, [showSpatialFeedback, visionOn, webXRSnapshot.active]);

  const toggleVision = useCallback(async () => {
    if (visionBooting) return;
    if (visionOn) {
      await stopVision();
      return;
    }

    setVisionBooting(true);
    setVisionError('');
    try {
      const modules = await loadVisionModules();
      const result = await modules.startVision();
      const on = result.ok;
      setVisionOn(on);

      const stream = modules.visionStream();
      if (on && stream && cameraPreviewRef.current) {
        cameraPreviewRef.current.srcObject = stream;
        cameraPreviewRef.current.muted = true;
        cameraPreviewRef.current.playsInline = true;
        await cameraPreviewRef.current.play().catch(() => {});
      }

      if (!on) {
        setVisionError(result.error || 'Không mở được camera. Hãy kiểm tra quyền Camera của trình duyệt.');
      }
    } catch (error) {
      setVisionError(error instanceof Error ? error.message : 'Không mở được camera.');
      await stopVision();
    } finally {
      setVisionBooting(false);
    }
  }, [loadVisionModules, stopVision, visionBooting, visionOn]);

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
    if (!visionOn && !webXRSnapshot.active) return;
    const saved = spatialLayoutRef.current.restore();
    if (!saved) return;
    spatialLayoutSkipCaptureRef.current = true;

    for (const savedObject of saved.objects) {
      spatialObjectRuntimeRef.current.setPose(savedObject.id, savedObject.pose);
    }

    spatialWorldRuntimeRef.current.setAnchors(
      collectSpatialWorldAnchors(spatialObjectRuntimeRef.current.snapshot()),
    );

    for (const attachment of saved.attachments) {
      const object = spatialObjectRuntimeRef.current.get(attachment.objectId);
      if (!object) continue;
      const restored = spatialWorldRuntimeRef.current.attachObject(
        attachment.objectId,
        attachment.anchorId,
        object.pose,
        attachment.attachedAt,
      );
      if (restored) {
        spatialWorldRuntimeRef.current.updateAttachmentLocalPose(
          attachment.objectId,
          attachment.localPose,
        );
      }
    }

    spatialJointRuntimeRef.current.reset();
    for (const joint of saved.joints) spatialJointRuntimeRef.current.setJoint(joint);

    const selected = spatialSelectionRef.current.replace(saved.selectedClusterRoots);
    setSelectedClusterRoots(selected);

    for (const attachment of saved.attachments) {
      const resolved = spatialWorldRuntimeRef.current.resolveObjectPose(attachment.objectId);
      if (resolved) spatialObjectRuntimeRef.current.setPose(attachment.objectId, resolved);
    }

    setSpatialObjects(spatialObjectRuntimeRef.current.snapshot());
    showSpatialFeedback('Đã khôi phục bố cục phiên');
  }, [showSpatialFeedback, visionOn, webXRSnapshot.active]);

  useEffect(() => {
    if (!visionOn && !webXRSnapshot.active) return;
    if (spatialLayoutSkipCaptureRef.current) {
      spatialLayoutSkipCaptureRef.current = false;
      return;
    }
    spatialLayoutRef.current.capture({
      objects: spatialObjects,
      attachments: spatialWorldRuntimeRef.current.attachmentSnapshot(),
      joints: spatialJointRuntimeRef.current.snapshot(),
      selectedClusterRoots,
    });
  }, [selectedClusterRoots, spatialObjects, visionOn, webXRSnapshot.active]);

  useEffect(() => {
    if (!visionOn) return;
    const modules = visionModulesRef.current;
    const preview = cameraPreviewRef.current;
    const stream = modules?.visionStream() || null;
    if (preview && stream) {
      preview.srcObject = stream;
      preview.muted = true;
      preview.playsInline = true;
      void preview.play().catch(() => {});
    }

    const timer = window.setInterval(() => {
      const current = visionModulesRef.current;
      const snapshot = current?.visionSnapshot();
      setFaceSeen(Boolean(snapshot?.faceSeen));
      setHandSeen(Boolean(snapshot?.handSeen));
      const face = snapshot?.face;
      setFaceLandmarks(Array.isArray(face?.landmarks) ? face.landmarks : []);
      const micro = face?.microExpression || { kind: 'none', confidence: 0, durationMs: 0 };
      const posture = snapshot?.posture || {
        present: false, label: 'unknown', confidence: 0, upright: 0, slump: 0, lean: 0, motion: 0, landmarks: [],
      };
      const pulse = snapshot?.rppg || {
        status: 'off', bpmTrend: 0, quality: 0, relativeActivation: 0, sampleCount: 0,
      };
      const environmentSensor = snapshot?.environment;
      const environmentContext = environmentSensor?.environment || { ...EMPTY_ENVIRONMENT };
      const environmentObjects = Array.isArray(environmentSensor?.objects) ? environmentSensor.objects : [];
      const now = performance.now();
      const spatial = face?.spatialPose || { ...EMPTY_REAL_PRESENCE_POSE };
      const faceConfidence = Math.max(Number(spatial.confidence || 0), face?.present ? 0.65 : 0);
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

      const intent = gestureIntentTrackerRef.current.update({
        gesture: String(snapshot?.gesture || 'None'),
        score: Number(snapshot?.gestureScore || 0),
        pinching: Boolean(snapshot?.pinching),
        wave: Boolean(snapshot?.wave),
      }, now);

      const rawHands = (Array.isArray(snapshot?.hands) ? snapshot.hands : []) as any[];
      const primaryHand = rawHands.find((hand) => String(hand?.handedness || '') === 'Right') || rawHands[0] || null;
      const primaryGesture = String(primaryHand?.gesture || snapshot?.gesture || 'None');
      const primaryScore = Number(primaryHand?.score ?? snapshot?.gestureScore ?? 0);
      const primaryPinching = Boolean(primaryHand?.pinching ?? snapshot?.pinching);
      const rawKinematics = primaryHand?.kinematics as SpatialHandKinematicsState | undefined;
      const screenKinematics = rawKinematics?.present
        ? mirrorSpatialHandKinematicsX(rawKinematics)
        : {
            ...EMPTY_HAND_KINEMATICS,
            handedness: String(primaryHand?.handedness || 'none'),
            at: now,
          };
      setHandLandmarks(Array.isArray(primaryHand?.landmarks) ? primaryHand.landmarks : []);
      setHandKinematics(screenKinematics);
      const relativePointer = spatialDeviceAdapterRef.current.webcamPoint({
        x: Number(primaryHand?.pointerX ?? snapshot?.pointerX ?? 0.5),
        y: Number(primaryHand?.pointerY ?? snapshot?.pointerY ?? 0.5),
        z: Number(primaryHand?.z ?? snapshot?.pointerZ ?? 0),
        confidence: primaryScore,
      });
      const primaryPointerX = relativePointer.x;
      const primaryPointerY = relativePointer.y;
      const primaryPointerZ = clampSpatial(relativePointer.z, -0.45, 0.45);
      const pointingHand = Boolean(snapshot?.handSeen) && (
        (primaryGesture === 'Pointing_Up' && primaryScore >= 0.55) ||
        intent.intent === 'point_hold' ||
        screenKinematics.pointingConfidence >= 0.62
      );
      const handConfidence = primaryPinching
        ? Math.max(0.78, primaryScore, screenKinematics.pinchConfidence)
        : pointingHand
          ? Math.max(0.62, primaryScore, screenKinematics.pointingConfidence)
          : Math.max(0.5, primaryScore, screenKinematics.confidence * 0.82);

      const spatialTargets = settingsOpen ? [] : collectSpatialTargets();

      let spatialObjectsChanged = false;
      for (const object of spatialObjectRuntimeRef.current.snapshot()) {
        if (!object.grabbed && spatialPhysicsRef.current.isActive(object.id)) {
          const inertiaStep = spatialPhysicsRef.current.step(object.id, object.pose, now);
          spatialObjectRuntimeRef.current.setPose(object.id, inertiaStep.pose);
          setSpatialPhysicsState(inertiaStep.state);
          spatialObjectsChanged = true;
        }
      }

      let currentSpatialObjects = spatialObjectRuntimeRef.current.snapshot();
      spatialWorldRuntimeRef.current.setAnchors(collectSpatialWorldAnchors(currentSpatialObjects));

      for (const object of currentSpatialObjects) {
        const attachment = spatialWorldRuntimeRef.current.attachment(object.id);
        if (!attachment && !object.grabbed && spatialPhysicsRef.current.isActive(object.id)) {
          const inertiaPreview = spatialWorldRuntimeRef.current.previewSnapObject(object.id, object.pose);
          if (inertiaPreview &&
              inertiaPreview.strength >= 0.78 &&
              spatialPhysicsRef.current.snapshot(object.id).speed <= 0.34) {
            const snapped = spatialWorldRuntimeRef.current.snapObject(object.id, object.pose, now);
            if (snapped) {
              spatialObjectRuntimeRef.current.setPose(object.id, snapped.worldPose);
              setSpatialPhysicsState(spatialPhysicsRef.current.stop(object.id, now));

              const parentObjectId = spatialWorldRuntimeRef.current.parentObjectId(object.id);
              const jointDefinition = spatialJointForAttachment(
                object.id,
                parentObjectId,
                snapped.anchorId,
              );
              if (jointDefinition) spatialJointRuntimeRef.current.setJoint(jointDefinition);
              else spatialJointRuntimeRef.current.removeForChild(object.id);

              spatialObjectsChanged = true;
              showSpatialFeedback(`Đã bắt neo · ${snapped.anchorLabel}`);
            }
          }
        }
      }

      currentSpatialObjects = spatialObjectRuntimeRef.current.snapshot();
      spatialWorldRuntimeRef.current.setAnchors(collectSpatialWorldAnchors(currentSpatialObjects));

      for (const joint of spatialJointRuntimeRef.current.snapshot()) {
        if (!spatialWorldRuntimeRef.current.attachment(joint.childObjectId)) {
          spatialJointRuntimeRef.current.removeForChild(joint.childObjectId);
        }
      }

      for (const object of currentSpatialObjects) {
        const attachment = spatialWorldRuntimeRef.current.attachment(object.id);
        if (attachment && !object.grabbed) {
          const resolvedPose = spatialWorldRuntimeRef.current.resolveObjectPose(object.id);
          if (resolvedPose) {
            const delta = Math.hypot(
              resolvedPose.position.x - object.pose.position.x,
              resolvedPose.position.y - object.pose.position.y,
              resolvedPose.position.z - object.pose.position.z,
            );
            if (delta > 0.001 ||
                Math.abs(resolvedPose.scale - object.pose.scale) > 0.001 ||
                Math.abs(resolvedPose.rotation - object.pose.rotation) > 0.1) {
              spatialObjectRuntimeRef.current.setPose(object.id, resolvedPose);
              spatialObjectsChanged = true;
            }
          }
        }
      }

      currentSpatialObjects = spatialObjectRuntimeRef.current.snapshot();
      const collision = resolveSpatialObjectCollisions(
        currentSpatialObjects.map((object) => ({
          id: object.id,
          pose: object.pose,
          radius: object.collisionRadius,
          mass: object.mass,
          dynamic: !object.grabbed && !spatialWorldRuntimeRef.current.attachment(object.id),
          clusterId: spatialWorldRuntimeRef.current.clusterRootObjectId(object.id),
        })),
        Object.fromEntries(currentSpatialObjects.map((object) => [
          object.id,
          spatialPhysicsRef.current.velocity(object.id),
        ])),
      );

      if (collision.contacts.length) {
        for (const object of currentSpatialObjects) {
          if (!object.grabbed && !spatialWorldRuntimeRef.current.attachment(object.id)) {
            spatialObjectRuntimeRef.current.setPose(object.id, collision.poses[object.id]);
          }
          const impulse = collision.velocityDeltas[object.id];
          if (impulse && Math.hypot(impulse.x, impulse.y, impulse.z) > 0.012) {
            setSpatialPhysicsState(spatialPhysicsRef.current.addVelocity(object.id, impulse, now));
          }
        }

        spatialWorldRuntimeRef.current.setAnchors(
          collectSpatialWorldAnchors(spatialObjectRuntimeRef.current.snapshot()),
        );

        for (const contact of collision.contacts) {
          const a = spatialObjectRuntimeRef.current.get(contact.aId);
          const b = spatialObjectRuntimeRef.current.get(contact.bId);
          if (!a || !b) continue;

          const aAttached = Boolean(spatialWorldRuntimeRef.current.attachment(a.id));
          const bAttached = Boolean(spatialWorldRuntimeRef.current.attachment(b.id));
          if (contact.stackCandidate && !a.grabbed && !b.grabbed && !aAttached && !bAttached) {
            const child = a.pose.position.y <= b.pose.position.y ? a : b;
            const parent = child.id === a.id ? b : a;
            const attachment = spatialWorldRuntimeRef.current.attachObject(
              child.id,
              `stack.${parent.id}`,
              child.pose,
              now,
            );
            if (attachment) {
              spatialJointRuntimeRef.current.setJoint({
                id: `joint.${child.id}`,
                kind: 'fixed',
                parentObjectId: parent.id,
                childObjectId: child.id,
                stiffness: 1,
              });
              const resolved = spatialWorldRuntimeRef.current.resolveObjectPose(child.id);
              if (resolved) spatialObjectRuntimeRef.current.setPose(child.id, resolved);
              setSpatialPhysicsState(spatialPhysicsRef.current.stop(child.id, now));
              if (now - spatialCollisionFeedbackAtRef.current >= 650) {
                spatialCollisionFeedbackAtRef.current = now;
                showSpatialFeedback(`Đã xếp · ${child.label} trên ${parent.label}`);
              }
              spatialObjectsChanged = true;
              continue;
            }
          }

          if (contact.impulse > 0.01 && now - spatialCollisionFeedbackAtRef.current >= 650) {
            spatialCollisionFeedbackAtRef.current = now;
            showSpatialFeedback('Va chạm · truyền lực');
          }
        }
        spatialObjectsChanged = true;
      }

      if (spatialObjectsChanged) {
        setSpatialObjects(spatialObjectRuntimeRef.current.snapshot());
      }
      const spatialAnchors = spatialTargets.map((target) => spatialAnchorFromRect({
        ...target,
        depthRadius: Math.max(
          Number(target.depthRadius || 0),
          target.kind === 'window' ? 0.1 : 0.12,
        ),
      }));
      const humanContact = handContactRef.current.update(
        screenKinematics,
        spatialAnchors.map((anchor) => ({
          id: anchor.id,
          label: anchor.label,
          kind: anchor.kind,
          center: { ...anchor.center },
          halfExtents: { ...anchor.halfExtents },
          priority: anchor.priority,
        })),
        now,
      );
      setHumanHandContact(humanContact);
      const humanIntent = handIntentRef.current.update(screenKinematics, humanContact, now);
      setHumanHandIntent(humanIntent);

      const directTouch = spatialTouchRef.current.update({
        active: Boolean(snapshot?.handSeen && primaryHand),
        confidence: handConfidence,
        point: {
          x: primaryPointerX,
          y: primaryPointerY,
          z: primaryPointerZ,
        },
        pinching: primaryPinching,
        anchors: spatialAnchors,
      }, now);
      setSpatialTouch(directTouch);
      const directHand = pointingHand ||
        directTouch.ready ||
        humanContact.phase === 'contact' ||
        humanContact.phase === 'press' ||
        humanContact.phase === 'grab';

      const spatialRayTargets = spatialTargets
        .filter((target) => Number.isFinite(target.z))
        .map((target) => ({
          id: target.id,
          label: target.label,
          left: target.left,
          top: target.top,
          right: target.right,
          bottom: target.bottom,
          z: Number(target.z || 0),
          depthRadius: Number(target.depthRadius || 0),
          priority: target.priority,
        }));
      const handRay = primaryHand?.ray || snapshot?.pointerRay || null;
      const rayHitFromContact = directTouch.ready && directTouch.hit
        ? {
            targetId: directTouch.hit.targetId,
            label: directTouch.hit.label,
            point: { ...directTouch.hit.point },
            distance: 0,
            confidence: directTouch.hit.confidence,
          }
        : null;
      const rayHit = directHand
        ? rayHitFromContact || hitTestSpatialRay(handRay, spatialRayTargets)
        : null;

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

      if (intent.intent === 'victory_hold' && spatialFrameNext.focus?.kind === 'object') {
        const clusterRoot = spatialWorldRuntimeRef.current.clusterRootObjectId(spatialFrameNext.focus.id);
        const selected = spatialSelectionRef.current.toggle(clusterRoot);
        setSelectedClusterRoots(selected);
        showSpatialFeedback(
          selected.includes(clusterRoot)
            ? `Victory · chọn cụm ${clusterRoot}`
            : `Victory · bỏ chọn ${clusterRoot}`,
        );
      } else if (intent.intent === 'open_palm_hold' && spatialSelectionRef.current.snapshot().length) {
        spatialSelectionRef.current.clear();
        setSelectedClusterRoots([]);
        spatialGroupTransformRef.current = null;
        showSpatialFeedback('Open Palm · bỏ chọn nhóm');
      }

      const pinchedHands = rawHands.filter((hand) => Boolean(hand?.pinching));
      const twoHandsActive = pinchedHands.length >= 2;

      for (const event of spatialFrameNext.events) {
        if (event.targetKind === 'object') {
          if (event.type === 'grab_start' && spatialObjectAvailable(event.targetId)) {
            const existingAttachment = spatialWorldRuntimeRef.current.attachment(event.targetId);
            const existingJoint = spatialJointRuntimeRef.current.findForChild(event.targetId);

            if (twoHandsActive && existingAttachment && existingJoint) {
              spatialJointControlRef.current = event.targetId;
              showSpatialFeedback(
                existingJoint.kind === 'hinge'
                  ? 'Hai tay · điều khiển bản lề'
                  : existingJoint.kind === 'slider'
                    ? 'Hai tay · điều khiển thanh trượt'
                    : 'Hai tay · điều khiển cả cụm',
              );
              continue;
            }

            spatialObjectAttachmentBeforeGrabRef.current = spatialWorldRuntimeRef.current.detachObject(event.targetId);
            spatialJointBeforeGrabRef.current = spatialJointRuntimeRef.current.removeForChild(event.targetId);
            spatialObjectRuntimeRef.current.beginGrab(event.targetId, event.point);
            spatialObjectDepthRef.current.begin(event.point.z);
            setSpatialPhysicsState(spatialPhysicsRef.current.beginGrab(event.targetId, event.point, now));
            placementPreviewRef.current = null;
            setPlacementPreview(null);
            setSpatialObjects(spatialObjectRuntimeRef.current.snapshot());

            const clusterMembers = spatialWorldRuntimeRef.current.clusterObjectIds(event.targetId);
            showSpatialFeedback(
              clusterMembers.length > 1
                ? `Pinch giữ · cầm cụm ${clusterMembers.length} vật thể`
                : 'Pinch giữ · cầm vật thể 3D',
            );
            continue;
          }
          if (event.type === 'grab_move' && spatialJointControlRef.current === event.targetId) {
            continue;
          }
          if (event.type === 'grab_move' && !twoHandsActive) {
            const depth = spatialObjectDepthRef.current.update(event.point.z);
            setSpatialPhysicsState(spatialPhysicsRef.current.sampleGrab(event.targetId, event.point, now));
            const intentDepthDelta = humanIntent.intent === 'push'
              ? 0.035
              : humanIntent.intent === 'pull'
                ? -0.035
                : 0;
            const moved = spatialObjectRuntimeRef.current.moveGrab(event.point, {
              depthDelta: (depth.ready && depth.confidence >= 0.56 ? depth.normalizedDelta : 0) + intentDepthDelta,
              xyGain: 1.05,
              depthGain: 0.52,
            });
            if (moved && (humanIntent.intent === 'rotate_cw' || humanIntent.intent === 'rotate_ccw')) {
              spatialObjectRuntimeRef.current.applyTransform(event.targetId, {
                rotationDelta: humanIntent.intent === 'rotate_cw' ? 3.5 : -3.5,
              });
            }
            if (moved) {
              let worldObjects = spatialObjectRuntimeRef.current.snapshot();
              spatialWorldRuntimeRef.current.setAnchors(collectSpatialWorldAnchors(worldObjects));

              const clusterMembers = spatialWorldRuntimeRef.current.clusterObjectIds(event.targetId).slice(1);
              for (const childId of clusterMembers) {
                const resolvedChild = spatialWorldRuntimeRef.current.resolveObjectPose(childId);
                if (resolvedChild) spatialObjectRuntimeRef.current.setPose(childId, resolvedChild);
              }

              worldObjects = spatialObjectRuntimeRef.current.snapshot();
              spatialWorldRuntimeRef.current.setAnchors(collectSpatialWorldAnchors(worldObjects));
              const previewPlacement = spatialWorldRuntimeRef.current.previewSnapObject(event.targetId, moved.pose);
              placementPreviewRef.current = previewPlacement;
              setPlacementPreview(previewPlacement);
              if (previewPlacement && previewPlacement.strength >= 0.08) {
                const sprung = applySpatialSpringConstraint(
                  moved.pose,
                  previewPlacement.targetPose,
                  previewPlacement.strength,
                  0.05,
                );
                spatialObjectRuntimeRef.current.setPose(event.targetId, sprung);
              }
            }
            setSpatialObjects(spatialObjectRuntimeRef.current.snapshot());
            continue;
          }
          if (event.type === 'grab_end' && spatialJointControlRef.current === event.targetId) {
            spatialJointControlRef.current = null;
            showSpatialFeedback('Đã khóa vị trí khớp');
            continue;
          }
          if (event.type === 'grab_end') {
            const previewAtRelease = placementPreviewRef.current;
            const release = spatialPhysicsRef.current.release(
              event.targetId,
              previewAtRelease?.strength || 0,
              now,
            );
            setSpatialPhysicsState(spatialPhysicsRef.current.snapshot(event.targetId));
            const placed = spatialObjectRuntimeRef.current.endGrab();
            spatialObjectDepthRef.current.end();
            spatialWorldRuntimeRef.current.setAnchors(collectSpatialWorldAnchors(
              spatialObjectRuntimeRef.current.snapshot(),
            ));

            if (release.mode === 'throw') {
              spatialWorldRuntimeRef.current.detachObject(event.targetId);
              spatialJointRuntimeRef.current.removeForChild(event.targetId);
              showSpatialFeedback('Ném · quán tính không gian');
            } else {
              const snapped = placed
                ? spatialWorldRuntimeRef.current.snapObject(event.targetId, placed.pose, now)
                : null;
              if (snapped) {
                spatialObjectRuntimeRef.current.setPose(event.targetId, snapped.worldPose);
                setSpatialPhysicsState(spatialPhysicsRef.current.stop(event.targetId, now));

                const parentObjectId = spatialWorldRuntimeRef.current.parentObjectId(event.targetId);
                const jointDefinition = spatialJointForAttachment(
                  event.targetId,
                  parentObjectId,
                  snapped.anchorId,
                );
                if (jointDefinition) spatialJointRuntimeRef.current.setJoint(jointDefinition);
                else spatialJointRuntimeRef.current.removeForChild(event.targetId);

                showSpatialFeedback(`Đã neo · ${snapped.anchorLabel}`);
              } else {
                spatialJointRuntimeRef.current.removeForChild(event.targetId);
                setSpatialPhysicsState(spatialPhysicsRef.current.stop(event.targetId, now));
                showSpatialFeedback('Đã đặt vật thể tự do');
              }
            }
            spatialObjectAttachmentBeforeGrabRef.current = null;
            spatialJointBeforeGrabRef.current = null;
            placementPreviewRef.current = null;
            setPlacementPreview(null);
            setSpatialObjects(spatialObjectRuntimeRef.current.snapshot());
            continue;
          }
          if (event.type === 'cancel' && spatialJointControlRef.current === event.targetId) {
            spatialJointControlRef.current = null;
            twoHandObjectSessionRef.current = null;
            showSpatialFeedback('Đã hủy điều khiển khớp');
            continue;
          }
          if (event.type === 'cancel') {
            const restored = spatialObjectRuntimeRef.current.cancelGrab();
            spatialObjectDepthRef.current.reset();
            const previousAttachment = spatialObjectAttachmentBeforeGrabRef.current;
            if (restored && previousAttachment) {
              spatialWorldRuntimeRef.current.attachObject(
                event.targetId,
                previousAttachment.anchorId,
                restored.pose,
                previousAttachment.attachedAt,
              );
              if (spatialJointBeforeGrabRef.current) {
                spatialJointRuntimeRef.current.setJoint(spatialJointBeforeGrabRef.current);
              }
            }
            spatialObjectAttachmentBeforeGrabRef.current = null;
            spatialJointBeforeGrabRef.current = null;
            placementPreviewRef.current = null;
            setPlacementPreview(null);
            setSpatialPhysicsState(spatialPhysicsRef.current.stop(event.targetId, now));
            setSpatialObjects(spatialObjectRuntimeRef.current.snapshot());
            showSpatialFeedback('Đã hoàn tác vật thể');
            continue;
          }
        }

        if (event.type === 'activate') {
          const target = spatialActionElement(event.targetId);
          if (target) {
            target.click();
            showSpatialFeedback(`${event.source === 'face' ? 'Gật đầu' : 'Pinch'} · ${target.dataset.spatialLabel || 'Đã chọn'}`);
            if (event.source === 'face') spatialHeadConsumedAtRef.current = now;
          }
          continue;
        }

        if (event.type === 'grab_start' && spatialWindowAvailable(event.targetId)) {
          const id = event.targetId;
          spatialGrabSessionRef.current = {
            id,
            start: { x: event.point.x, y: event.point.y, z: event.point.z },
            base: { ...spatialWindowsRef.current[id] },
          };
          spatialDepthAnchorRef.current.begin(event.point.z);
          lastSpatialWindowRef.current = id;
          showSpatialFeedback('Pinch giữ · di chuyển cửa sổ');
          continue;
        }

        if (event.type === 'grab_move' && spatialGrabSessionRef.current && !twoHandsActive) {
          const session = spatialGrabSessionRef.current;
          if (session.id !== event.targetId) continue;
          const dx = (event.point.x - session.start.x) * window.innerWidth * 1.42;
          const dy = (event.point.y - session.start.y) * window.innerHeight * 1.3;
          const limitX = window.innerWidth * 0.56;
          const limitY = window.innerHeight * 0.48;
          const depth = spatialDepthAnchorRef.current.update(event.point.z);
          const depthPx = depth.ready && depth.confidence >= 0.56
            ? depth.normalizedDelta * 120
            : 0;
          updateSpatialWindow(session.id, () => ({
            ...session.base,
            x: clampSpatial(session.base.x + dx, -limitX, limitX),
            y: clampSpatial(session.base.y + dy, -limitY, limitY),
            z: clampSpatial(session.base.z + depthPx, -120, 120),
          }));
          continue;
        }

        if (event.type === 'grab_end') {
          spatialGrabSessionRef.current = null;
          spatialDepthAnchorRef.current.end();
          showSpatialFeedback('Đã thả cửa sổ');
          continue;
        }

        if (event.type === 'cancel') {
          spatialGrabSessionRef.current = null;
          spatialDepthAnchorRef.current.reset();
          twoHandSpatialSessionRef.current = null;
          spatialHeadConsumedAtRef.current = now;
          showSpatialFeedback('Đã hủy thao tác');
        }
      }

      const transformTarget = spatialFrameNext.focus?.kind === 'window'
        ? spatialFrameNext.focus.id
        : lastSpatialWindowRef.current;
      if (twoHandsActive && spatialWindowAvailable(transformTarget)) {
        const a = pinchedHands[0];
        const b = pinchedHands[1];
        const geometry = measureTwoHands(
          {
            x: clampSpatial(Number(a?.pointerX ?? a?.x ?? 0.5), 0, 1),
            y: clampSpatial(Number(a?.pointerY ?? a?.y ?? 0.5), 0, 1),
          },
          {
            x: clampSpatial(Number(b?.pointerX ?? b?.x ?? 0.5), 0, 1),
            y: clampSpatial(Number(b?.pointerY ?? b?.y ?? 0.5), 0, 1),
          },
        );
        let session = twoHandSpatialSessionRef.current;
        if (!session || session.id !== transformTarget) {
          const base = spatialWindowsRef.current[transformTarget];
          session = {
            id: transformTarget,
            since: now,
            active: false,
            startDistance: geometry.distance,
            startAngle: geometry.angleDeg,
            baseScale: base.scale,
            baseRotation: base.rotation,
          };
          twoHandSpatialSessionRef.current = session;
        } else if (!session.active && now - session.since >= 240 && geometry.distance >= 0.08) {
          session.active = true;
          showSpatialFeedback('Hai tay · scale / rotate');
        } else if (session.active) {
          const targetScale = scaleFromDistance(
            session.baseScale,
            session.startDistance,
            geometry.distance,
            0.82,
            1.28,
          );
          const targetRotation = rotationFromAngles(
            session.baseRotation,
            session.startAngle,
            geometry.angleDeg,
            -12,
            12,
          );
          updateSpatialWindow(session.id, (current) => ({
            ...current,
            scale: smoothValue(current.scale, targetScale, 0.26),
            rotation: smoothValue(current.rotation, targetRotation, 0.22),
          }));
        }
      } else {
        twoHandSpatialSessionRef.current = null;
      }

      const objectTarget = spatialFrameNext.focus?.kind === 'object'
        ? spatialFrameNext.focus.id
        : '';
      if (twoHandsActive && objectTarget && spatialObjectAvailable(objectTarget)) {
        const a = pinchedHands[0];
        const b = pinchedHands[1];
        const geometry = measureTwoHands(
          {
            x: clampSpatial(Number(a?.pointerX ?? a?.x ?? 0.5), 0, 1),
            y: clampSpatial(Number(a?.pointerY ?? a?.y ?? 0.5), 0, 1),
          },
          {
            x: clampSpatial(Number(b?.pointerX ?? b?.x ?? 0.5), 0, 1),
            y: clampSpatial(Number(b?.pointerY ?? b?.y ?? 0.5), 0, 1),
          },
        );

        const targetRoot = spatialWorldRuntimeRef.current.clusterRootObjectId(objectTarget);
        const selectedRoots = spatialSelectionRef.current.snapshot();
        const groupMode = selectedRoots.length > 1 && selectedRoots.includes(targetRoot);

        if (groupMode) {
          twoHandObjectSessionRef.current = null;
          spatialJointControlRef.current = null;
          const key = [...selectedRoots].sort().join('|');
          let groupSession = spatialGroupTransformRef.current;

          if (!groupSession || groupSession.key !== key) {
            for (const rootId of selectedRoots) {
              spatialWorldRuntimeRef.current.detachObject(rootId);
              spatialJointRuntimeRef.current.removeForChild(rootId);
              setSpatialPhysicsState(spatialPhysicsRef.current.stop(rootId, now));
            }
            spatialWorldRuntimeRef.current.setAnchors(
              collectSpatialWorldAnchors(spatialObjectRuntimeRef.current.snapshot()),
            );

            const runtimeSession = beginSpatialGroupTransform(
              spatialObjectRuntimeRef.current.snapshot(),
              selectedRoots,
            );
            if (runtimeSession) {
              groupSession = {
                key,
                since: now,
                active: false,
                startDistance: geometry.distance,
                startAngle: geometry.angleDeg,
                startCenter: { ...geometry.center },
                session: runtimeSession,
              };
              spatialGroupTransformRef.current = groupSession;
            }
          } else if (!groupSession.active && now - groupSession.since >= 240 && geometry.distance >= 0.08) {
            groupSession.active = true;
            showSpatialFeedback(`Hai tay · điều khiển ${selectedRoots.length} cụm`);
          } else if (groupSession.active) {
            const poses = applySpatialGroupTransform(groupSession.session, {
              translateX: (geometry.center.x - groupSession.startCenter.x) * 1.08,
              translateY: (geometry.center.y - groupSession.startCenter.y) * 1.08,
              scaleRatio: groupSession.startDistance > 0.001
                ? geometry.distance / groupSession.startDistance
                : 1,
              rotationDelta: rotationFromAngles(
                0,
                groupSession.startAngle,
                geometry.angleDeg,
                -45,
                45,
              ),
            });

            for (const [id, pose] of Object.entries(poses)) {
              spatialObjectRuntimeRef.current.setPose(id, pose);
            }

            spatialWorldRuntimeRef.current.setAnchors(
              collectSpatialWorldAnchors(spatialObjectRuntimeRef.current.snapshot()),
            );
            for (const rootId of selectedRoots) {
              for (const childId of spatialWorldRuntimeRef.current.clusterObjectIds(rootId).slice(1)) {
                const resolvedChild = spatialWorldRuntimeRef.current.resolveObjectPose(childId);
                if (resolvedChild) spatialObjectRuntimeRef.current.setPose(childId, resolvedChild);
              }
            }
            setSpatialObjects(spatialObjectRuntimeRef.current.snapshot());
          }
        } else {
          spatialGroupTransformRef.current = null;
          const attachment = spatialWorldRuntimeRef.current.attachment(objectTarget);
          const joint = spatialJointRuntimeRef.current.findForChild(objectTarget);
          let objectSession = twoHandObjectSessionRef.current;

          if (!objectSession || objectSession.id !== objectTarget) {
            const transformObjectId = joint?.kind === 'fixed' && attachment
              ? spatialWorldRuntimeRef.current.clusterRootObjectId(objectTarget)
              : objectTarget;
            const base = spatialObjectRuntimeRef.current.get(transformObjectId);
            if (base) {
              objectSession = {
                id: objectTarget,
                transformObjectId,
                since: now,
                active: false,
                startDistance: geometry.distance,
                startAngle: geometry.angleDeg,
                startCenterX: geometry.center.x,
                baseScale: base.pose.scale,
                baseRotation: base.pose.rotation,
                jointId: joint?.id,
                jointKind: joint?.kind,
                baseJointValue: joint?.value || 0,
                baseAttachmentLocalPose: attachment?.localPose,
              };
              twoHandObjectSessionRef.current = objectSession;
            }
          } else if (!objectSession.active && now - objectSession.since >= 240 && geometry.distance >= 0.08) {
            objectSession.active = true;
            showSpatialFeedback(
              objectSession.jointKind === 'hinge'
                ? 'Hai tay · xoay bản lề'
                : objectSession.jointKind === 'slider'
                  ? 'Hai tay · trượt theo ray'
                  : spatialWorldRuntimeRef.current.clusterObjectIds(
                      objectSession.transformObjectId || objectSession.id,
                    ).length > 1
                    ? 'Hai tay · scale / rotate cả cụm'
                    : 'Hai tay · scale / rotate vật thể',
            );
          } else if (objectSession.active) {
            const liveJoint = objectSession.jointId
              ? spatialJointRuntimeRef.current.get(objectSession.jointId)
              : null;

            if (liveJoint && objectSession.baseAttachmentLocalPose &&
                (liveJoint.kind === 'hinge' || liveJoint.kind === 'slider')) {
              const requestedValue = liveJoint.kind === 'hinge'
                ? rotationFromAngles(
                    objectSession.baseJointValue || 0,
                    objectSession.startAngle,
                    geometry.angleDeg,
                    liveJoint.min,
                    liveJoint.max,
                  )
                : (objectSession.baseJointValue || 0) +
                  (geometry.center.x - (objectSession.startCenterX || 0)) * 0.72;

              const constrained = spatialJointRuntimeRef.current.constrainLocalPose(
                objectSession.id,
                objectSession.baseAttachmentLocalPose,
                requestedValue,
              );
              if (constrained) {
                spatialWorldRuntimeRef.current.updateAttachmentLocalPose(
                  objectSession.id,
                  constrained.localPose,
                );
                const resolved = spatialWorldRuntimeRef.current.resolveObjectPose(objectSession.id);
                if (resolved) spatialObjectRuntimeRef.current.setPose(objectSession.id, resolved);
                setSpatialObjects(spatialObjectRuntimeRef.current.snapshot());
              }
            } else {
              const transformId = objectSession.transformObjectId || objectSession.id;
              const scale = scaleFromDistance(
                objectSession.baseScale,
                objectSession.startDistance,
                geometry.distance,
                0.72,
                1.65,
              );
              const rotation = rotationFromAngles(
                objectSession.baseRotation,
                objectSession.startAngle,
                geometry.angleDeg,
                -45,
                45,
              );
              spatialObjectRuntimeRef.current.applyTransform(transformId, { scale, rotation });

              spatialWorldRuntimeRef.current.setAnchors(
                collectSpatialWorldAnchors(spatialObjectRuntimeRef.current.snapshot()),
              );
              for (const childId of spatialWorldRuntimeRef.current.clusterObjectIds(transformId).slice(1)) {
                const resolvedChild = spatialWorldRuntimeRef.current.resolveObjectPose(childId);
                if (resolvedChild) spatialObjectRuntimeRef.current.setPose(childId, resolvedChild);
              }
              setSpatialObjects(spatialObjectRuntimeRef.current.snapshot());
            }
          }
        }
      } else {
        spatialGroupTransformRef.current = null;
        spatialJointControlRef.current = null;
        twoHandObjectSessionRef.current = null;
      }

      const gestureScoreNow = Number(snapshot?.gestureScore || 0);
      const rawPointerX = Math.max(0, Math.min(1, Number(snapshot?.pointerX ?? 0.5)));
      const rawPointerY = Math.max(0, Math.min(1, Number(snapshot?.pointerY ?? 0.5)));
      const pointingActive = Boolean(snapshot?.handSeen) && (
        (String(snapshot?.gesture || 'None') === 'Pointing_Up' && gestureScoreNow >= 0.48) ||
        intent.intent === 'point_hold'
      );
      const sceneGraph = sceneGraphTrackerRef.current.update(
        environmentObjects,
        {
          active: pointingActive,
          x: rawPointerX,
          y: rawPointerY,
          confidence: pointingActive ? Math.max(gestureScoreNow, intent.confidence) : 0,
        },
        now,
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
      const objectInteraction = objectInteractionTrackerRef.current.update(
        sceneGraph,
        interactionHands,
        now,
      );

      const actionSequence = actionSequenceTrackerRef.current.update(
        sceneGraph,
        interactionHands,
        now,
      );

      const causalActionGraph = causalActionGraphTrackerRef.current.update(
        sceneGraph,
        interactionHands,
        actionSequence,
        now,
      );

      const worldState = worldModelTrackerRef.current.update(
        sceneGraph,
        causalActionGraph,
        now,
      );

      const socialEvent = faceSocialTrackerRef.current.update({
        faceSeen: Boolean(face?.present),
        faceConfidence,
        gesture: String(face?.faceGesture || 'none'),
        gestureConfidence: Number(face?.faceGestureConfidence || 0),
      }, now);
      if (socialEvent.eventId > 0 && socialEvent.cue !== 'none') {
        setFaceSocialCue(socialEvent.cue);
        if (faceSocialCueTimerRef.current != null) window.clearTimeout(faceSocialCueTimerRef.current);
        faceSocialCueTimerRef.current = window.setTimeout(() => {
          faceSocialCueTimerRef.current = null;
          setFaceSocialCue('none');
        }, 720);

        if (socialEvent.action === 'toggle_affect') {
          setAffectFollowing((previous) => !previous);
          showFaceActionFeedback('Nháy mắt trái · đổi chế độ phản ứng');
        } else if (socialEvent.action === 'cycle_theme') {
          setTheme((current) => THEMES[(THEMES.indexOf(current) + 1) % THEMES.length]);
          showFaceActionFeedback('Nháy mắt phải · đổi màu');
        }
      }

      const continuity = presenceContinuityRef.current.update({
        faceSeen: Boolean(face?.present),
        interactionState: interaction.state,
        attention: interaction.attention,
        socialCue: socialEvent.cue,
      }, now);
      setPresenceContinuity(continuity);

      behaviorTimelineRef.current.observe({
        interaction,
        microKind: String(micro.kind || 'none'),
        microConfidence: Number(micro.confidence || 0),
        postureLabel: String(posture.label || 'unknown'),
        postureConfidence: Number(posture.confidence || 0),
        gesture: String(snapshot?.gesture || 'None'),
        gestureScore: Number(snapshot?.gestureScore || 0),
        proximity: String(spatial.proximity || 'unknown'),
        environment: String(environmentContext.label || 'unknown'),
        environmentConfidence: Number(environmentContext.confidence || 0),
        spatialTarget: sceneGraph.focus?.label || '',
        spatialConfidence: Number(sceneGraph.focus?.confidence || 0),
        objectInteractionStage: objectInteraction.stage,
        objectInteractionLabel: objectInteraction.objectLabel,
        objectInteractionConfidence: objectInteraction.confidence,
        actionSequenceStage: actionSequence.stage,
        actionSequenceLabel: actionSequence.objectLabel,
        actionSequenceConfidence: actionSequence.confidence,
        causalActionLabel: causalActionGraph.leader?.objectLabel || '',
        causalActionConfidence: Number(causalActionGraph.leader?.confidence || 0),
        causalActionMargin: causalActionGraph.margin,
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
      const socialContext = [
        interactionPrompt(interaction),
        presenceContinuityPrompt(continuity),
        behaviorTimelineRef.current.promptSummary(now),
        environmentPrompt(environmentContext),
        spatialScenePrompt(sceneGraph, now),
        objectInteractionPrompt(objectInteraction, now),
        actionSequencePrompt(actionSequence, now),
        causalActionGraphPrompt(causalActionGraph, now),
        worldModelPrompt(worldState, now),
      ]
        .filter(Boolean)
        .join(' ');
      if (socialContext) nextAffect.promptContext = nextAffect.promptContext + ' ' + socialContext;
      setFaceAffect(nextAffect);
      mira.observeAffect(affectFollowing ? nextAffect : neutralAffect());

      const headGesture = String(face?.headGesture || 'none');
      if (headGesture === 'none') {
        lastHeadGestureRef.current = 'none';
      } else if (headGesture !== lastHeadGestureRef.current) {
        lastHeadGestureRef.current = headGesture;
        if (now - spatialHeadConsumedAtRef.current < 520) {
          // This nod/shake was consumed by spatial UI control.
        } else {
        const faceAction = resolveFaceControlAction({
          faceSeen: Boolean(face?.present),
          faceConfidence,
          headGesture,
          state: mira.stateRef.current,
          voiceReady,
        });
        if (faceAction !== 'none' && now - lastFaceActionAtRef.current >= 1_400) {
          lastFaceActionAtRef.current = now;
          if (faceAction === 'interrupt') {
            mira.interrupt();
            showFaceActionFeedback('Lắc đầu · Mira đã dừng');
          } else if (faceAction === 'listen') {
            mira.startListening();
            showFaceActionFeedback('Gật đầu · Mira đang nghe');
          }
        }
        }
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
        environmentLabel: String(environmentContext.label || 'unknown'),
        environmentConfidence: Number(environmentContext.confidence || 0),
        headGesture: String(face?.headGesture || 'none'),
        faceGesture: String(face?.faceGesture || 'none'),
        faceGestureConfidence: Number(face?.faceGestureConfidence || 0),
        muscles: face?.muscles || { brow: 0, eyes: 0, cheeks: 0, mouth: 0, jaw: 0 },
      });
    }, 120);
    return () => window.clearInterval(timer);
  }, [affectFollowing, mira.interrupt, mira.observeAffect, mira.startListening, mira.stateRef, settingsOpen, showFaceActionFeedback, showSpatialFeedback, updateSpatialWindow, visionOn, voiceReady]);

  useEffect(() => {
    const previouslyFocused = document.querySelectorAll<HTMLElement>('[data-spatial-focused="true"]');
    previouslyFocused.forEach((element) => element.removeAttribute('data-spatial-focused'));
    const focusId = spatialFrame.focus?.id;
    if (!focusId) return;

    const target = Array.from(document.querySelectorAll<HTMLElement>('[data-spatial-action], [data-spatial-grab-handle], [data-spatial-object]'))
      .find((element) =>
        element.dataset.spatialAction === focusId ||
        element.dataset.spatialGrabHandle === focusId ||
        element.dataset.spatialObject === focusId
      );
    target?.setAttribute('data-spatial-focused', 'true');
    return () => target?.removeAttribute('data-spatial-focused');
  }, [spatialFrame.focus?.id]);

  useEffect(() => {
    const objects = document.querySelectorAll<HTMLElement>('[data-spatial-object]');
    objects.forEach((element) => element.removeAttribute('data-spatial-selected'));
    if (!selectedClusterRoots.length) return;

    objects.forEach((element) => {
      const id = String(element.dataset.spatialObject || '');
      if (!id) return;
      const root = spatialWorldRuntimeRef.current.clusterRootObjectId(id);
      if (selectedClusterRoots.includes(root)) {
        element.setAttribute('data-spatial-selected', 'true');
      }
    });

    return () => objects.forEach((element) => element.removeAttribute('data-spatial-selected'));
  }, [selectedClusterRoots, spatialObjects]);

  useEffect(() => {
    const previouslyTouched = document.querySelectorAll<HTMLElement>('[data-spatial-contacted="true"]');
    previouslyTouched.forEach((element) => element.removeAttribute('data-spatial-contacted'));
    if (!spatialTouch.ready || !spatialTouch.targetId) return;

    const target = Array.from(document.querySelectorAll<HTMLElement>('[data-spatial-action], [data-spatial-grab-handle], [data-spatial-object]'))
      .find((element) =>
        element.dataset.spatialAction === spatialTouch.targetId ||
        element.dataset.spatialGrabHandle === spatialTouch.targetId ||
        element.dataset.spatialObject === spatialTouch.targetId
      );
    target?.setAttribute('data-spatial-contacted', 'true');
    return () => target?.removeAttribute('data-spatial-contacted');
  }, [spatialTouch.ready, spatialTouch.targetId]);

  useEffect(() => {
    const previouslyHumanTouched = document.querySelectorAll<HTMLElement>('[data-spatial-human-contact]');
    previouslyHumanTouched.forEach((element) => {
      element.removeAttribute('data-spatial-human-contact');
      element.removeAttribute('data-spatial-pressed');
      element.style.removeProperty('--spatial-pressure');
    });
    if (!humanHandContact.active || !humanHandContact.primaryTargetId) return;

    const target = Array.from(document.querySelectorAll<HTMLElement>('[data-spatial-action], [data-spatial-grab-handle], [data-spatial-object]'))
      .find((element) =>
        element.dataset.spatialAction === humanHandContact.primaryTargetId ||
        element.dataset.spatialGrabHandle === humanHandContact.primaryTargetId ||
        element.dataset.spatialObject === humanHandContact.primaryTargetId
      );
    if (!target) return;

    target.setAttribute('data-spatial-human-contact', humanHandContact.phase);
    target.style.setProperty('--spatial-pressure', String(humanHandContact.pressure));
    if (humanHandContact.phase === 'press' || humanHandContact.phase === 'grab') {
      target.setAttribute('data-spatial-pressed', 'true');
    }

    return () => {
      target.removeAttribute('data-spatial-human-contact');
      target.removeAttribute('data-spatial-pressed');
      target.style.removeProperty('--spatial-pressure');
    };
  }, [
    humanHandContact.active,
    humanHandContact.phase,
    humanHandContact.pressure,
    humanHandContact.primaryTargetId,
  ]);

  useEffect(() => () => {
    const modules = visionModulesRef.current;
    modules?.stopVision();
    void webXRRuntimeRef.current.stop();
  }, []);

  useEffect(() => {
    const unlock = () => mira.unlockAudio();
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, [mira.unlockAudio]);

  const clearBootTimer = useCallback(() => {
    if (bootTimerRef.current != null) {
      window.clearTimeout(bootTimerRef.current);
      bootTimerRef.current = null;
    }
  }, []);

  const finishVoiceHandshake = useCallback(() => {
    if (!bootPendingRef.current) return;
    bootPendingRef.current = false;
    bootSawSpeakingRef.current = false;
    clearBootTimer();
    setVoiceBooting(false);
    setVoiceReady(true);
    window.setTimeout(() => mira.startLive(), 80);
  }, [clearBootTimer, mira.startLive]);

  useEffect(() => {
    if (!voiceBooting || !bootPendingRef.current) return;
    if (mira.state === 'speaking') bootSawSpeakingRef.current = true;
    if (mira.state === 'idle' && bootSawSpeakingRef.current) finishVoiceHandshake();
  }, [finishVoiceHandshake, mira.state, voiceBooting]);

  useEffect(() => () => clearBootTimer(), [clearBootTimer]);

  const activateVoice = useCallback(() => {
    mira.unlockAudio();
    if (!visionOn && !visionBooting) void toggleVision();

    if (voiceReady) {
      if (!mira.live) {
        mira.startLive();
      } else if (mira.stateRef.current === 'speaking' || mira.stateRef.current === 'thinking') {
        mira.interrupt();
      } else if (mira.stateRef.current === 'idle' || mira.stateRef.current === 'interrupted') {
        mira.startListening();
      }
      return;
    }

    if (bootPendingRef.current) {
      bootPendingRef.current = false;
      bootSawSpeakingRef.current = false;
      clearBootTimer();
      setVoiceBooting(false);
      setVoiceReady(true);
      if (mira.stateRef.current === 'speaking' || mira.stateRef.current === 'thinking') {
        mira.interrupt();
        window.setTimeout(() => mira.startLive(), 160);
      } else {
        mira.startLive();
      }
      return;
    }

    if (mira.stateRef.current !== 'idle') {
      setVoiceReady(true);
      mira.startLive();
      return;
    }

    bootPendingRef.current = true;
    bootSawSpeakingRef.current = false;
    setVoiceBooting(true);
    mira.say(VOICE_HANDSHAKE_TEXT);

    bootTimerRef.current = window.setTimeout(() => {
      if (!bootPendingRef.current) return;
      bootPendingRef.current = false;
      bootSawSpeakingRef.current = false;
      bootTimerRef.current = null;
      setVoiceBooting(false);
      setVoiceReady(true);
      if (mira.stateRef.current === 'speaking' || mira.stateRef.current === 'thinking') {
        mira.interrupt();
        window.setTimeout(() => mira.startLive(), 160);
      } else {
        mira.startLive();
      }
    }, VOICE_HANDSHAKE_TIMEOUT);
  }, [clearBootTimer, mira.interrupt, mira.live, mira.say, mira.startListening, mira.startLive, mira.stateRef, mira.unlockAudio, toggleVision, visionBooting, visionOn, voiceReady]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (settingsOpen || event.code !== 'Space' || event.repeat) return;
      const element = event.target as HTMLElement | null;
      if (element && /^(BUTTON|SELECT|INPUT|TEXTAREA)$/.test(element.tagName)) return;
      event.preventDefault();
      activateVoice();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [activateVoice, settingsOpen]);

  const cycleTheme = () => setTheme(THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length]);
  const openLabs = () => {
    const url = new URL(window.location.href);
    url.searchParams.set('legacy', '1');
    window.location.assign(url.toString());
  };
  const toggleLive = () => {
    mira.unlockAudio();
    setVoiceReady(true);
    mira.toggleLive();
  };

  useEffect(() => {
    const resumeIfNeeded = () => {
      if (document.visibilityState !== 'visible' || !mira.live) return;
      mira.notifyContextEvent('resume');
      if (mira.stateRef.current === 'idle' || mira.stateRef.current === 'interrupted') {
        window.setTimeout(() => {
          if (mira.live && (mira.stateRef.current === 'idle' || mira.stateRef.current === 'interrupted')) {
            mira.startListening();
          }
        }, 180);
      }
    };
    document.addEventListener('visibilitychange', resumeIfNeeded);
    window.addEventListener('focus', resumeIfNeeded);
    return () => {
      document.removeEventListener('visibilitychange', resumeIfNeeded);
      window.removeEventListener('focus', resumeIfNeeded);
    };
  }, [mira.live, mira.notifyContextEvent, mira.startListening, mira.stateRef]);

  useEffect(() => {
    if (!mira.live) {
      void disableBackgroundCompanion();
      return;
    }
    void enableBackgroundCompanion(() => {
      mira.notifyContextEvent('wake');
      if (mira.stateRef.current === 'idle' || mira.stateRef.current === 'interrupted') {
        mira.startListening();
      }
    });
    return () => { void disableBackgroundCompanion(); };
  }, [mira.live, mira.notifyContextEvent, mira.startListening, mira.stateRef]);

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

  return (
    <div
      className={`mira-v2 voice-only holographic-ui user-mood-${faceAffect.mood}${voiceBooting ? ' voice-booting' : ''}${webXRSnapshot.active ? ' xr-active' : ''}${mira.content ? ' has-result' : ''}`}
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
          className={`v2-vision-monitor${webXRSnapshot.active && !visionOn ? ' xr-spatial-monitor' : ''}`}
          aria-live="polite"
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
            {visionOn && !faceSeen && <div className="v2-face-scan-hint">Đưa khuôn mặt vào giữa khung hình</div>}
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

      <div className="voice-footer">
        <button
          type="button"
          className={`voice-live${mira.live ? ' active' : ''}`}
          onClick={toggleLive}
          aria-pressed={mira.live}
          aria-label={mira.live ? 'Tắt trò chuyện rảnh tay' : 'Bật trò chuyện rảnh tay'}
          title={mira.live ? 'Tắt trò chuyện rảnh tay' : 'Bật trò chuyện rảnh tay'}
          data-spatial-action="voice.live"
          data-spatial-label={mira.live ? 'Tắt live voice' : 'Bật live voice'}
        >
          <span aria-hidden="true" />
        </button>
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
            onOpenLabs={openLabs}
          />
        </Suspense>
      )}
    </div>
  );
}
