import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react';
import type { MiraState } from '../core/types';
import type { ObservedMood } from '../intelligence/affect/mood-engine';
import type { EnvironmentLabel } from '../core/vision/environment-model';
import { audioLevel } from '../core/audio-level';
import {
  clarityProfile,
  computePhotorealDepthFrame,
  resolvePhotorealVisualQuality,
  type PhotorealVisualQuality,
} from './photoreal-depth';
import type { PhotorealCameraDepthController } from './photoreal-camera-depth';
import type { PhotorealEnvironmentController } from './photoreal-environment';
import type { PhotorealSceneCanvasHandle } from './PhotorealSceneCanvas';
import type { PhotorealPerformanceTier } from './photoreal-depth-warp';
import { resolveSpatial3DOverride, shouldUseSpatial3D } from './spatial-scene-policy';
import {
  PRESENCE_IMAGE,
  PRESENCE_SCENE_COPY,
  expressionAssetUrl,
  nextPresenceScene,
  resolvePresenceExpression,
  type MiraPresenceScene,
} from './presence-scene';
import { shouldPrefetchPresenceAsset, shouldRenderExpressionReaction } from './presence-media';
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
  environmentLabel?: EnvironmentLabel;
  environmentConfidence?: number;
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
  presenceScene?: MiraPresenceScene;
}

const asset = (path: string) => `${import.meta.env.BASE_URL}${path.startsWith('/') ? path.slice(1) : path}`;
const PhotorealSceneCanvas = lazy(() => import('./PhotorealSceneCanvas'));
const PhotorealSceneSegments = lazy(() => import('./PhotorealSceneSegments'));
const PhotorealSpatial3D = lazy(() => import('./PhotorealSpatial3D'));
const PhotorealRoom3D = lazy(() => import('./PhotorealRoom3D'));

const PRESENCE_VISUAL: Record<MiraPresenceScene, {
  scene: string;
  character: string | null;
}> = {
  daytime: { scene: asset(PRESENCE_IMAGE.daytime), character: null },
  'welcome-home': { scene: asset(PRESENCE_IMAGE['welcome-home']), character: null },
  'home-evening': { scene: asset(PRESENCE_IMAGE['home-evening']), character: null },
  bedtime: { scene: asset(PRESENCE_IMAGE.bedtime), character: null },
};

const STATE_LABEL: Record<MiraState, string> = {
  idle: 'READY',
  listening: 'LISTENING',
  thinking: 'THINKING',
  speaking: 'SPEAKING',
  interrupted: 'RESUMING',
  error: 'CHECK',
};

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
  environmentLabel = 'unknown',
  environmentConfidence = 0,
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
  presenceScene = 'home-evening',
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
  const cameraDepthControllerRef = useRef<PhotorealCameraDepthController | null>(null);
  const environmentControllerRef = useRef<PhotorealEnvironmentController | null>(null);
  const sceneCanvasRef = useRef<PhotorealSceneCanvasHandle | null>(null);
  const environmentRef = useRef({
    label: 'unknown' as EnvironmentLabel,
    confidence: 0,
  });
  const reducedMotionRef = useRef(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [visualQuality, setVisualQuality] = useState<PhotorealVisualQuality>('balanced');
  const [performanceTier, setPerformanceTier] = useState<PhotorealPerformanceTier>('full');
  const [spatial3DFailed, setSpatial3DFailed] = useState(false);
  const [room3DFailed,setRoom3DFailed] = useState(false);
  const [room3DReady,setRoom3DReady] = useState(false);
  const [spatial3DReadyScene, setSpatial3DReadyScene] = useState<MiraPresenceScene | null>(null);
  const spatial3DViewRef = useRef({x:0,y:0,headYaw:0,headPitch:0});
  const spatial3DInvalidatorRef = useRef<(() => void) | null>(null);
  const registerSpatialInvalidator = useCallback((invalidate: (() => void) | null) => {
    spatial3DInvalidatorRef.current = invalidate;
  }, []);
  const connection = typeof navigator !== 'undefined'
    ? (navigator as Navigator & {connection?: {saveData?: boolean}}).connection
    : undefined;
  const spatial3DOverride = typeof window !== 'undefined'
    ? resolveSpatial3DOverride(window.location.search) : 'auto';
  // Real geometric room opt-in. Do not confuse photo parallax with 3D geometry.
  const room3DPreference = typeof window !== 'undefined'
    ? new URLSearchParams(window.location.search).get('room3d') : null;
  // Start in REAL 3D on capable desktops; ?room3d=0 opts out and ?room3d=1
  // requests the same renderer on narrower devices subject to safety gates.
  const room3DRequested = room3DPreference === '1'
    || (room3DPreference !== '0' && typeof window !== 'undefined' && window.innerWidth >= 1024);
  // An explicitly opened 3D walkthrough must not unmount midway through
  // pointer-drag / WASD when the independent frame governor briefly changes.
  // WebGL errors, reduced-motion, Lite devices and Data Saver still fail back safely.
  const room3DActive = room3DRequested && !room3DFailed && !reducedMotion
    && visualQuality !== 'lite' && !Boolean(connection?.saveData);
  const spatial3DEnabled = !room3DActive && !spatial3DFailed && shouldUseSpatial3D({
    quality:visualQuality, performance:performanceTier, reducedMotion,
    saveData:Boolean(connection?.saveData),viewportWidth:typeof window !== 'undefined' ? window.innerWidth : 0,
    override:spatial3DOverride,
  });
  const spatial3DReady = spatial3DEnabled && spatial3DReadyScene === presenceScene;
  const markSpatial3DReady = useCallback(() => setSpatial3DReadyScene(presenceScene),[presenceScene]);
  const markSpatial3DFailed = useCallback(() => {
    setSpatial3DFailed(true);
    setSpatial3DReadyScene(null);
  }, []);
  const deviceDpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
  const visualProfile = clarityProfile(visualQuality, deviceDpr, attention);
  const presenceVisual = PRESENCE_VISUAL[presenceScene];
  const presenceCopy = PRESENCE_SCENE_COPY[presenceScene];
  const sceneAsset = presenceVisual.scene;
  const nextSceneAsset = PRESENCE_VISUAL[nextPresenceScene(presenceScene)].scene;
  const expressionName = resolvePresenceExpression({
    state,
    mood: observedMood,
    scene: presenceScene,
    socialCue,
  });
  const expressionAsset = asset(expressionAssetUrl(expressionName));
  const showExpressionReaction = shouldRenderExpressionReaction({
    expression: expressionName,
    state,
    moodConfidence,
    socialCue,
  });
  const showAffectionFx = observedMood === 'happy' && moodConfidence >= 0.45;
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
    if (cameraPoseEnabled && visualQuality !== 'lite' && !cameraDepthControllerRef.current) {
      void import('./photoreal-camera-depth').then((runtime) => {
        cameraDepthControllerRef.current = new runtime.PhotorealCameraDepthController();
      }).catch(() => {});
    }
  }, [cameraPoseEnabled, visualQuality]);

  useEffect(() => {
    if (visualQuality === 'lite' || environmentControllerRef.current) return;
    void import('./photoreal-environment').then((runtime) => {
      environmentControllerRef.current = new runtime.PhotorealEnvironmentController();
    }).catch(() => {});
  }, [visualQuality]);

  useEffect(() => {
    environmentRef.current = {
      label: environmentLabel,
      confidence: Math.max(0, Math.min(1, Number(environmentConfidence) || 0)),
    };
  }, [environmentConfidence, environmentLabel]);

  useEffect(() => {
    const confidence = Math.max(0, Math.min(1, Number(cameraPoseConfidence) || 0));
    cameraPoseRef.current = {
      enabled: Boolean(cameraPoseEnabled && confidence >= 0.42),
      yaw: Number(headYaw || 0),
      pitch: Number(headPitch || 0),
      roll: Number(headRoll || 0),
      distanceM: Number(cameraDistanceM || 0),
      confidence,
    };
  }, [cameraDistanceM, cameraPoseConfidence, cameraPoseEnabled, headPitch, headRoll, headYaw]);

  useEffect(() => {
    const node = rootRef.current;
    if (!node) return;

    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updateQuality = () => {
      const nav = navigator as Navigator & { deviceMemory?: number };
      const reducedMotion = motionQuery.matches;
      reducedMotionRef.current = reducedMotion;
      setReducedMotion(reducedMotion);
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
    const syncTier = () => {
      const raw = node.dataset.performanceTier;
      setPerformanceTier(raw === 'reduced' || raw === 'minimal' ? raw : 'full');
    };
    syncTier();
    const observer = new MutationObserver(syncTier);
    observer.observe(node,{attributes:true,attributeFilter:['data-performance-tier']});
    return () => observer.disconnect();
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
    const frame = (now: number) => {
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

      const smoothing = reducedMotionRef.current ? 1 : 0.11;
      for (const key of Object.keys(current) as Array<keyof typeof current>) {
        current[key] += (target[key] - current[key]) * smoothing;
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
      const cameraIntensity = cameraDepthControllerRef.current?.update({
        ...cameraPoseRef.current,
        quality: visualQuality,
        reducedMotion: reducedMotionRef.current,
      }, node, current) || 0;
      environmentControllerRef.current?.update({
        label: environmentRef.current.label,
        confidence: environmentRef.current.confidence,
        attention: gazeDepthRef.current.attention,
        cameraIntensity,
        quality: visualQuality,
        reducedMotion: reducedMotionRef.current,
      }, node, now);

      const cameraFrame = cameraDepthControllerRef.current?.snapshot();
      const performanceTier = (
        node.dataset.performanceTier === 'reduced'
        || node.dataset.performanceTier === 'minimal'
      ) ? node.dataset.performanceTier : 'full';
      const depthWarpActive = Boolean(
        cameraFrame
        && visualQuality === 'ultra'
        && performanceTier === 'full'
        && cameraFrame.intensity >= 0.18
        && !reducedMotionRef.current
      );
      node.dataset.depthWarp = depthWarpActive ? 'true' : 'false';
      if (spatial3DEnabled) {
        const updated = {
          x: pointerDepthRef.current.x,
          y: pointerDepthRef.current.y,
          headYaw: cameraPoseRef.current.enabled ? cameraPoseRef.current.yaw : 0,
          headPitch: cameraPoseRef.current.enabled ? cameraPoseRef.current.pitch : 0,
        };
        const before = spatial3DViewRef.current;
        if (Math.abs(before.x - updated.x) > .003 || Math.abs(before.y - updated.y) > .003
          || Math.abs(before.headYaw - updated.headYaw) > .003
          || Math.abs(before.headPitch - updated.headPitch) > .003) {
          spatial3DViewRef.current = updated;
          spatial3DInvalidatorRef.current?.();
        }
      }
      if (cameraFrame && !spatial3DEnabled) {
        sceneCanvasRef.current?.updateDepthWarp(
          cameraFrame,
          visualQuality,
          performanceTier,
          reducedMotionRef.current,
        );
      }
      raf = requestAnimationFrame(frame);
    };

    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [visualQuality, spatial3DEnabled]);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') return;

    const connection = (navigator as Navigator & {
      connection?: { saveData?: boolean; effectiveType?: string };
    }).connection;
    const canPrefetch = shouldPrefetchPresenceAsset({
      saveData: connection?.saveData,
      effectiveType: connection?.effectiveType,
      hidden: typeof document !== 'undefined' && document.hidden,
    });
    if (!canPrefetch) return;

    const win = window as typeof window & {
      requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    let idleId = 0;
    let timerId = 0;
    let cancelled = false;

    const preload = () => {
      if (cancelled) return;
      const upcoming = new Image();
      upcoming.decoding = 'async';
      upcoming.src = nextSceneAsset;
    };

    if (typeof win.requestIdleCallback === 'function') {
      idleId = win.requestIdleCallback(preload, { timeout: 3_000 });
    } else {
      timerId = window.setTimeout(preload, 1_800);
    }

    return () => {
      cancelled = true;
      if (idleId && typeof win.cancelIdleCallback === 'function') win.cancelIdleCallback(idleId);
      if (timerId) window.clearTimeout(timerId);
    };
  }, [nextSceneAsset]);

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
      className={`photo-mira bedroom-presence scene-${presenceScene} state-${state} user-mood-${observedMood} gaze-${interactionState} social-${socialCue} presence-${presenceMode} presence-cue-${presenceCue}${live ? ' is-live' : ''}${affectActive ? ' affect-active' : ''}${affectFollowing ? ' affect-follow' : ''}${spatialCoreActive ? ' spatial-core-active' : ''}`}
      data-visual-quality={visualQuality}
      data-spatial3d-ready={spatial3DReady ? 'true' : 'false'}
      data-spatial3d-enabled={spatial3DEnabled ? 'true' : 'false'}
      data-room3d-active={room3DActive ? 'true' : 'false'}
      data-room3d-ready={room3DActive && room3DReady ? 'true' : 'false'}
      data-presence-scene={presenceScene}
      onClick={onActivate}
      onPointerMove={handlePointerMove}
      onPointerLeave={resetPointer}
      aria-label={label}
    >
      <span className="pm-scene-shell" aria-hidden="true">
        <img
          className="pm-scene pm-bedroom-scene pm-scene-fallback"
          src={sceneAsset}
          alt=""
          draggable={false}
          decoding="async"
          fetchPriority="high"
        />
        {room3DActive && (
          <Suspense fallback={null}>
            <PhotorealRoom3D
              scene={presenceScene}
              onReady={() => setRoom3DReady(true)}
              onFailure={() => {setRoom3DFailed(true);setRoom3DReady(false);}}
            />
          </Suspense>
        )}
        {spatial3DEnabled && (
          <span className="pm-spatial3d" aria-hidden="true">
            <Suspense fallback={null}>
              <PhotorealSpatial3D
                src={sceneAsset}
                scene={presenceScene}
                viewRef={spatial3DViewRef}
                onReady={markSpatial3DReady}
                onFailure={markSpatial3DFailed}
                registerInvalidate={registerSpatialInvalidator}
              />
            </Suspense>
          </span>
        )}
        {visualProfile.sharpness > 0 && !spatial3DEnabled && !room3DActive && (
          <Suspense fallback={null}>
            <PhotorealSceneCanvas
              ref={sceneCanvasRef}
              className="pm-scene-canvas"
              src={sceneAsset}
              renderDpr={visualProfile.renderDpr}
              sharpness={visualProfile.sharpness}
            />
          </Suspense>
        )}
        <img
          className="pm-depth-layer pm-depth-mid"
          src={sceneAsset}
          alt=""
          draggable={false}
          decoding="async"
        />
        <img
          className="pm-depth-layer pm-depth-near"
          src={sceneAsset}
          alt=""
          draggable={false}
          decoding="async"
        />
        {!spatial3DEnabled && !room3DActive && presenceScene === 'bedtime' && (visualQuality === 'high' || visualQuality === 'ultra') && (
          <Suspense fallback={null}>
            <PhotorealSceneSegments src={sceneAsset} />
          </Suspense>
        )}
        <span className="pm-depth-atmosphere" />
        <span className="pm-depth-relight" />
        <span className="pm-depth-contact-shadow" />
        <span className="pm-env-window-light" />
        <span className="pm-env-city-bokeh" />
        <span className="pm-env-light-rays" />
        <span className="pm-env-practical-light" />
        <span className="pm-env-bed-bounce" />
        <span className="pm-env-reflection" />
        <span className="pm-env-edge-occlusion" />
        <span className="pm-env-dust" />
        <span className="pm-env-vignette" />
        <span className="pm-depth-grain" />
      </span>

      <span className="pm-bedroom-tint" aria-hidden="true" />

      {presenceVisual.character && !room3DActive && (
        <span className="pm-presence-character-zone" aria-hidden="true">
          <img
            className="pm-presence-character"
            src={presenceVisual.character}
            alt=""
            draggable={false}
            decoding="async"
          />
        </span>
      )}

      {showExpressionReaction && !room3DActive && (
        <img
          className="pm-expression-card"
          src={expressionAsset}
          alt=""
          aria-hidden="true"
          draggable={false}
          decoding="async"
          loading="lazy"
        />
      )}
      {showAffectionFx && (
        <img
          className="pm-fx pm-fx-hearts"
          src={asset('/mira-assets/effects/fx_heart_particles.png')}
          alt=""
          aria-hidden="true"
          draggable={false}
        />
      )}
      {state === 'listening' && (
        <img
          className="pm-fx pm-fx-mic-ring"
          src={asset('/mira-assets/effects/fx_mic_ring_neon.png')}
          alt=""
          aria-hidden="true"
          draggable={false}
        />
      )}

      <span
        key={`hero-${state}`}
        className="pm-hero-copy"
        data-hero-state={state}
        aria-hidden="true"
      >
        <span className="pm-hero-capabilities" aria-hidden="true">
          <span><i />VOICE FIRST</span>
        </span>
        <span className="pm-hero-story">
          <span className="pm-hero-kicker">MIRA <i /> {STATE_LABEL[state]}</span>
          <strong>{presenceCopy.title}</strong>
          <em>{presenceCopy.subtitle}</em>
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
