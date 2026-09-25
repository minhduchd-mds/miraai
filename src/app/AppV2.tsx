import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { useMira } from '../core/useMira';
import type { MiraState, Theme } from '../core/types';
import ContentPanel from '../ui/ContentPanel';
import { IconCamera, IconCameraOff, IconSettings } from '../ui/icons';
import { useDialogFocus } from '../ui/useDialogFocus';
import SettingsPanel from '../settings/SettingsPanel';
import PhotorealMira from '../presence/PhotorealMira';
import FaceMeshOverlay, { type FaceLandmarkPoint } from '../presence/FaceMeshOverlay';
import { AffectTracker, neutralAffect, type AffectState } from '../intelligence/affect/mood-engine';
import { EMPTY_INTERACTION, InteractionTracker, interactionPrompt, type InteractionContext } from '../intelligence/social/interaction-engine';
import { BehaviorTimeline, type BehaviorEvent } from '../intelligence/social/behavior-timeline';
import { GazeHeadCalibrator } from '../intelligence/social/gaze-head-calibration';
import { GestureIntentTracker, type GestureIntentState } from '../core/vision/gesture-intent';
import { micProsodySnapshot } from '../core/audio-level';
import { disableBackgroundCompanion, enableBackgroundCompanion } from '../runtime/background-companion';
import HandSkeletonOverlay, { type HandLandmarkPoint } from '../presence/HandSkeletonOverlay';
import PoseSkeletonOverlay, { type PoseSkeletonPoint } from '../presence/PoseSkeletonOverlay';
import ObjectAwarenessOverlay from '../presence/ObjectAwarenessOverlay';
import SpatialSceneOverlay from '../presence/SpatialSceneOverlay';
import { EMPTY_ENVIRONMENT, environmentPrompt, type TrackedObject } from '../core/vision/environment-model';
import {
  EMPTY_SPATIAL_SCENE,
  SpatialSceneGraphTracker,
  spatialScenePrompt,
  type SpatialRelation,
  type SpatialSceneGraph,
} from '../core/vision/spatial-scene-graph';
import AirControlOverlay from '../presence/AirControlOverlay';
import RealPresenceOverlay from '../presence/RealPresenceOverlay';
import { EMPTY_REAL_PRESENCE_POSE, type RealPresencePose } from '../core/vision/real-presence';
import {
  measureTwoHands,
  rotationFromAngles,
  scaleFromDistance,
  smoothValue,
} from '../presence/spatial-math';
import '../ui/a11y.css';

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

interface SpatialHand {
  handedness: string;
  gesture: string;
  score: number;
  x: number;
  y: number;
  pinching: boolean;
  landmarks: HandLandmarkPoint[];
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

export default function AppV2() {
  const mira = useMira();
  const [theme, setTheme] = useState<Theme>(loadTheme);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [voiceReady, setVoiceReady] = useState(false);
  const [voiceBooting, setVoiceBooting] = useState(false);
  const bootPendingRef = useRef(false);
  const bootSawSpeakingRef = useRef(false);
  const bootTimerRef = useRef<number | null>(null);
  const cameraPreviewRef = useRef<HTMLVideoElement>(null);
  const [visionMediaStream, setVisionMediaStream] = useState<MediaStream | null>(null);
  const visionModulesRef = useRef<typeof import('../presence/vision-runtime') | null>(null);
  const [visionOn, setVisionOn] = useState(false);
  const [visionBooting, setVisionBooting] = useState(false);
  const [visionError, setVisionError] = useState('');
  const [faceSeen, setFaceSeen] = useState(false);
  const [realPresencePose, setRealPresencePose] = useState<RealPresencePose>(() => ({ ...EMPTY_REAL_PRESENCE_POSE }));
  const [faceLandmarks, setFaceLandmarks] = useState<FaceLandmarkPoint[]>([]);
  const [faceActionUnits, setFaceActionUnits] = useState<Record<string, number>>({});
  const [microTelemetry, setMicroTelemetry] = useState({ kind: 'none', confidence: 0, durationMs: 0 });
  const [postureTelemetry, setPostureTelemetry] = useState({
    present: false, label: 'unknown', confidence: 0, upright: 0, slump: 0, lean: 0, motion: 0,
  });
  const [poseLandmarks, setPoseLandmarks] = useState<PoseSkeletonPoint[]>([]);
  const [pulseTelemetry, setPulseTelemetry] = useState({
    status: 'off', bpmTrend: 0, quality: 0, relativeActivation: 0, sampleCount: 0,
  });
  const [visionPerformanceTelemetry, setVisionPerformanceTelemetry] = useState({
    engine: 'legacy', delegate: 'unknown', tier: 'balanced', inferenceMs: 0, intervalMs: 60,
    fps: 0, landmarkCount: 0, processedFrames: 0, droppedFrames: 0,
    postprocess: 'main', postprocessMs: 0,
  });
  const [environmentTelemetry, setEnvironmentTelemetry] = useState({
    active: false,
    status: 'off',
    delegate: 'unknown',
    inferenceMs: 0,
    intervalMs: 0,
    processedFrames: 0,
    objects: [] as TrackedObject[],
    environment: { ...EMPTY_ENVIRONMENT },
  });
  const [faceRuntimeTelemetry, setFaceRuntimeTelemetry] = useState({
    status: 'scanning',
    landmarkCount: 0,
    blendshapesReady: false,
    lastSeenAt: 0,
  });
  const [sceneGraphTelemetry, setSceneGraphTelemetry] = useState<SpatialSceneGraph>(() => ({ ...EMPTY_SPATIAL_SCENE }));
  const sceneGraphTrackerRef = useRef(new SpatialSceneGraphTracker());
  const [faceAffect, setFaceAffect] = useState<AffectState>(() => neutralAffect());
  const affectTrackerRef = useRef(new AffectTracker());
  const [interactionTelemetry, setInteractionTelemetry] = useState<InteractionContext>(() => ({ ...EMPTY_INTERACTION }));
  const interactionTrackerRef = useRef(new InteractionTracker());
  const [behaviorEvents, setBehaviorEvents] = useState<BehaviorEvent[]>([]);
  const behaviorTimelineRef = useRef(new BehaviorTimeline());
  const gazeHeadCalibratorRef = useRef(new GazeHeadCalibrator());
  const [calibrationTelemetry, setCalibrationTelemetry] = useState(() => gazeHeadCalibratorRef.current.snapshot());
  const gestureIntentTrackerRef = useRef(new GestureIntentTracker());
  const [gestureIntentTelemetry, setGestureIntentTelemetry] = useState<GestureIntentState>({
    eventId: 0, intent: 'none', gesture: 'None', confidence: 0, stableMs: 0, at: 0,
  });
  const lastGestureIntentIdRef = useRef(0);
  const [faceTelemetry, setFaceTelemetry] = useState({
    smile: 0, frown: 0, jaw: 0, browUp: 0, browDown: 0,
    gazeX: 0, gazeY: 0, headGesture: 'none', faceGesture: 'none', faceGestureConfidence: 0,
    muscles: { brow: 0, eyes: 0, cheeks: 0, mouth: 0, jaw: 0 },
  });
  const [handSeen, setHandSeen] = useState(false);
  const [gestureName, setGestureName] = useState('None');
  const [gestureScore, setGestureScore] = useState(0);
  const [handPoint, setHandPoint] = useState({ x: 0.5, y: 0.5 });
  const [waveSeen, setWaveSeen] = useState(false);
  const [handLandmarks, setHandLandmarks] = useState<HandLandmarkPoint[]>([]);
  const [spatialHands, setSpatialHands] = useState<SpatialHand[]>([]);
  const [airPoint, setAirPoint] = useState({ x: 0.5, y: 0.5 });
  const smoothAirRef = useRef({ x: 0.5, y: 0.5 });
  const [pinching, setPinching] = useState(false);
  const [airTargetLabel, setAirTargetLabel] = useState('');
  const [airFeedback, setAirFeedback] = useState('');
  const pinchWasDownRef = useRef(false);
  const palmHoldSinceRef = useRef(0);
  const victoryLatchRef = useRef(false);
  const lastAirActionRef = useRef(0);
  const palmSwipeRef = useRef({ x: 0.5, at: 0 });
  const [grabActive, setGrabActive] = useState(false);
  const [grabOffset, setGrabOffset] = useState({ x: 0, y: 0 });
  const grabStartRef = useRef({ pointerX: 0, pointerY: 0, offsetX: 0, offsetY: 0 });
  const lastGrabPinchRef = useRef(0);
  const [surfaceTransform, setSurfaceTransform] = useState({ scale: 1, rotation: 0 });
  const [spatialTransformActive, setSpatialTransformActive] = useState(false);
  const transformSessionRef = useRef({
    active: false,
    readySince: 0,
    startDistance: 0,
    startAngle: 0,
    baseScale: 1,
    baseRotation: 0,
  });

  useDialogFocus(settingsOpen, '.v2-settings');

  useEffect(() => {
    document.body.dataset.state = mira.state;
    document.body.dataset.theme = theme;
  }, [mira.state, theme]);

  useEffect(() => {
    try { localStorage.setItem('mira.theme', theme); } catch { /* noop */ }
  }, [theme]);

  const loadVisionModules = useCallback(async () => {
    if (visionModulesRef.current) return visionModulesRef.current;
    const runtime = await import('../presence/vision-runtime');
    visionModulesRef.current = runtime;
    return runtime;
  }, []);

  const stopVision = useCallback(async () => {
    const modules = visionModulesRef.current;
    modules?.stopVision();
    if (cameraPreviewRef.current) cameraPreviewRef.current.srcObject = null;
    setVisionMediaStream(null);
    setVisionOn(false);
    setFaceSeen(false);
    setRealPresencePose({ ...EMPTY_REAL_PRESENCE_POSE });
    setFaceLandmarks([]);
    setFaceActionUnits({});
    setMicroTelemetry({ kind: 'none', confidence: 0, durationMs: 0 });
    setPostureTelemetry({ present: false, label: 'unknown', confidence: 0, upright: 0, slump: 0, lean: 0, motion: 0 });
    setPoseLandmarks([]);
    setPulseTelemetry({ status: 'off', bpmTrend: 0, quality: 0, relativeActivation: 0, sampleCount: 0 });
    setVisionPerformanceTelemetry({
      engine: 'legacy', delegate: 'unknown', tier: 'balanced', inferenceMs: 0, intervalMs: 60,
      fps: 0, landmarkCount: 0, processedFrames: 0, droppedFrames: 0,
      postprocess: 'main', postprocessMs: 0,
    });
    setEnvironmentTelemetry({
      active: false,
      status: 'off',
      delegate: 'unknown',
      inferenceMs: 0,
      intervalMs: 0,
      processedFrames: 0,
      objects: [],
      environment: { ...EMPTY_ENVIRONMENT },
    });
    setFaceRuntimeTelemetry({
      status: 'scanning',
      landmarkCount: 0,
      blendshapesReady: false,
      lastSeenAt: 0,
    });
    sceneGraphTrackerRef.current.reset();
    setSceneGraphTelemetry({ ...EMPTY_SPATIAL_SCENE });
    setCalibrationTelemetry(gazeHeadCalibratorRef.current.snapshot());
    gestureIntentTrackerRef.current.reset();
    setGestureIntentTelemetry({
      eventId: 0, intent: 'none', gesture: 'None', confidence: 0, stableMs: 0, at: 0,
    });
    lastGestureIntentIdRef.current = 0;
    setInteractionTelemetry({ ...EMPTY_INTERACTION });
    interactionTrackerRef.current.reset();
    setBehaviorEvents([]);
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
    setHandSeen(false);
    setGestureName('None');
    setGestureScore(0);
    setWaveSeen(false);
    setHandLandmarks([]);
    setSpatialHands([]);
    smoothAirRef.current = { x: 0.5, y: 0.5 };
    setPinching(false);
    setAirTargetLabel('');
    setAirFeedback('');
    pinchWasDownRef.current = false;
    palmHoldSinceRef.current = 0;
    victoryLatchRef.current = false;
    palmSwipeRef.current = { x: 0.5, at: 0 };
    setGrabActive(false);
    setSpatialTransformActive(false);
    transformSessionRef.current = {
      active: false,
      readySince: 0,
      startDistance: 0,
      startAngle: 0,
      baseScale: surfaceTransform.scale,
      baseRotation: surfaceTransform.rotation,
    };
  }, [mira.observeAffect, surfaceTransform.rotation, surfaceTransform.scale]);

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
      setVisionMediaStream(on ? stream : null);
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
      const face = snapshot?.face;
      setFaceLandmarks(Array.isArray(face?.landmarks) ? face.landmarks : []);
      setFaceActionUnits(face?.actionUnits || {});
      const micro = face?.microExpression || { kind: 'none', confidence: 0, durationMs: 0 };
      setMicroTelemetry({
        kind: String(micro.kind || 'none'),
        confidence: Number(micro.confidence || 0),
        durationMs: Number(micro.durationMs || 0),
      });
      const posture = snapshot?.posture || {
        present: false, label: 'unknown', confidence: 0, upright: 0, slump: 0, lean: 0, motion: 0, landmarks: [],
      };
      setPostureTelemetry({
        present: Boolean(posture.present),
        label: String(posture.label || 'unknown'),
        confidence: Number(posture.confidence || 0),
        upright: Number(posture.upright || 0),
        slump: Number(posture.slump || 0),
        lean: Number(posture.lean || 0),
        motion: Number(posture.motion || 0),
      });
      setPoseLandmarks(Array.isArray(posture.landmarks) ? posture.landmarks : []);
      const pulse = snapshot?.rppg || {
        status: 'off', bpmTrend: 0, quality: 0, relativeActivation: 0, sampleCount: 0,
      };
      setPulseTelemetry({
        status: String(pulse.status || 'off'),
        bpmTrend: Number(pulse.bpmTrend || 0),
        quality: Number(pulse.quality || 0),
        relativeActivation: Number(pulse.relativeActivation || 0),
        sampleCount: Number(pulse.sampleCount || 0),
      });
      const perf = snapshot?.visionPerformance;
      setVisionPerformanceTelemetry({
        engine: String(perf?.engine || snapshot?.visionEngine || 'legacy'),
        delegate: String(perf?.delegate || 'unknown'),
        tier: String(perf?.tier || 'balanced'),
        inferenceMs: Number(perf?.inferenceMs || 0),
        intervalMs: Number(perf?.intervalMs || 0),
        fps: Number(perf?.fps || 0),
        landmarkCount: Number(perf?.landmarkCount || 0),
        processedFrames: Number(perf?.processedFrames || 0),
        droppedFrames: Number(perf?.droppedFrames || 0),
        postprocess: String(perf?.postprocess || 'main'),
        postprocessMs: Number(perf?.postprocessMs || 0),
      });
      const environmentSensor = snapshot?.environment;
      const environmentContext = environmentSensor?.environment || { ...EMPTY_ENVIRONMENT };
      const environmentObjects = Array.isArray(environmentSensor?.objects) ? environmentSensor.objects : [];
      setEnvironmentTelemetry({
        active: Boolean(environmentSensor?.active),
        status: String(environmentSensor?.status || 'off'),
        delegate: String(environmentSensor?.delegate || 'unknown'),
        inferenceMs: Number(environmentSensor?.inferenceMs || 0),
        intervalMs: Number(environmentSensor?.intervalMs || 0),
        processedFrames: Number(environmentSensor?.processedFrames || 0),
        objects: environmentObjects,
        environment: environmentContext,
      });
      const faceRuntime = snapshot?.faceRuntime;
      setFaceRuntimeTelemetry({
        status: String(faceRuntime?.status || 'scanning'),
        landmarkCount: Number(faceRuntime?.landmarkCount || 0),
        blendshapesReady: Boolean(faceRuntime?.blendshapesReady),
        lastSeenAt: Number(faceRuntime?.lastSeenAt || 0),
      });
      setRealPresencePose(face?.spatialPose || { ...EMPTY_REAL_PRESENCE_POSE });
      const now = performance.now();
      const spatial = face?.spatialPose || { ...EMPTY_REAL_PRESENCE_POSE };
      const faceConfidence = Math.max(Number(spatial.confidence || 0), face?.present ? 0.65 : 0);
      const calibration = gazeHeadCalibratorRef.current.observe({
        facePresent: Boolean(face?.present),
        confidence: faceConfidence,
        gazeX: Number(face?.gazeX || 0),
        gazeY: Number(face?.gazeY || 0),
        yaw: Number(face?.yaw || 0),
        pitch: Number(face?.pitch || 0),
        motion: Number(posture.motion || 0),
      });
      setCalibrationTelemetry(calibration);
      const calibrated = gazeHeadCalibratorRef.current.apply({
        gazeX: Number(face?.gazeX || 0),
        gazeY: Number(face?.gazeY || 0),
        yaw: Number(face?.yaw || 0),
        pitch: Number(face?.pitch || 0),
      });
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
      setGestureIntentTelemetry(intent);

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
      setSceneGraphTelemetry(sceneGraph);

      const recentBehavior = behaviorTimelineRef.current.observe({
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
      }, now);
      setBehaviorEvents(recentBehavior);

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
        behaviorTimelineRef.current.promptSummary(now),
        environmentPrompt(environmentContext),
        spatialScenePrompt(sceneGraph, now),
      ]
        .filter(Boolean)
        .join(' ');
      if (socialContext) nextAffect.promptContext = nextAffect.promptContext + ' ' + socialContext;
      setFaceAffect(nextAffect);
      mira.observeAffect(nextAffect);
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
      setHandSeen(Boolean(snapshot?.handSeen));
      setGestureName(snapshot?.gesture || 'None');
      setGestureScore(Number(snapshot?.gestureScore || 0));
      setWaveSeen(Boolean(snapshot?.wave));
      setHandLandmarks(Array.isArray(snapshot?.landmarks) ? snapshot.landmarks : []);
      setSpatialHands(Array.isArray(snapshot?.hands) ? snapshot.hands as SpatialHand[] : []);
      setPinching(Boolean(snapshot?.pinching));
      if (snapshot?.handSeen) {
        const rawX = Math.max(0.03, Math.min(0.97, Number(snapshot.pointerX ?? 0.5)));
        const rawY = Math.max(0.04, Math.min(0.96, Number(snapshot.pointerY ?? 0.5)));
        const alpha = window.innerWidth <= 760 ? 0.28 : 0.36;
        const nextPoint = {
          x: smoothValue(smoothAirRef.current.x, rawX, alpha),
          y: smoothValue(smoothAirRef.current.y, rawY, alpha),
        };
        smoothAirRef.current = nextPoint;
        setAirPoint(nextPoint);
        setHandPoint({
          x: Math.max(0, Math.min(1, Number(snapshot.handX ?? 0.5))),
          y: Math.max(0, Math.min(1, Number(snapshot.handY ?? 0.5))),
        });
      }
    }, 120);
    return () => window.clearInterval(timer);
  }, [mira.observeAffect, visionOn]);

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

  const resolveAirTarget = useCallback((x: number, y: number): HTMLElement | null => {
    const candidates = Array.from(document.querySelectorAll<HTMLElement>('[data-air-action="safe"]'))
      .filter((element) => !element.hasAttribute('disabled') && element.offsetParent !== null);
    let winner: HTMLElement | null = null;
    let bestDistance = 78;

    for (const element of candidates) {
      const rect = element.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const distance = Math.hypot(cx - x, cy - y);
      if (distance < bestDistance) {
        bestDistance = distance;
        winner = element;
      }
    }
    return winner;
  }, []);

  useEffect(() => {
    const session = transformSessionRef.current;
    const twoHands = spatialHands.slice(0, 2);
    const bothOpen =
      twoHands.length === 2 &&
      twoHands.every((hand) => hand.gesture === 'Open_Palm' && hand.score >= 0.48);

    if (!visionOn || settingsOpen || !mira.content || grabActive || !bothOpen) {
      session.readySince = 0;
      if (session.active) {
        session.active = false;
        setSpatialTransformActive(false);
      }
      return;
    }

    const geometry = measureTwoHands(twoHands[0], twoHands[1]);
    const now = performance.now();

    if (!session.readySince) session.readySince = now;
    if (!session.active) {
      if (now - session.readySince < 260 || geometry.distance < 0.12) return;
      session.active = true;
      session.startDistance = geometry.distance;
      session.startAngle = geometry.angleDeg;
      session.baseScale = surfaceTransform.scale;
      session.baseRotation = surfaceTransform.rotation;
      setSpatialTransformActive(true);
      setAirFeedback('✦ Spatial Transform · 2 tay');
      window.setTimeout(() => setAirFeedback(''), 850);
      return;
    }

    const targetScale = scaleFromDistance(
      session.baseScale,
      session.startDistance,
      geometry.distance,
      0.72,
      1.55,
    );
    const targetRotation = rotationFromAngles(
      session.baseRotation,
      session.startAngle,
      geometry.angleDeg,
      -24,
      24,
    );

    setSurfaceTransform((previous) => ({
      scale: smoothValue(previous.scale, targetScale, 0.24),
      rotation: smoothValue(previous.rotation, targetRotation, 0.2),
    }));
  }, [
    grabActive,
    mira.content,
    settingsOpen,
    spatialHands,
    surfaceTransform.rotation,
    surfaceTransform.scale,
    visionOn,
  ]);

  useEffect(() => {
    if (!visionOn || !handSeen || settingsOpen || spatialTransformActive || spatialHands.length >= 2) {
      setAirTargetLabel('');
      pinchWasDownRef.current = false;
      palmHoldSinceRef.current = 0;
      victoryLatchRef.current = false;
      palmSwipeRef.current = { x: airPoint.x, at: 0 };
      return;
    }

    const x = airPoint.x * window.innerWidth;
    const y = airPoint.y * window.innerHeight;
    const target = resolveAirTarget(x, y);
    const hit = document.elementFromPoint(x, y) as HTMLElement | null;
    const grabTarget = hit?.closest<HTMLElement>('[data-air-grab]') || null;
    setAirTargetLabel(grabActive ? 'Đang giữ Result Surface' : (grabTarget ? 'Nắm Result Surface' : (target?.dataset.airLabel || '')));

    const now = Date.now();
    const freshAction = now - lastAirActionRef.current > 900;
    const intentIsNew = gestureIntentTelemetry.eventId > lastGestureIntentIdRef.current;
    const currentIntent = intentIsNew ? gestureIntentTelemetry.intent : 'none';
    if (intentIsNew) lastGestureIntentIdRef.current = gestureIntentTelemetry.eventId;
    const pinchDown = currentIntent === 'pinch_down';
    const pinchUp = currentIntent === 'pinch_up';

    if (pinchDown && grabTarget) {
      if (now - lastGrabPinchRef.current < 520) {
        setGrabOffset({ x: 0, y: 0 });
        setSurfaceTransform({ scale: 1, rotation: 0 });
        setGrabActive(false);
        setAirFeedback('↺ Result Surface · về vị trí cũ');
        window.setTimeout(() => setAirFeedback(''), 900);
        lastGrabPinchRef.current = 0;
      } else {
        lastGrabPinchRef.current = now;
        grabStartRef.current = {
          pointerX: x,
          pointerY: y,
          offsetX: grabOffset.x,
          offsetY: grabOffset.y,
        };
        setGrabActive(true);
        setAirFeedback('🤏 Đã nắm Result Surface');
        window.setTimeout(() => setAirFeedback(''), 700);
      }
    } else if (pinchDown && target && freshAction && !grabActive) {
      target.click();
      lastAirActionRef.current = now;
      setAirFeedback(`Pinch · ${target.dataset.airLabel || 'Đã chọn'}`);
      window.setTimeout(() => setAirFeedback(''), 900);
    }

    if (pinching && grabActive) {
      const dx = x - grabStartRef.current.pointerX;
      const dy = y - grabStartRef.current.pointerY;
      const limitX = window.innerWidth * 0.52;
      const limitY = window.innerHeight * 0.46;
      setGrabOffset({
        x: Math.max(-limitX, Math.min(limitX, grabStartRef.current.offsetX + dx)),
        y: Math.max(-limitY, Math.min(limitY, grabStartRef.current.offsetY + dy)),
      });
    }

    if (pinchUp && grabActive) {
      setGrabActive(false);
      lastAirActionRef.current = now;
      setAirFeedback('✦ Đã thả Result Surface');
      window.setTimeout(() => setAirFeedback(''), 800);
    }
    pinchWasDownRef.current = pinching;

    if (gestureName === 'Open_Palm' && gestureScore >= 0.58) {
      if (!palmHoldSinceRef.current) {
        palmHoldSinceRef.current = now;
        palmSwipeRef.current = { x: airPoint.x, at: now };
      }

      const held = now - palmHoldSinceRef.current;
      const swipeAge = now - palmSwipeRef.current.at;
      const swipeDelta = airPoint.x - palmSwipeRef.current.x;

      if (swipeAge <= 620 && Math.abs(swipeDelta) >= 0.22 && freshAction) {
        cycleTheme();
        lastAirActionRef.current = now;
        palmHoldSinceRef.current = 0;
        palmSwipeRef.current = { x: airPoint.x, at: now };
        setAirFeedback(swipeDelta > 0 ? '→ Đổi theme' : '← Đổi theme');
        window.setTimeout(() => setAirFeedback(''), 900);
      } else if (currentIntent === 'open_palm_hold' && freshAction && (mira.stateRef.current === 'speaking' || mira.stateRef.current === 'thinking')) {
        mira.interrupt();
        lastAirActionRef.current = now;
        palmHoldSinceRef.current = 0;
        setAirFeedback('✋ Hold confirmed · Mira đã dừng');
        window.setTimeout(() => setAirFeedback(''), 900);
      }
    } else {
      palmHoldSinceRef.current = 0;
      palmSwipeRef.current = { x: airPoint.x, at: 0 };
    }

    if (currentIntent === 'victory_hold' && freshAction) {
      mira.unlockAudio();
      setVoiceReady(true);
      mira.toggleLive();
      lastAirActionRef.current = now;
      setAirFeedback(mira.live ? '✌ Hold confirmed · Live voice tắt' : '✌ Hold confirmed · Live voice bật');
      window.setTimeout(() => setAirFeedback(''), 900);
    }

    if (currentIntent === 'fist_hold' && freshAction && mira.content && !grabActive) {
      mira.clearContent();
      lastAirActionRef.current = now;
      setAirFeedback('✊ Hold confirmed · đóng Result Surface');
      window.setTimeout(() => setAirFeedback(''), 900);
    }
  }, [airPoint, gestureIntentTelemetry, gestureName, gestureScore, grabActive, grabOffset.x, grabOffset.y, handSeen, mira.clearContent, mira.content, mira.interrupt, mira.live, mira.stateRef, mira.toggleLive, mira.unlockAudio, pinching, resolveAirTarget, settingsOpen, spatialHands.length, spatialTransformActive, visionOn]);

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

  const facialGestureLabel = ({
    smile: 'Cười',
    frown: 'Nhíu môi',
    wink_left: 'Nháy mắt trái',
    wink_right: 'Nháy mắt phải',
    brow_raise: 'Nhướn mày',
    mouth_open: 'Há miệng',
    squint: 'Nheo mắt',
    none: 'Không có cử chỉ',
  } as Record<string, string>)[faceTelemetry.faceGesture] || faceTelemetry.faceGesture;

  const microLabel = ({
    smile_flash: 'Smile flash',
    brow_flash: 'Brow flash',
    lip_press_flash: 'Lip press',
    surprise_flash: 'Surprise flash',
    tension_flash: 'Tension flash',
    blink_burst: 'Blink burst',
    none: 'Không có micro-expression',
  } as Record<string, string>)[microTelemetry.kind] || microTelemetry.kind;

  const postureLabel = ({
    upright: 'Thẳng',
    slouched: 'Cúi / co người',
    lean_left: 'Nghiêng trái',
    lean_right: 'Nghiêng phải',
    moving: 'Đang chuyển động',
    unknown: 'Chưa đủ khung người',
  } as Record<string, string>)[postureTelemetry.label] || postureTelemetry.label;

  const pulseLabel = pulseTelemetry.bpmTrend > 0 && pulseTelemetry.quality >= 0.22
    ? `~${Math.round(pulseTelemetry.bpmTrend)} · Q${Math.round(pulseTelemetry.quality * 100)}%`
    : pulseTelemetry.status === 'calibrating'
      ? 'Đang hiệu chỉnh'
      : pulseTelemetry.status === 'low_signal'
        ? 'Tín hiệu thấp'
        : 'Chờ tín hiệu';

  const visionEngineLabel = visionPerformanceTelemetry.engine === 'holistic'
    ? 'HOLISTIC · 553'
    : 'LEGACY VISION';

  const visionPerfLabel = visionPerformanceTelemetry.processedFrames > 0
    ? `${Math.round(visionPerformanceTelemetry.fps)} fps · ${Math.round(visionPerformanceTelemetry.inferenceMs)} ms · ${visionPerformanceTelemetry.delegate}`
    : 'Đang khởi động';

  const visionPostprocessLabel = visionPerformanceTelemetry.postprocess === 'worker'
    ? `WORKER ${Math.round(visionPerformanceTelemetry.postprocessMs)}ms`
    : 'MAIN';

  const faceRuntimeLabel = faceRuntimeTelemetry.status === 'full'
    ? `FACE FULL · ${faceRuntimeTelemetry.landmarkCount}`
    : faceRuntimeTelemetry.status === 'mesh_only'
      ? `FACE MESH · ${faceRuntimeTelemetry.landmarkCount}`
      : 'FACE SCAN';

  const calibrationLabel = calibrationTelemetry.ready
    ? 'CAL READY'
    : `CAL ${Math.round(calibrationTelemetry.progress * 100)}%`;

  const intentLabel = gestureIntentTelemetry.intent === 'none'
    ? 'Intent chờ'
    : gestureIntentTelemetry.intent.replaceAll('_', ' ');

  const environmentLabel = ({
    workspace: 'Khu vực làm việc',
    rest_area: 'Khu vực nghỉ',
    living_area: 'Khu vực sinh hoạt',
    dining_area: 'Khu vực ăn/uống',
    person_nearby: 'Có thêm người',
    mixed: 'Không gian pha trộn',
    unknown: 'Chưa xác định',
  } as Record<string, string>)[environmentTelemetry.environment.label] || environmentTelemetry.environment.label;

  const environmentStatusLabel = environmentTelemetry.status === 'loading'
    ? 'Đang nạp model'
    : environmentTelemetry.status === 'tracking'
      ? `${environmentTelemetry.objects.filter((object) => object.stable).length} object · ${Math.round(environmentTelemetry.inferenceMs)} ms`
      : environmentTelemetry.status === 'low_signal'
        ? 'Đang quét'
        : environmentTelemetry.status === 'error'
          ? 'Object model lỗi'
          : 'Chưa bật';

  const spatialRelationText = (relation: SpatialRelation) => {
    const from = sceneGraphTelemetry.nodes.find((node) => node.id === relation.from)?.label || 'object';
    const toNode = sceneGraphTelemetry.nodes.find((node) => node.id === relation.to);
    const to = toNode?.kind === 'person' ? 'person' : (toNode?.label || 'object');
    const relationLabel = ({
      left_of: 'trái',
      right_of: 'phải',
      above: 'trên',
      below: 'dưới',
      near: 'gần',
      overlaps: 'chồng vùng',
    } as Record<SpatialRelation['type'], string>)[relation.type];
    return `${from} · ${relationLabel} · ${to}`;
  };

  const spatialFocusLabel = sceneGraphTelemetry.focus
    ? `${sceneGraphTelemetry.focus.label} ${Math.round(sceneGraphTelemetry.focus.confidence * 100)}%`
    : sceneGraphTelemetry.pointerActive
      ? 'Đang tìm target'
      : 'Chưa trỏ vật thể';

  const interactionLabel = ({
    focused: 'Đang tập trung',
    engaged: 'Đang tương tác',
    looking_away: 'Đang nhìn lệch',
    returning: 'Vừa quay lại',
    absent: 'Ngoài khung',
    uncertain: 'Đang hiệu chỉnh',
  } as Record<string, string>)[interactionTelemetry.state] || interactionTelemetry.state;

  const behaviorLabel = (event: BehaviorEvent) => {
    if (event.label.startsWith('target:')) return 'Target ' + event.label.slice('target:'.length);
    return ({
    focused: 'Focus',
    engaged: 'Engaged',
    looking_away: 'Look away',
    returning: 'Return',
    absent: 'Away',
    upright: 'Upright',
    slouched: 'Slouch',
    lean_left: 'Lean L',
    lean_right: 'Lean R',
    moving: 'Moving',
    near: 'Near',
    conversation: 'Conversation',
    far: 'Far',
    workspace: 'Workspace',
    rest_area: 'Rest area',
    living_area: 'Living',
    dining_area: 'Dining',
    person_nearby: 'People',
    mixed: 'Mixed scene',
  } as Record<string, string>)[event.label] || event.label.replaceAll('_', ' ');
  };

  const gestureLabel = waveSeen ? 'Wave' : ({
    Open_Palm: 'Open Palm',
    Closed_Fist: 'Closed Fist',
    Thumb_Up: 'Thumb Up',
    Thumb_Down: 'Thumb Down',
    Victory: 'Victory',
    Pointing_Up: 'Pointing Up',
    ILoveYou: 'I Love You',
    None: 'No gesture',
  } as Record<string, string>)[gestureName] || gestureName;

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
          >
            {visionOn ? <IconCameraOff /> : <IconCamera />}
            <span className="sr-only">{visionOn ? 'Tắt camera nhận diện' : 'Bật camera nhận diện'}</span>
          </button>
          <button type="button" data-air-action="safe" data-air-label="Đổi theme" onClick={cycleTheme} title="Đổi màu"><span className="v2-theme-dot" aria-hidden="true" /><span className="sr-only">Đổi màu</span></button>
          <button type="button" data-air-action="safe" data-air-label="Cài đặt" onClick={() => setSettingsOpen(true)} title="Cài đặt"><IconSettings /><span className="sr-only">Mở cài đặt</span></button>
        </nav>
      </header>

      {(mira.error || visionError) && <div className="v2-error" role="alert">{visionError || mira.error}</div>}

      {visionOn && (
        <div className="v2-vision-monitor" aria-live="polite">
          <div className="v2-camera-frame">
            <video ref={cameraPreviewRef} className="v2-camera-preview" autoPlay muted playsInline aria-label="Camera preview" />
            <div className="v2-camera-status">
              <span className={faceSeen ? 'detected' : ''}>Face</span>
              <span className={handSeen ? 'detected' : ''}>Hand</span>
              <span className={faceSeen && faceAffect.mood !== 'neutral' ? 'detected' : ''}>{moodLabel}</span>
              <span className={faceSeen && realPresencePose.confidence >= 0.55 ? 'detected' : ''}>REAL</span>
              <span className={environmentTelemetry.environment.confidence >= 0.48 ? 'detected' : ''}>ENV</span>
            </div>
            {faceSeen && (
              <FaceMeshOverlay
                points={faceLandmarks}
                active={faceSeen}
                muscles={faceTelemetry.muscles}
              />
            )}
            {postureTelemetry.present && (
              <PoseSkeletonOverlay points={poseLandmarks} active={postureTelemetry.present} />
            )}
            <ObjectAwarenessOverlay
              objects={environmentTelemetry.objects}
              active={environmentTelemetry.active}
              selectedId={sceneGraphTelemetry.focus?.id}
            />
            <SpatialSceneOverlay
              graph={sceneGraphTelemetry}
              pointer={airPoint}
              active={visionOn && Boolean(sceneGraphTelemetry.focus)}
            />
            {handSeen && (
              <>
                {(spatialHands.length ? spatialHands : [{ landmarks: handLandmarks } as SpatialHand]).map((hand, index) => (
                  <HandSkeletonOverlay key={`${hand.handedness || 'hand'}-${index}`} points={hand.landmarks} active={handSeen} />
                ))}
                <span
                  className={`v2-hand-point${waveSeen ? ' wave' : ''}`}
                  style={{ left: `${(1 - handPoint.x) * 100}%`, top: `${handPoint.y * 100}%` }}
                  aria-hidden="true"
                />
                <div className={`v2-gesture-overlay${waveSeen ? ' wave' : ''}`}>
                  <b>{gestureLabel}</b>
                  <span>{Math.round(gestureScore * 100)}%</span>
                </div>
              </>
            )}
            {!handSeen && <div className="v2-gesture-hint">{faceSeen ? 'Đưa tay vào khung để điều khiển' : 'Đưa khuôn mặt vào khung'}</div>}
          </div>
          <div className="v2-face-panel">
            <div className="v2-face-panel-head">
              <span><small>AFFECT</small><b>{moodLabel}</b></span>
              <em>{Math.round(faceAffect.confidence * 100)}%</em>
            </div>
            <div className="v2-face-bars" aria-hidden="true">
              <i style={{ '--level': faceTelemetry.muscles.brow } as CSSProperties}><span>Brow</span></i>
              <i style={{ '--level': faceTelemetry.muscles.eyes } as CSSProperties}><span>Eyes</span></i>
              <i style={{ '--level': faceTelemetry.muscles.cheeks } as CSSProperties}><span>Cheek</span></i>
              <i style={{ '--level': faceTelemetry.muscles.mouth } as CSSProperties}><span>Mouth</span></i>
              <i style={{ '--level': faceTelemetry.muscles.jaw } as CSSProperties}><span>Jaw</span></i>
            </div>
            <div className="v2-affect-vector" aria-label="Affect vector">
              <span><small>VAL</small><b>{faceAffect.dimensions.valence >= 0 ? '+' : ''}{faceAffect.dimensions.valence.toFixed(2)}</b></span>
              <span><small>ARO</small><b>{Math.round(faceAffect.dimensions.arousal * 100)}</b></span>
              <span><small>ENG</small><b>{Math.round(faceAffect.dimensions.engagement * 100)}</b></span>
              <span><small>FAT</small><b>{Math.round(faceAffect.dimensions.fatigue * 100)}</b></span>
              <span><small>TEN</small><b>{Math.round(faceAffect.dimensions.tension * 100)}</b></span>
            </div>
            <div className="v2-vision-engine">
              <span><small>VISION</small><b>{visionEngineLabel}</b></span>
              <em>{visionPerfLabel}</em>
              <i title="Landmark count">{Math.round(visionPerformanceTelemetry.landmarkCount)} pts · {visionPerformanceTelemetry.tier} · {visionPostprocessLabel}</i>
              <strong className={faceRuntimeTelemetry.status === 'full' ? 'face-full' : faceRuntimeTelemetry.status === 'mesh_only' ? 'face-mesh' : ''}>
                {faceRuntimeLabel}
              </strong>
            </div>
            <div className={`v2-environment-awareness env-${environmentTelemetry.environment.label}`}>
              <div className="v2-environment-head">
                <span><small>ENVIRONMENT</small><b>{environmentLabel}</b></span>
                <em>{environmentTelemetry.environment.confidence >= 0.01 ? Math.round(environmentTelemetry.environment.confidence * 100) + '%' : '—'}</em>
              </div>
              <div className="v2-environment-meta">
                <span>{environmentStatusLabel}</span>
                <span>{environmentTelemetry.delegate}</span>
                <span>{environmentTelemetry.intervalMs ? Math.round(environmentTelemetry.intervalMs) + ' ms cadence' : 'cadence —'}</span>
              </div>
              {environmentTelemetry.objects.some((object) => object.stable && object.score >= 0.4) && (
                <div className="v2-environment-objects">
                  {environmentTelemetry.objects
                    .filter((object) => object.stable && object.score >= 0.4)
                    .slice(0, 6)
                    .map((object) => (
                      <span key={object.id}>{object.label} {Math.round(object.score * 100)}%</span>
                    ))}
                </div>
              )}
              <small className="v2-environment-note">Object/scene context chạy local, không nhận dạng danh tính và không lưu ảnh camera.</small>
            </div>
            <div className={`v2-spatial-scene${sceneGraphTelemetry.focus ? ' has-focus' : ''}`}>
              <div className="v2-spatial-scene-head">
                <span><small>SPATIAL GRAPH</small><b>{spatialFocusLabel}</b></span>
                <em>{sceneGraphTelemetry.nodes.length}N · {sceneGraphTelemetry.relations.length}R</em>
              </div>
              {sceneGraphTelemetry.relations.length > 0 && (
                <div className="v2-spatial-relations">
                  {sceneGraphTelemetry.relations.slice(0, 4).map((relation, index) => (
                    <span key={`${relation.from}-${relation.to}-${relation.type}-${index}`}>
                      {spatialRelationText(relation)}
                    </span>
                  ))}
                </div>
              )}
              {sceneGraphTelemetry.events.length > 0 && (
                <div className="v2-spatial-events">
                  {sceneGraphTelemetry.events.slice(-3).map((event) => (
                    <span key={event.id}>
                      {event.type.replaceAll('_', ' ')} · {event.label}
                      {event.distance ? ` · ${Math.round(event.distance * 100)}%` : ''}
                    </span>
                  ))}
                </div>
              )}
              <small className="v2-spatial-note">Quan hệ là hình học 2D trên camera; target chỉ được khóa sau khi trỏ ổn định.</small>
            </div>
            <div className="v2-sensor-strip">
              <span className={microTelemetry.kind !== 'none' ? 'active' : ''}><small>MICRO</small><b>{microLabel}</b></span>
              <span className={postureTelemetry.present ? 'active' : ''}><small>POSE</small><b>{postureLabel}</b></span>
              <span className={pulseTelemetry.quality >= 0.5 ? 'active' : ''}><small>rPPG*</small><b>{pulseLabel}</b></span>
            </div>
            <div className="v2-fusion-channels" aria-label="Multimodal fusion confidence">
              <span>FACE {Math.round(faceAffect.channels.face * 100)}</span>
              <span>VOICE {Math.round(faceAffect.channels.voice * 100)}</span>
              <span>BODY {Math.round(faceAffect.channels.posture * 100)}</span>
              <span>PULSE {Math.round(faceAffect.channels.physiology * 100)}</span>
            </div>
            <div className={`v2-social-awareness state-${interactionTelemetry.state}`}>
              <div className="v2-social-head">
                <span><small>SOCIAL</small><b>{interactionLabel}</b></span>
                <em>{Math.round(interactionTelemetry.attention * 100)}%</em>
              </div>
              <div className="v2-social-bars" aria-label="Social attention proxy">
                <span><small>ATT</small><i><b style={{ '--social-level': interactionTelemetry.attention } as CSSProperties} /></i></span>
                <span><small>EYE*</small><i><b style={{ '--social-level': interactionTelemetry.eyeContact } as CSSProperties} /></i></span>
                <span><small>HEAD</small><i><b style={{ '--social-level': interactionTelemetry.headAlignment } as CSSProperties} /></i></span>
              </div>
              {behaviorEvents.length > 0 && (
                <div className="v2-behavior-timeline" aria-label="Recent observed behavior">
                  {behaviorEvents.slice(-5).map((event) => (
                    <span key={event.id} data-kind={event.type}>{behaviorLabel(event)}</span>
                  ))}
                </div>
              )}
              <div className="v2-social-calibration">
                <span>{calibrationLabel}</span>
                <span>{intentLabel}</span>
              </div>
              <small className="v2-social-note">* Eye contact là gaze proxy đã hiệu chỉnh theo baseline local, không phải xác nhận chú ý hay ý định.</small>
            </div>
            <div className="v2-face-meta">
              <span>{facialGestureLabel} {faceTelemetry.faceGesture === 'none' ? '' : Math.round(faceTelemetry.faceGestureConfidence * 100) + '%'}</span>
              <span>AU12 {Math.round(Number(faceActionUnits.AU12 || 0) * 100)} · AU4 {Math.round(Number(faceActionUnits.AU04 || 0) * 100)}</span>
              <span>{realPresencePose.present ? `Depth ~${realPresencePose.distanceM.toFixed(2)}m` : 'Depth —'}</span>
              <span>Baseline {Math.round(faceAffect.channels.baselineReady * 100)}%</span>
            </div>
            <div className="v2-sensor-note">* rPPG là xu hướng thử nghiệm từ camera, không phải đo y tế.</div>
          </div>
        </div>
      )}
      {visionBooting && <div className="v2-vision-loading">Đang mở camera…</div>}
      <AirControlOverlay
        visible={visionOn && handSeen}
        x={airPoint.x}
        y={airPoint.y}
        pinching={pinching}
        targetLabel={airTargetLabel}
        feedback={airFeedback}
        mode={spatialTransformActive ? 'transform' : grabActive ? 'grab' : 'air'}
        scale={surfaceTransform.scale}
        rotation={surfaceTransform.rotation}
      />

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
            observedMood={faceAffect.mood}
            moodConfidence={faceAffect.confidence}
          />
          <RealPresenceOverlay
            active={visionOn}
            stream={visionMediaStream}
            faceSeen={faceSeen}
            pose={realPresencePose}
            mood={faceAffect.mood}
            moodConfidence={faceAffect.confidence}
          />
        </div>

        <div className="sr-only" aria-live="polite" aria-atomic="true">
          {mira.who}: {mira.caption}
        </div>

        {mira.content && (
          <aside
            className={`v2-result${grabActive ? ' grabbing' : ''}${spatialTransformActive ? ' transforming' : ''}`}
            aria-label="Kết quả trực quan"
            style={{
              '--grab-x': `${grabOffset.x}px`,
              '--grab-y': `${grabOffset.y}px`,
              '--surface-scale': surfaceTransform.scale.toFixed(3),
              '--surface-rotate': `${surfaceTransform.rotation.toFixed(2)}deg`,
            } as CSSProperties & Record<'--grab-x' | '--grab-y' | '--surface-scale' | '--surface-rotate', string>}
          >
            <ContentPanel content={mira.content} onClose={mira.clearContent} />
          </aside>
        )}
      </main>

      <div className="voice-footer">
        <button
          type="button"
          className={`voice-live${mira.live ? ' active' : ''}`}
          onClick={toggleLive}
          aria-pressed={mira.live}
          aria-label={mira.live ? 'Tắt trò chuyện rảnh tay' : 'Bật trò chuyện rảnh tay'}
          title={mira.live ? 'Tắt trò chuyện rảnh tay' : 'Bật trò chuyện rảnh tay'}
          data-air-action="safe"
          data-air-label={mira.live ? 'Tắt live voice' : 'Bật live voice'}
        >
          <span aria-hidden="true" />
        </button>
      </div>

      <SettingsPanel
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        theme={theme}
        onTheme={setTheme}
        voices={mira.voices}
        voiceURI={mira.voiceURI}
        onSelectVoice={mira.selectVoice}
        onTestVoice={mira.testVoice}
        onOpenLabs={openLabs}
      />
    </div>
  );
}
