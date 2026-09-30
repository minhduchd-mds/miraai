import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react';
import type { MiraState } from '../core/types';
import type { ObservedMood } from '../intelligence/affect/mood-engine';
import { audioLevel } from '../core/audio-level';
import {
  clarityProfile,
  computeCameraSpatialFrame,
  computePhotorealDepthFrame,
  resolvePhotorealVisualQuality,
  type PhotorealVisualQuality,
} from './photoreal-depth';
import './photoreal-mira.css';

interface Props {
  state: MiraState;
  onActivate: () => void;
  contextText?: string;
  live?: boolean;
  voiceReady?: boolean;
  caption?: string;
  who?: string;
  brainName?: string;
  sttAvailable?: boolean;
  observedMood?: ObservedMood;
  moodConfidence?: number;
  affectActive?: boolean;
  affectFollowing?: boolean;
  interactionState?: 'engaged' | 'focused' | 'looking_away' | 'returning' | 'absent' | 'uncertain';
  attention?: number;
  eyeContact?: number;
  gazeX?: number;
  gazeY?: number;
  cameraPoseEnabled?: boolean;
  headYaw?: number;
  headPitch?: number;
  headRoll?: number;
  cameraDistanceM?: number;
  cameraPoseConfidence?: number;
  socialCue?: 'none' | 'wink_left' | 'wink_right' | 'brow_raise' | 'smile';
  presenceMode?: 'ambient' | 'attentive' | 'quiet' | 'reconnect';
  presenceCue?: 'none' | 'return' | 'focus' | 'smile' | 'brow';
  presenceContinuity?: number;
  spatialCoreStyle?: CSSProperties;
  spatialCorePreviewStyle?: CSSProperties;
  spatialCorePreviewVisible?: boolean;
  spatialCorePhysicsMode?: 'idle' | 'grabbed' | 'inertia';
  spatialCoreDepth?: number;
  spatialNodeStyle?: CSSProperties;
  spatialNodePreviewStyle?: CSSProperties;
  spatialNodePreviewVisible?: boolean;
  spatialNodePhysicsMode?: 'idle' | 'grabbed' | 'inertia';
  spatialNodeDepth?: number;
  spatialCoreActive?: boolean;
}

const asset = (path: string) => `${import.meta.env.BASE_URL}${path.startsWith('/') ? path.slice(1) : path}`;
const PhotorealSceneCanvas = lazy(() => import('./PhotorealSceneCanvas'));
const MIRA_BEDROOM = asset('scenes/mira-bedroom.webp');

const SCENE_BY_STATE: Record<MiraState, string> = {
  idle: MIRA_BEDROOM,
  listening: MIRA_BEDROOM,
  thinking: MIRA_BEDROOM,
  speaking: MIRA_BEDROOM,
  interrupted: MIRA_BEDROOM,
  error: MIRA_BEDROOM,
};

const STATE_LABEL: Record<MiraState, string> = {
  idle: 'READY',
  listening: 'LISTENING',
  thinking: 'THINKING',
  speaking: 'SPEAKING',
  interrupted: 'RESUMING',
  error: 'CHECK',
};

const PRELOAD = [...new Set(Object.values(SCENE_BY_STATE))];
const WAVE_BARS = Array.from({ length: 31 }, (_, index) => index);

export default function PhotorealMira({
  state,
  onActivate,
  live = false,
  voiceReady = false,
  observedMood = 'neutral',
  moodConfidence = 0,
  affectActive = false,
  affectFollowing = true,
  interactionState = 'uncertain',
  attention = 0,
  eyeContact = 0,
  gazeX = 0,
  gazeY = 0,
  cameraPoseEnabled = false,
  headYaw = 0,
  headPitch = 0,
  headRoll = 0,
  cameraDistanceM = 0,
  cameraPoseConfidence = 0,
  socialCue = 'none',
  presenceMode = 'ambient',
  presenceCue = 'none',
  presenceContinuity = 0,
  spatialCoreStyle,
  spatialCorePreviewStyle,
  spatialCorePreviewVisible = false,
  spatialCorePhysicsMode = 'idle',
  spatialCoreDepth = 0,
  spatialNodeStyle,
  spatialNodePreviewStyle,
  spatialNodePreviewVisible = false,
  spatialNodePhysicsMode = 'idle',
  spatialNodeDepth = 0,
  spatialCoreActive = false,
}: Props) {
  const rootRef = useRef<HTMLButtonElement>(null);
  const pointerDepthRef = useRef({ x: 0, y: 0 });
  const gazeDepthRef = useRef({ x: 0, y: 0, attention: 0 });
  const cameraPoseRef = useRef({
    enabled: false,
    yaw: 0,
    pitch: 0,
    roll: 0,
    distanceM: 0,
    confidence: 0,
  });
  const cameraBaselineDistanceRef = useRef(0);
  const reducedMotionRef = useRef(false);
  const [visualQuality, setVisualQuality] = useState<PhotorealVisualQuality>('balanced');
  const deviceDpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
  const visualProfile = clarityProfile(visualQuality, deviceDpr, attention);
  const liveLabel = live ? '24/7 ACTIVE' : voiceReady ? 'VOICE READY' : 'CHẠM 1 LẦN ĐỂ BẬT';
  const label = live ? 'Mira đang ở chế độ trò chuyện liên tục' : 'Bật Mira 24/7';

  useEffect(() => {
    const node = rootRef.current;
    if (!node) return;
    const strength = affectActive && affectFollowing
      ? Math.max(0, Math.min(1, Number(moodConfidence) || 0))
      : 0;
    const attentionLevel = Math.max(0, Math.min(1, Number(attention) || 0));
    const eyeLevel = Math.max(0, Math.min(1, Number(eyeContact) || 0));
    const gazeShiftX = Math.max(-1, Math.min(1, Number(gazeX) || 0)) * 5;
    const gazeShiftY = Math.max(-1, Math.min(1, Number(gazeY) || 0)) * 3;
    const continuity = Math.max(0, Math.min(1, Number(presenceContinuity) || 0));
    node.style.setProperty('--pm-affect', strength.toFixed(3));
    node.style.setProperty('--pm-attention', attentionLevel.toFixed(3));
    node.style.setProperty('--pm-eye-contact', eyeLevel.toFixed(3));
    node.style.setProperty('--pm-gaze-x', `${gazeShiftX.toFixed(2)}px`);
    node.style.setProperty('--pm-gaze-y', `${gazeShiftY.toFixed(2)}px`);
    node.style.setProperty('--pm-continuity', continuity.toFixed(3));
    gazeDepthRef.current = {
      x: Math.max(-1, Math.min(1, Number(gazeX) || 0)),
      y: Math.max(-1, Math.min(1, Number(gazeY) || 0)),
      attention: attentionLevel,
    };
  }, [affectActive, affectFollowing, attention, eyeContact, gazeX, gazeY, moodConfidence, presenceContinuity]);

  useEffect(() => {
    const confidence = Math.max(0, Math.min(1, Number(cameraPoseConfidence) || 0));
    const distanceM = Number(cameraDistanceM || 0);
    const enabled = Boolean(cameraPoseEnabled && confidence >= 0.42);
    cameraPoseRef.current = {
      enabled,
      yaw: Number(headYaw || 0),
      pitch: Number(headPitch || 0),
      roll: Number(headRoll || 0),
      distanceM,
      confidence,
    };

    if (enabled && distanceM > 0.12) {
      if (cameraBaselineDistanceRef.current <= 0.12) {
        cameraBaselineDistanceRef.current = distanceM;
      } else if (Math.abs(distanceM - cameraBaselineDistanceRef.current) < 0.12) {
        cameraBaselineDistanceRef.current += (distanceM - cameraBaselineDistanceRef.current) * 0.004;
      }
    } else if (!cameraPoseEnabled) {
      cameraBaselineDistanceRef.current = 0;
    }
  }, [cameraDistanceM, cameraPoseConfidence, cameraPoseEnabled, headPitch, headRoll, headYaw]);

  useEffect(() => {
    const node = rootRef.current;
    if (!node) return;

    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updateQuality = () => {
      const nav = navigator as Navigator & { deviceMemory?: number };
      const reducedMotion = motionQuery.matches;
      reducedMotionRef.current = reducedMotion;
      const quality = resolvePhotorealVisualQuality({
        dpr: window.devicePixelRatio || 1,
        width: window.innerWidth,
        height: window.innerHeight,
        hardwareConcurrency: navigator.hardwareConcurrency || 4,
        deviceMemoryGb: Number(nav.deviceMemory || 0),
        reducedMotion,
      });
      setVisualQuality(quality);
      node.dataset.reducedMotion = reducedMotion ? 'true' : 'false';
    };

    updateQuality();
    window.addEventListener('resize', updateQuality, { passive: true });
    motionQuery.addEventListener?.('change', updateQuality);
    return () => {
      window.removeEventListener('resize', updateQuality);
      motionQuery.removeEventListener?.('change', updateQuality);
    };
  }, []);

  useEffect(() => {
    const node = rootRef.current;
    if (!node) return;
    node.style.setProperty('--pm-clarity-contrast', visualProfile.contrast.toFixed(3));
    node.style.setProperty('--pm-clarity-saturation', visualProfile.saturation.toFixed(3));
    node.style.setProperty('--pm-clarity-brightness', visualProfile.brightness.toFixed(3));
    node.style.setProperty('--pm-far-blur', `${visualProfile.farBlurPx.toFixed(2)}px`);
    node.style.setProperty('--pm-mid-opacity', visualProfile.midOpacity.toFixed(3));
    node.style.setProperty('--pm-near-opacity', visualProfile.nearOpacity.toFixed(3));
    node.style.setProperty('--pm-haze-opacity', visualProfile.hazeOpacity.toFixed(3));
    node.style.setProperty('--pm-grain-opacity', visualProfile.grainOpacity.toFixed(3));
  }, [visualProfile.brightness, visualProfile.contrast, visualProfile.farBlurPx, visualProfile.grainOpacity, visualProfile.hazeOpacity, visualProfile.midOpacity, visualProfile.nearOpacity, visualProfile.saturation]);

  useEffect(() => {
    let raf = 0;
    const current = {
      backX: 0, backY: 0,
      midX: 0, midY: 0,
      nearX: 0, nearY: 0,
      tiltXDeg: 0, tiltYDeg: 0,
    };
    const cameraCurrent = {
      roomX: 0, roomY: 0,
      subjectX: 0, subjectY: 0,
      foregroundX: 0, foregroundY: 0,
      rotateXDeg: 0, rotateYDeg: 0, rollDeg: 0,
      scale: 1, shadowX: 0, intensity: 0,
    };

    const frame = () => {
      const node = rootRef.current;
      if (!node) return;

      const target = reducedMotionRef.current
        ? computePhotorealDepthFrame({
            pointerX: 0,
            pointerY: 0,
            gazeX: 0,
            gazeY: 0,
            attention: 0,
            quality: 'lite',
          })
        : computePhotorealDepthFrame({
            pointerX: pointerDepthRef.current.x,
            pointerY: pointerDepthRef.current.y,
            gazeX: gazeDepthRef.current.x,
            gazeY: gazeDepthRef.current.y,
            attention: gazeDepthRef.current.attention,
            quality: visualQuality,
          });

      const cameraTarget = reducedMotionRef.current
        ? computeCameraSpatialFrame({
            enabled: false,
            yaw: 0,
            pitch: 0,
            roll: 0,
            distanceM: 0,
            baselineDistanceM: 0,
            confidence: 0,
            quality: 'lite',
          })
        : computeCameraSpatialFrame({
            ...cameraPoseRef.current,
            baselineDistanceM: cameraBaselineDistanceRef.current,
            quality: visualQuality,
          });

      const smoothing = reducedMotionRef.current ? 1 : 0.11;
      const cameraSmoothing = reducedMotionRef.current ? 1 : 0.085;
      for (const key of Object.keys(current) as Array<keyof typeof current>) {
        current[key] += (target[key] - current[key]) * smoothing;
      }
      for (const key of Object.keys(cameraCurrent) as Array<keyof typeof cameraCurrent>) {
        cameraCurrent[key] += (cameraTarget[key] - cameraCurrent[key]) * cameraSmoothing;
      }

      node.style.setProperty('--pm-depth-back-x', `${current.backX.toFixed(2)}px`);
      node.style.setProperty('--pm-depth-back-y', `${current.backY.toFixed(2)}px`);
      node.style.setProperty('--pm-depth-mid-x', `${current.midX.toFixed(2)}px`);
      node.style.setProperty('--pm-depth-mid-y', `${current.midY.toFixed(2)}px`);
      node.style.setProperty('--pm-depth-near-x', `${current.nearX.toFixed(2)}px`);
      node.style.setProperty('--pm-depth-near-y', `${current.nearY.toFixed(2)}px`);
      node.style.setProperty('--pm-depth-tilt-x', `${current.tiltXDeg.toFixed(3)}deg`);
      node.style.setProperty('--pm-depth-tilt-y', `${current.tiltYDeg.toFixed(3)}deg`);
      node.style.setProperty('--pm-scene-x', `${current.midX.toFixed(2)}px`);
      node.style.setProperty('--pm-scene-y', `${current.midY.toFixed(2)}px`);
      node.style.setProperty('--pm-camera-room-x', `${cameraCurrent.roomX.toFixed(2)}px`);
      node.style.setProperty('--pm-camera-room-y', `${cameraCurrent.roomY.toFixed(2)}px`);
      node.style.setProperty('--pm-camera-subject-x', `${cameraCurrent.subjectX.toFixed(2)}px`);
      node.style.setProperty('--pm-camera-subject-y', `${cameraCurrent.subjectY.toFixed(2)}px`);
      node.style.setProperty('--pm-camera-foreground-x', `${cameraCurrent.foregroundX.toFixed(2)}px`);
      node.style.setProperty('--pm-camera-foreground-y', `${cameraCurrent.foregroundY.toFixed(2)}px`);
      node.style.setProperty('--pm-camera-rotate-x', `${cameraCurrent.rotateXDeg.toFixed(3)}deg`);
      node.style.setProperty('--pm-camera-rotate-y', `${cameraCurrent.rotateYDeg.toFixed(3)}deg`);
      node.style.setProperty('--pm-camera-roll', `${cameraCurrent.rollDeg.toFixed(3)}deg`);
      node.style.setProperty('--pm-camera-scale', cameraCurrent.scale.toFixed(4));
      node.style.setProperty('--pm-camera-shadow-x', `${cameraCurrent.shadowX.toFixed(2)}px`);
      node.style.setProperty('--pm-camera-depth-intensity', cameraCurrent.intensity.toFixed(3));
      raf = requestAnimationFrame(frame);
    };

    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [visualQuality]);

  useEffect(() => {
    PRELOAD.forEach((src) => {
      const image = new Image();
      image.decoding = 'async';
      image.src = src;
    });
  }, []);

  useEffect(() => {
    let raf = 0;
    let smooth = 0;
    let energy = 0;
    const startedAt = performance.now();

    const frame = (now: number) => {
      const node = rootRef.current;
      if (!node) return;

      const elapsed = now - startedAt;
      const input = audioLevel.active ? audioLevel.value : -1;
      const synthetic = state === 'speaking'
        ? 0.18 + Math.sin(elapsed / 92) * 0.07 + Math.sin(elapsed / 41) * 0.025
        : state === 'listening'
          ? 0.09 + Math.sin(elapsed / 170) * 0.035
          : state === 'thinking'
            ? 0.055 + Math.sin(elapsed / 240) * 0.02
            : 0.018 + Math.sin(elapsed / 1100) * 0.007;

      const target = Math.max(0, Math.min(1, input >= 0 ? input : synthetic));
      smooth += (target - smooth) * (target > smooth ? 0.28 : 0.11);
      energy += (Math.abs(target - smooth) - energy) * 0.16;

      node.style.setProperty('--pm-level', smooth.toFixed(3));
      node.style.setProperty('--pm-energy', Math.min(1, energy * 7).toFixed(3));
      raf = requestAnimationFrame(frame);
    };

    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [state]);

  const handlePointerMove = useCallback((event: ReactPointerEvent<HTMLButtonElement>) => {
    const node = rootRef.current;
    if (!node) return;
    const rect = node.getBoundingClientRect();
    pointerDepthRef.current = {
      x: Math.max(-1, Math.min(1, ((event.clientX - rect.left) / Math.max(1, rect.width) - 0.5) * 2)),
      y: Math.max(-1, Math.min(1, ((event.clientY - rect.top) / Math.max(1, rect.height) - 0.5) * 2)),
    };
  }, []);

  const resetPointer = useCallback(() => {
    pointerDepthRef.current = { x: 0, y: 0 };
  }, []);

  return (
    <button
      ref={rootRef}
      type="button"
      className={`photo-mira bedroom-presence state-${state} user-mood-${observedMood} gaze-${interactionState} social-${socialCue} presence-${presenceMode} presence-cue-${presenceCue}${live ? ' is-live' : ''}${affectActive ? ' affect-active' : ''}${affectFollowing ? ' affect-follow' : ''}${spatialCoreActive ? ' spatial-core-active' : ''}`}
      data-visual-quality={visualQuality}
      onClick={onActivate}
      onPointerMove={handlePointerMove}
      onPointerLeave={resetPointer}
      aria-label={label}
    >
      <span className="pm-scene-shell" aria-hidden="true">
        <img
          className="pm-scene pm-bedroom-scene pm-scene-fallback"
          src={SCENE_BY_STATE[state]}
          alt=""
          draggable={false}
          decoding="async"
        />
        {visualProfile.sharpness > 0 && (
          <Suspense fallback={null}>
            <PhotorealSceneCanvas
              className="pm-scene-canvas"
              src={SCENE_BY_STATE[state]}
              renderDpr={visualProfile.renderDpr}
              sharpness={visualProfile.sharpness}
            />
          </Suspense>
        )}
        <img
          className="pm-depth-layer pm-depth-mid"
          src={SCENE_BY_STATE[state]}
          alt=""
          draggable={false}
          decoding="async"
        />
        <img
          className="pm-depth-layer pm-depth-near"
          src={SCENE_BY_STATE[state]}
          alt=""
          draggable={false}
          decoding="async"
        />
        <span className="pm-depth-atmosphere" />
        <span className="pm-depth-relight" />
        <span className="pm-depth-contact-shadow" />
        <span className="pm-depth-grain" />
      </span>

      <span className="pm-bedroom-tint" aria-hidden="true" />

      <span
        key={`hero-${state}`}
        className="pm-hero-copy"
        data-hero-state={state}
        aria-hidden="true"
      >
        <span className="pm-hero-capabilities">
          <span><i />VOICE</span>
          <span><i />MEMORY</span>
          <span><i />VISION</span>
          <span><i />SPATIAL AI</span>
        </span>
        <span className="pm-hero-story">
          <span className="pm-hero-kicker">MIRA <i /> {STATE_LABEL[state]}</span>
          <strong>
            <span>Always here,</span>
            <span>in your space</span>
          </strong>
          <em>Voice, memory, vision, and spatial presence — quietly ready when you are.</em>
        </span>
      </span>

      <span className="pm-live-pill" aria-hidden="true">
        <i />
        <b>{liveLabel}</b>
        <em>{STATE_LABEL[state]}</em>
      </span>

      <span className="pm-wave" aria-hidden="true">
        {WAVE_BARS.map((index) => <i key={index} />)}
      </span>

      {spatialCorePreviewVisible && (
        <span
          className="pm-state-orb pm-state-orb-preview"
          style={spatialCorePreviewStyle}
          aria-hidden="true"
        ><i /></span>
      )}
      <span
        className={`pm-state-orb physics-${spatialCorePhysicsMode}`}
        style={spatialCoreStyle}
        data-spatial-object="mira.core"
        data-spatial-label="Mira Core"
        data-spatial-depth={spatialCoreDepth}
        data-spatial-depth-radius="0.12"
        aria-hidden="true"
      ><i /></span>
      {spatialNodePreviewVisible && (
        <span
          className="pm-state-orb pm-state-node pm-state-orb-preview"
          style={spatialNodePreviewStyle}
          aria-hidden="true"
        ><i /></span>
      )}
      <span
        className={`pm-state-orb pm-state-node physics-${spatialNodePhysicsMode}`}
        style={spatialNodeStyle}
        data-spatial-object="mira.node"
        data-spatial-label="Mira Node"
        data-spatial-depth={spatialNodeDepth}
        data-spatial-depth-radius="0.09"
        aria-hidden="true"
      ><i /></span>
      <span className="pm-vignette" aria-hidden="true" />
      <span className="sr-only">{label}</span>
    </button>
  );
}
