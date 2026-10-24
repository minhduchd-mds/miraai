import { useEffect, useRef, useState } from 'react';
import type { MiraState } from '../../core/types';
import type { MotionInput } from './motion.ts';
import { audioLevel, speechPlayback, ttsLevel } from '../../core/audio-level';
import { prepareRig, type LiveAvatarRig } from './rig-deform.ts';
import { AvatarMotion } from './motion.ts';
import { LiveAvatarRenderer } from './live-avatar-gl.ts';
import './live-avatar.css';

// Mira LiveAvatar presence: an original, documented portrait animated in real time like a
// livestream host. Mouth follows Mira's actual voice (Live or TTS) through ttsLevel; blinks,
// gaze, breathing and head motion come from AvatarMotion. Falls back to the still photo.

const FACE = 'mira-assets/live/mira-live-face-v1.webp';
const RIG = 'mira-assets/live/mira-live-face-v1.rig.json';
// Original procedural teeth atlas (scripts/live-avatar/build-teeth.py).
const TEETH = 'mira-assets/live/mira-teeth-v1.webp';
const loadImage = (src: string) => new Promise<HTMLImageElement>((resolve, reject) => {
  const img = new Image();
  img.decoding = 'async';
  img.onload = () => resolve(img);
  img.onerror = () => reject(new Error(src));
  img.src = src;
});
const asset = (path: string) => `${import.meta.env.BASE_URL}${path}`;

interface Props {
  state: MiraState;
  live: boolean;
  realtime: boolean;
  /** Observed user mood when the camera is on and "Phản ứng" is enabled; otherwise neutral. */
  userMood?: MotionInput['userMood'];
}

// Not a button: the whole stage used to start the mic on any stray tap (UI QA 24/10).
// Conversation starts only from the explicit mic / LIVE controls in the dock.
export default function LiveAvatarPresence({ state, live, realtime, userMood = 'neutral' }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;
  const moodRef = useRef(userMood);
  moodRef.current = userMood;
  const [mode, setMode] = useState<'loading' | 'live' | 'still'>('loading');

  useEffect(() => {
    let disposed = false;
    let raf = 0;
    let renderer: LiveAvatarRenderer | null = null;
    let observer: ResizeObserver | null = null;
    const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    const motion = new AvatarMotion(Date.now() & 0xffff);
    const debugProbe = /[?&]avatar-debug=1\b/.test(window.location.search);
    // Frame-by-frame video export (?avatar-export=1, scripts/media/render-talking.mjs): the
    // real-time loop stops and the recorder drives time + Mira's voice envelope per frame, so
    // the video is a smooth 30 fps with exact lip sync even on a CPU-only machine.
    const exportMode = /[?&]avatar-export=1\b/.test(window.location.search);
    // Interactive gaze: Mira's eyes follow the pointer/touch over the stage, then return.
    let lookAt: { x: number; y: number } | null = null;
    let lookUntil = 0;
    const onPointer = (event: PointerEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      lookAt = {
        x: Math.max(-1, Math.min(1, (event.clientX - (rect.left + rect.width / 2)) / (rect.width / 2))),
        y: Math.max(-1, Math.min(1, (event.clientY - (rect.top + rect.height * 0.36)) / (rect.height / 2))),
      };
      lookUntil = performance.now() + 2500;
    };
    const onLeave = () => { lookAt = null; };
    window.addEventListener('pointermove', onPointer, { passive: true });
    window.addEventListener('pointerdown', onPointer, { passive: true });
    document.addEventListener('pointerleave', onLeave);

    (async () => {
      try {
        const [rig, image, teeth] = await Promise.all([
          fetch(asset(RIG), { cache: 'force-cache' }).then((r) => { if (!r.ok) throw new Error('rig'); return r.json() as Promise<LiveAvatarRig>; }),
          new Promise<HTMLImageElement>((resolve, reject) => {
            const img = new Image();
            img.decoding = 'async';
            img.onload = () => resolve(img);
            img.onerror = () => reject(new Error('face'));
            img.src = asset(FACE);
          }),
          loadImage(asset(TEETH)).catch(() => null),
        ]);
        if (disposed || !canvasRef.current) return;
        const canvas = canvasRef.current;
        renderer = new LiveAvatarRenderer(canvas, prepareRig(rig), image, exportMode, teeth);
        const fit = () => {
          const rect = canvas.getBoundingClientRect();
          const dpr = Math.min(2, window.devicePixelRatio || 1);
          renderer?.resize(Math.max(1, Math.round(rect.width * dpr)), Math.max(1, Math.round(rect.height * dpr)));
        };
        fit();
        observer = new ResizeObserver(fit);
        observer.observe(canvas);
        setMode('live');
        if (exportMode) {
          type ExportFrame = { timeMs: number; state: MotionInput['state']; level: number; bands: { low: number; mid: number; high: number } | null; lookAt?: { x: number; y: number } | null; userLevel?: number };
          (window as unknown as { __miraRenderFrame?: (f: ExportFrame) => void }).__miraRenderFrame = (f) => {
            if (!renderer) return;
            renderer.render(motion.update({
              timeMs: f.timeMs, state: f.state, voiceLevel: f.state === 'speaking' ? f.level : -1,
              voiceBands: f.state === 'speaking' ? f.bands : null, userLevel: f.userLevel || 0,
              reducedMotion: false, userMood: moodRef.current, lookAt: f.lookAt ?? null,
            }));
          };
          return;
        }
        const frame = (now: number) => {
          if (disposed || !renderer) return;
          const speaking = stateRef.current === 'speaking' && ttsLevel.active;
          if (lookAt && now > lookUntil) lookAt = null;
          const params = motion.update({
            timeMs: now,
            state: stateRef.current,
            voiceLevel: speaking ? ttsLevel.value : -1,
            voiceBands: speaking ? ttsLevel.bands : null,
            userLevel: stateRef.current === 'listening' && audioLevel.active ? audioLevel.value : 0,
            reducedMotion: reduced,
            userMood: moodRef.current,
            // No analyser level (AudioContext locked, device voice) but the reply is audible.
            voiceAudible: speechPlayback.active,
            lookAt,
          });
          // Opt-in QA probe (?avatar-debug=1): expose live face params + drive signals for
          // recording/sync checks. One reference assignment; nothing leaves the page.
          if (debugProbe) (window as unknown as { __miraFace?: object }).__miraFace = { ...params, speaking, level: ttsLevel.value, analyser: ttsLevel.active, audible: speechPlayback.active, state: stateRef.current };
          // Dev-only QA hook (stripped from production builds): force a pose for screenshots.
          if (import.meta.env.DEV) Object.assign(params, (window as unknown as { __liveAvatarPose?: object }).__liveAvatarPose || {});
          renderer.render(params);
          raf = requestAnimationFrame(frame);
        };
        raf = requestAnimationFrame(frame);
      } catch {
        if (!disposed) setMode('still');
      }
    })();

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      window.removeEventListener('pointermove', onPointer);
      window.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('pointerleave', onLeave);
      observer?.disconnect();
      renderer?.dispose();
    };
  }, []);

  return (
    <div
      className={`live-avatar state-${state}${live ? ' is-live' : ''}${realtime ? ' is-realtime' : ''}`}
      data-live-avatar={mode}
      role="img"
      aria-label={live ? 'Mira, nhân vật AI, đang trò chuyện' : 'Mira, nhân vật AI'}
    >
      <img className="live-avatar-still" src={asset(FACE)} alt="" aria-hidden="true" draggable={false} />
      <canvas ref={canvasRef} className="live-avatar-canvas" aria-hidden="true" />
      <span className="live-avatar-badge" aria-hidden="true">
        <i />{realtime ? 'LIVE' : state === 'speaking' ? 'ĐANG NÓI' : 'MIRA'}
      </span>
    </div>
  );
}
