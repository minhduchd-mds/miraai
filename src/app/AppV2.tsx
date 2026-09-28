import { lazy, Suspense, useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { useMira } from '../core/useMira';
import type { MiraState, Theme } from '../core/types';
import { IconCamera, IconCameraOff, IconSettings } from '../ui/icons';
import { useDialogFocus } from '../ui/useDialogFocus';
import PhotorealMira from '../presence/PhotorealMira';
import FaceMeshOverlay, { type FaceLandmarkPoint } from '../presence/FaceMeshOverlay';
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
import { SpatialObjectRuntime, type SpatialObjectState } from '../core/vision/spatial-object';
import {
  SpatialWorldRuntime,
  type SpatialObjectAttachment,
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

function spatialWindowStyle(transform: SpatialWindowTransform): CSSProperties {
  return {
    '--spatial-x': `${transform.x}px`,
    '--spatial-y': `${transform.y}px`,
    '--spatial-z': `${transform.z}px`,
    '--spatial-scale': String(transform.scale),
    '--spatial-rotation': `${transform.rotation}deg`,
  } as CSSProperties;
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

function spatialObjectStyle(object: SpatialObjectState | null): CSSProperties {
  const pose = object?.pose;
  return {
    '--spatial-object-x': `${(pose?.position.x || 0) * 100}vw`,
    '--spatial-object-y': `${(pose?.position.y || 0) * 100}vh`,
    '--spatial-object-z': `${(pose?.position.z || 0) * 180}px`,
    '--spatial-object-scale': String(pose?.scale || 1),
    '--spatial-object-rotation': `${pose?.rotation || 0}deg`,
  } as CSSProperties;
}

function collectSpatialWorldAnchors(object: SpatialObjectState | null): SpatialWorldAnchor[] {
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
  }];

  if (!object || typeof document === 'undefined' || typeof window === 'undefined') return anchors;
  const element = Array.from(document.querySelectorAll<HTMLElement>('[data-spatial-object]'))
    .find((node) => node.dataset.spatialObject === object.id && node.offsetParent !== null);
  if (!element) return anchors;

  const width = Math.max(1, window.innerWidth);
  const height = Math.max(1, window.innerHeight);
  const rect = element.getBoundingClientRect();
  const objectScreen = {
    x: (rect.left + rect.right) / 2 / width,
    y: (rect.top + rect.bottom) / 2 / height,
  };

  const poseForScreenPoint = (x: number, y: number, z = object.pose.position.z) => ({
    position: {
      x: clampSpatial(object.pose.position.x + (x - objectScreen.x), -0.48, 0.48),
      y: clampSpatial(object.pose.position.y + (y - objectScreen.y), -0.48, 0.48),
      z: clampSpatial(z, -0.7, 0.7),
    },
    scale: 1,
    rotation: 0,
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
    const surfaceZ = clampSpatial(Number(handle?.dataset.spatialDepth || object.pose.position.z), -0.7, 0.7);
    const surfaceId = `surface.${id}`;

    anchors.push({
      id: surfaceId,
      label: id === 'camera' ? 'Mặt phẳng Camera' : 'Mặt phẳng Kết quả',
      kind: 'surface',
      parentId: 'workspace.root',
      pose: poseForScreenPoint(cx, cy, surfaceZ),
      snapRadius: 0.035,
      priority: -0.5,
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
  }]));
  const [spatialObjects, setSpatialObjects] = useState(() => spatialObjectRuntimeRef.current.snapshot());
  const spatialWorldRuntimeRef = useRef(new SpatialWorldRuntime());
  const spatialObjectAttachmentBeforeGrabRef = useRef<SpatialObjectAttachment | null>(null);
  const spatialObjectDepthRef = useRef(new SpatialDepthAnchorTracker());
  const twoHandObjectSessionRef = useRef<{
    id: string;
    since: number;
    active: boolean;
    startDistance: number;
    startAngle: number;
    baseScale: number;
    baseRotation: number;
  } | null>(null);
  const [faceTelemetry, setFaceTelemetry] = useState({
    smile: 0, frown: 0, jaw: 0, browUp: 0, browDown: 0,
    gazeX: 0, gazeY: 0, headGesture: 'none', faceGesture: 'none', faceGestureConfidence: 0,
    muscles: { brow: 0, eyes: 0, cheeks: 0, mouth: 0, jaw: 0 },
  });

  useDialogFocus(settingsOpen, '.v2-settings');

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
    const modules = visionModulesRef.current;
    modules?.stopVision();
    if (cameraPreviewRef.current) cameraPreviewRef.current.srcObject = null;
    setVisionOn(false);
    setFaceSeen(false);
    setHandSeen(false);
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
    setSpatialObjects(spatialObjectRuntimeRef.current.reset());
    setSpatialFeedback('');
    setInteractionTelemetry({ ...EMPTY_INTERACTION });
    interactionTrackerRef.current.reset();
    behaviorTimelineRef.current.reset();
    const neutral = neutralAffect();
    setFaceAffect(neutral);
    affectTrackerRef.current = new AffectTracker();
    mira.observeAffect(neutral);
    setFaceTelemetry({
      smile: 0, frown: 0, jaw: 0, browUp: 0, browDown: 0,
      gazeX: 0, gazeY: 0, headGesture: 'none', faceGesture: 'none', faceGestureConfidence: 0,
      muscles: { brow: 0, eyes: 0, cheeks: 0, mouth: 0, jaw: 0 },
    });
  }, [mira.observeAffect]);

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
      const primaryPointerX = clampSpatial(Number(primaryHand?.pointerX ?? snapshot?.pointerX ?? 0.5), 0, 1);
      const primaryPointerY = clampSpatial(Number(primaryHand?.pointerY ?? snapshot?.pointerY ?? 0.5), 0, 1);
      const primaryPointerZ = clampSpatial(Number(primaryHand?.z ?? snapshot?.pointerZ ?? 0), -0.45, 0.45);
      const pointingHand = Boolean(snapshot?.handSeen) && (
        (primaryGesture === 'Pointing_Up' && primaryScore >= 0.55) ||
        intent.intent === 'point_hold'
      );
      const handConfidence = primaryPinching
        ? Math.max(0.78, primaryScore)
        : pointingHand
          ? Math.max(0.62, primaryScore)
          : Math.max(0.5, primaryScore);

      const spatialTargets = settingsOpen ? [] : collectSpatialTargets();
      const currentCoreObject = spatialObjectRuntimeRef.current.get('mira.core');
      spatialWorldRuntimeRef.current.setAnchors(collectSpatialWorldAnchors(currentCoreObject));
      const coreAttachment = spatialWorldRuntimeRef.current.attachment('mira.core');
      if (coreAttachment && currentCoreObject && !currentCoreObject.grabbed) {
        const resolvedPose = spatialWorldRuntimeRef.current.resolveObjectPose('mira.core');
        if (resolvedPose) {
          const delta = Math.hypot(
            resolvedPose.position.x - currentCoreObject.pose.position.x,
            resolvedPose.position.y - currentCoreObject.pose.position.y,
            resolvedPose.position.z - currentCoreObject.pose.position.z,
          );
          if (delta > 0.001 ||
              Math.abs(resolvedPose.scale - currentCoreObject.pose.scale) > 0.001 ||
              Math.abs(resolvedPose.rotation - currentCoreObject.pose.rotation) > 0.1) {
            spatialObjectRuntimeRef.current.setPose('mira.core', resolvedPose);
            setSpatialObjects(spatialObjectRuntimeRef.current.snapshot());
          }
        }
      }
      const spatialAnchors = spatialTargets.map((target) => spatialAnchorFromRect({
        ...target,
        depthRadius: Math.max(
          Number(target.depthRadius || 0),
          target.kind === 'window' ? 0.1 : 0.12,
        ),
      }));
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
      const directHand = pointingHand || directTouch.ready;

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

      const pinchedHands = rawHands.filter((hand) => Boolean(hand?.pinching));
      const twoHandsActive = pinchedHands.length >= 2;

      for (const event of spatialFrameNext.events) {
        if (event.targetKind === 'object') {
          if (event.type === 'grab_start' && spatialObjectAvailable(event.targetId)) {
            spatialObjectAttachmentBeforeGrabRef.current = spatialWorldRuntimeRef.current.detachObject(event.targetId);
            spatialObjectRuntimeRef.current.beginGrab(event.targetId, event.point);
            spatialObjectDepthRef.current.begin(event.point.z);
            setSpatialObjects(spatialObjectRuntimeRef.current.snapshot());
            showSpatialFeedback('Pinch giữ · cầm vật thể 3D');
            continue;
          }
          if (event.type === 'grab_move' && !twoHandsActive) {
            const depth = spatialObjectDepthRef.current.update(event.point.z);
            spatialObjectRuntimeRef.current.moveGrab(event.point, {
              depthDelta: depth.ready && depth.confidence >= 0.56 ? depth.normalizedDelta : 0,
              xyGain: 1.05,
              depthGain: 0.52,
            });
            setSpatialObjects(spatialObjectRuntimeRef.current.snapshot());
            continue;
          }
          if (event.type === 'grab_end') {
            const placed = spatialObjectRuntimeRef.current.endGrab();
            spatialObjectDepthRef.current.end();
            spatialWorldRuntimeRef.current.setAnchors(collectSpatialWorldAnchors(placed));
            const snapped = placed
              ? spatialWorldRuntimeRef.current.snapObject(event.targetId, placed.pose, now)
              : null;
            if (snapped) {
              spatialObjectRuntimeRef.current.setPose(event.targetId, snapped.worldPose);
              showSpatialFeedback(`Đã neo · ${snapped.anchorLabel}`);
            } else {
              showSpatialFeedback('Đã đặt vật thể tự do');
            }
            spatialObjectAttachmentBeforeGrabRef.current = null;
            setSpatialObjects(spatialObjectRuntimeRef.current.snapshot());
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
            }
            spatialObjectAttachmentBeforeGrabRef.current = null;
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
        let objectSession = twoHandObjectSessionRef.current;
        if (!objectSession || objectSession.id !== objectTarget) {
          const base = spatialObjectRuntimeRef.current.get(objectTarget);
          if (base) {
            objectSession = {
              id: objectTarget,
              since: now,
              active: false,
              startDistance: geometry.distance,
              startAngle: geometry.angleDeg,
              baseScale: base.pose.scale,
              baseRotation: base.pose.rotation,
            };
            twoHandObjectSessionRef.current = objectSession;
          }
        } else if (!objectSession.active && now - objectSession.since >= 240 && geometry.distance >= 0.08) {
          objectSession.active = true;
          showSpatialFeedback('Hai tay · scale / rotate vật thể');
        } else if (objectSession.active) {
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
          spatialObjectRuntimeRef.current.applyTransform(objectSession.id, { scale, rotation });
          setSpatialObjects(spatialObjectRuntimeRef.current.snapshot());
        }
      } else {
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
    const previouslyTouched = document.querySelectorAll<HTMLElement>('[data-spatial-contacted="true"]');
    previouslyTouched.forEach((element) => element.removeAttribute('data-spatial-contacted'));
    if (!spatialTouch.ready || !spatialTouch.targetId) return;

    const target = Array.from(document.querySelectorAll<HTMLElement>('[data-spatial-action], [data-spatial-grab-handle]'))
      .find((element) =>
        element.dataset.spatialAction === spatialTouch.targetId ||
        element.dataset.spatialGrabHandle === spatialTouch.targetId ||
        element.dataset.spatialObject === spatialTouch.targetId
      );
    target?.setAttribute('data-spatial-contacted', 'true');
    return () => target?.removeAttribute('data-spatial-contacted');
  }, [spatialTouch.ready, spatialTouch.targetId]);

  useEffect(() => () => {
    const modules = visionModulesRef.current;
    modules?.stopVision();
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
    <div className={`mira-v2 voice-only holographic-ui user-mood-${faceAffect.mood}${voiceBooting ? ' voice-booting' : ''}${mira.content ? ' has-result' : ''}`}>
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
          <button type="button" onClick={cycleTheme} title="Đổi màu" data-spatial-action="theme.cycle" data-spatial-label="Đổi màu"><span className="v2-theme-dot" aria-hidden="true" /><span className="sr-only">Đổi màu</span></button>
          <button type="button" onClick={() => setSettingsOpen(true)} title="Cài đặt" data-spatial-action="settings.open" data-spatial-label="Cài đặt"><IconSettings /><span className="sr-only">Mở cài đặt</span></button>
        </nav>
      </header>

      {(mira.error || visionError) && <div className="v2-error" role="alert">{visionError || mira.error}</div>}

      {visionOn && (
        <div
          className="v2-vision-monitor"
          aria-live="polite"
          style={spatialWindowStyle(spatialWindows.camera)}
          data-spatial-window="camera"
        >
          <div className="v2-camera-frame">
            <video ref={cameraPreviewRef} className="v2-camera-preview" autoPlay muted playsInline aria-label="Camera preview" />
            <div className="v2-camera-status face-only" role="status" aria-live="polite">
              <span className={faceSeen ? 'detected' : 'scanning'}>
                {faceSeen ? 'Đã nhận diện khuôn mặt' : 'Đang quét khuôn mặt'}
              </span>
            </div>
            {faceSeen && (
              <FaceMeshOverlay
                points={faceLandmarks}
                active={faceSeen}
                muscles={faceTelemetry.muscles}
              />
            )}
            {faceSeen && (
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
            {!faceSeen && <div className="v2-face-scan-hint">Đưa khuôn mặt vào giữa khung hình</div>}
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
            socialCue={faceSocialCue}
            presenceMode={presenceContinuity.mode}
            presenceCue={presenceContinuity.cue}
            presenceContinuity={presenceContinuity.continuity}
            spatialCoreStyle={spatialObjectStyle(spatialObjects.find((object) => object.id === 'mira.core') || null)}
            spatialCoreDepth={spatialObjects.find((object) => object.id === 'mira.core')?.pose.position.z || 0}
            spatialCoreActive={visionOn}
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
                spatialStyle={spatialWindowStyle(spatialWindows.result)}
                spatialDepth={spatialWindows.result.z / 120}
              />
            </Suspense>
          </aside>
        )}
      </main>

      <SpatialControlOverlay
        frame={spatialFrame}
        touch={spatialTouch}
        visible={visionOn && !settingsOpen && (faceSeen || handSeen)}
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
