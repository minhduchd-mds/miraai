import { lazy, Suspense, useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { useMira } from '../core/useMira';
import type { MiraState, Theme } from '../core/types';
import { IconCamera, IconCameraOff, IconSettings } from '../ui/icons';
import { useDialogFocus } from '../ui/useDialogFocus';
import PhotorealMira from '../presence/PhotorealMira';
import FaceMeshOverlay, { type FaceLandmarkPoint } from '../presence/FaceMeshOverlay';
import { AffectTracker, neutralAffect, type AffectState } from '../intelligence/affect/mood-engine';
import { describeAffectSignal, resolveFaceControlAction } from '../intelligence/affect/affect-control';
import { EMPTY_INTERACTION, InteractionTracker, interactionPrompt, type InteractionContext } from '../intelligence/social/interaction-engine';
import { FaceSocialControlTracker, gazePresenceLabel, type FaceSocialCue } from '../intelligence/social/face-social-control';
import { EMPTY_PRESENCE_CONTINUITY, PresenceContinuityTracker, presenceContinuityPrompt, type PresenceContinuityState } from '../intelligence/social/presence-continuity';
import { BehaviorTimeline } from '../intelligence/social/behavior-timeline';
import { GazeHeadCalibrator } from '../intelligence/social/gaze-head-calibration';
import { GestureIntentTracker, type GestureIntentState } from '../core/vision/gesture-intent';
import { micProsodySnapshot } from '../core/audio-level';
import { disableBackgroundCompanion, enableBackgroundCompanion } from '../runtime/background-companion';
import type { HandLandmarkPoint } from '../presence/HandSkeletonOverlay';
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
import { EMPTY_REAL_PRESENCE_POSE } from '../core/vision/real-presence';
import {
  measureTwoHands,
  rotationFromAngles,
  scaleFromDistance,
  smoothValue,
} from '../presence/spatial-math';
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
  const [faceLandmarks, setFaceLandmarks] = useState<FaceLandmarkPoint[]>([]);
  const sceneGraphTrackerRef = useRef(new SpatialSceneGraphTracker());
  const objectInteractionTrackerRef = useRef(new ObjectInteractionTracker());
  const actionSequenceTrackerRef = useRef(new ActionSequenceTracker());
  const causalActionGraphTrackerRef = useRef(new CausalActionGraphTracker());
  const [faceAffect, setFaceAffect] = useState<AffectState>(() => neutralAffect());
  const affectTrackerRef = useRef(new AffectTracker());
  const [interactionTelemetry, setInteractionTelemetry] = useState<InteractionContext>(() => ({ ...EMPTY_INTERACTION }));
  const interactionTrackerRef = useRef(new InteractionTracker());
  const behaviorTimelineRef = useRef(new BehaviorTimeline());
  const gazeHeadCalibratorRef = useRef(new GazeHeadCalibrator());
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

  useEffect(() => {
    try { localStorage.setItem('mira.affect.follow', affectFollowing ? '1' : '0'); } catch { /* noop */ }
  }, [affectFollowing]);

  useEffect(() => () => {
    if (faceActionTimerRef.current != null) window.clearTimeout(faceActionTimerRef.current);
    if (faceSocialCueTimerRef.current != null) window.clearTimeout(faceSocialCueTimerRef.current);
  }, []);

  const showFaceActionFeedback = useCallback((message: string) => {
    if (faceActionTimerRef.current != null) window.clearTimeout(faceActionTimerRef.current);
    setFaceActionFeedback(message);
    faceActionTimerRef.current = window.setTimeout(() => {
      faceActionTimerRef.current = null;
      setFaceActionFeedback('');
    }, 1100);
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
    gestureIntentTrackerRef.current.reset();
    setGestureIntentTelemetry({
      eventId: 0, intent: 'none', gesture: 'None', confidence: 0, stableMs: 0, at: 0,
    });
    lastGestureIntentIdRef.current = 0;
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
    setHandSeen(false);
    setGestureName('None');
    setGestureScore(0);
    setWaveSeen(false);
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
      const pulse = snapshot?.rppg || {
        status: 'off', bpmTrend: 0, quality: 0, relativeActivation: 0, sampleCount: 0,
      };
      const perf = snapshot?.visionPerformance;
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

      const interactionHands = (Array.isArray(snapshot?.hands) ? snapshot.hands : [])
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
  }, [affectFollowing, mira.interrupt, mira.observeAffect, mira.startListening, mira.stateRef, showFaceActionFeedback, visionOn, voiceReady]);

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
                >
                  <i aria-hidden="true" />
                  <span>{affectFollowing ? 'Phản ứng · Bật' : 'Chỉ quan sát'}</span>
                </button>
                {faceActionFeedback && <div className="v2-face-action-feedback" role="status">{faceActionFeedback}</div>}
              </>
            )}
            {!faceSeen && <div className="v2-face-scan-hint">Đưa khuôn mặt vào giữa khung hình</div>}
          </div>
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
            <Suspense fallback={null}>
              <ContentPanel content={mira.content} onClose={mira.clearContent} />
            </Suspense>
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
