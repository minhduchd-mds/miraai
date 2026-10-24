import { useEffect, useRef, useState } from 'react';
import type { MiraState } from '../../core/types';
import { audioLevel, ttsLevel } from '../../core/audio-level';
import { prepareRig, type LiveAvatarRig } from './rig-deform.ts';
import { AvatarMotion } from './motion.ts';
import { LiveAvatarRenderer } from './live-avatar-gl.ts';
import './live-avatar.css';

// Mira LiveAvatar presence: an original, documented portrait animated in real time like a
// livestream host. Mouth follows Mira's actual voice (Live or TTS) through ttsLevel; blinks,
// gaze, breathing and head motion come from AvatarMotion. Falls back to the still photo.

const FACE = 'mira-assets/live/mira-live-face-v1.webp';
const RIG = 'mira-assets/live/mira-live-face-v1.rig.json';
const asset = (path: string) => `${import.meta.env.BASE_URL}${path}`;

interface Props {
  state: MiraState;
  live: boolean;
  realtime: boolean;
}

// Not a button: the whole stage used to start the mic on any stray tap (UI QA 24/10).
// Conversation starts only from the explicit mic / LIVE controls in the dock.
export default function LiveAvatarPresence({ state, live, realtime }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;
  const [mode, setMode] = useState<'loading' | 'live' | 'still'>('loading');

  useEffect(() => {
    let disposed = false;
    let raf = 0;
    let renderer: LiveAvatarRenderer | null = null;
    let observer: ResizeObserver | null = null;
    const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    const motion = new AvatarMotion(Date.now() & 0xffff);

    (async () => {
      try {
        const [rig, image] = await Promise.all([
          fetch(asset(RIG), { cache: 'force-cache' }).then((r) => { if (!r.ok) throw new Error('rig'); return r.json() as Promise<LiveAvatarRig>; }),
          new Promise<HTMLImageElement>((resolve, reject) => {
            const img = new Image();
            img.decoding = 'async';
            img.onload = () => resolve(img);
            img.onerror = () => reject(new Error('face'));
            img.src = asset(FACE);
          }),
        ]);
        if (disposed || !canvasRef.current) return;
        const canvas = canvasRef.current;
        renderer = new LiveAvatarRenderer(canvas, prepareRig(rig), image);
        const fit = () => {
          const rect = canvas.getBoundingClientRect();
          const dpr = Math.min(2, window.devicePixelRatio || 1);
          renderer?.resize(Math.max(1, Math.round(rect.width * dpr)), Math.max(1, Math.round(rect.height * dpr)));
        };
        fit();
        observer = new ResizeObserver(fit);
        observer.observe(canvas);
        setMode('live');
        const frame = (now: number) => {
          if (disposed || !renderer) return;
          const speaking = stateRef.current === 'speaking' && ttsLevel.active;
          const params = motion.update({
            timeMs: now,
            state: stateRef.current,
            voiceLevel: speaking ? ttsLevel.value : -1,
            voiceBands: speaking ? ttsLevel.bands : null,
            userLevel: stateRef.current === 'listening' && audioLevel.active ? audioLevel.value : 0,
            reducedMotion: reduced,
          });
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
      <span className="live-avatar-ai-note" aria-hidden="true">Nhân vật AI</span>
    </div>
  );
}
