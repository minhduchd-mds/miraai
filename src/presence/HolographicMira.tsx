import { useCallback, useEffect, useRef } from 'react';
import type { MiraState } from '../core/types';
import { audioLevel } from '../core/audio-level';
import './holographic-mira.css';
import './holographic-mira-godmode.css';

interface Props {
  state: MiraState;
  onActivate: () => void;
}

const ART_URL = '/assets/mira-holographic.webp';
const STAR_COUNT = 54;
const DUST_COUNT = 24;
const COMET_COUNT = 6;
const BURST_COUNT = 8;
const GOD_STAR_COUNT = 96;
const GLINT_COUNT = 14;

export default function HolographicMira({ state, onActivate }: Props) {
  const rootRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let raf = 0;
    let smooth = 0;
    let energy = 0;
    let beat = 0;
    const started = performance.now();

    const frame = (now: number) => {
      const node = rootRef.current;
      if (!node) return;

      const t = now - started;
      const speaking = state === 'speaking';
      const listening = state === 'listening';
      const thinking = state === 'thinking';
      const active = speaking || listening;
      const synthetic = speaking
        ? 0.16 + Math.sin(t / 86) * 0.072 + Math.sin(t / 37) * 0.026
        : listening
          ? 0.09 + Math.sin(t / 145) * 0.044
          : thinking
            ? 0.052 + Math.sin(t / 215) * 0.022
            : 0.012 + Math.sin(t / 980) * 0.008;

      const raw = active && audioLevel.active ? audioLevel.value : synthetic;
      const target = Math.max(0, Math.min(1, raw));
      smooth += (target - smooth) * (target > smooth ? 0.31 : 0.105);
      const delta = Math.abs(target - smooth);
      energy += (delta - energy) * 0.18;
      beat += ((smooth > 0.22 ? smooth : 0) - beat) * 0.16;

      node.style.setProperty('--hm-level', smooth.toFixed(3));
      node.style.setProperty('--hm-energy', Math.min(1, energy * 7).toFixed(3));
      node.style.setProperty('--hm-beat', Math.min(1, beat * 1.9).toFixed(3));
      node.style.setProperty('--hm-mouth', (speaking ? Math.max(0.075, smooth) : 0).toFixed(3));
      node.style.setProperty('--hm-breathe', (1 + Math.sin(t / 2100) * 0.0042).toFixed(4));
      node.style.setProperty('--hm-drift-x', `${(Math.sin(t / 2800) * 1.8).toFixed(2)}px`);
      node.style.setProperty('--hm-drift-y', `${(Math.cos(t / 3200) * 1.4).toFixed(2)}px`);
      node.style.setProperty('--hm-phase', ((Math.sin(t / 1700) + 1) / 2).toFixed(3));
      raf = requestAnimationFrame(frame);
    };

    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [state]);

  const handlePointerMove = useCallback((event: React.PointerEvent<HTMLButtonElement>) => {
    const node = rootRef.current;
    if (!node) return;
    const rect = node.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width - 0.5;
    const y = (event.clientY - rect.top) / rect.height - 0.5;
    node.style.setProperty('--hm-pointer-x', `${(x * 7).toFixed(2)}px`);
    node.style.setProperty('--hm-pointer-y', `${(y * 5).toFixed(2)}px`);
  }, []);

  const resetPointer = useCallback(() => {
    const node = rootRef.current;
    if (!node) return;
    node.style.setProperty('--hm-pointer-x', '0px');
    node.style.setProperty('--hm-pointer-y', '0px');
  }, []);

  const label =
    state === 'listening'
      ? 'Dừng nghe'
      : state === 'speaking' || state === 'thinking'
        ? 'Ngắt Mira'
        : 'Nói với Mira';

  return (
    <button
      ref={rootRef}
      type="button"
      className={`holo-mira state-${state}`}
      onClick={onActivate}
      onPointerMove={handlePointerMove}
      onPointerLeave={resetPointer}
      aria-label={label}
    >
      <span className="hm-deep-space" aria-hidden="true" />
      <span className="hm-galaxy-band galaxy-a" aria-hidden="true" />
      <span className="hm-galaxy-band galaxy-b" aria-hidden="true" />
      <span className="hm-galaxy-band galaxy-c" aria-hidden="true" />
      <span className="hm-nebula-cloud cloud-left" aria-hidden="true" />
      <span className="hm-nebula-cloud cloud-right" aria-hidden="true" />

      <span className="hm-cosmos-stars" aria-hidden="true">
        {Array.from({ length: STAR_COUNT }, (_, index) => <i key={index} />)}
      </span>
      <span className="hm-cosmic-dust" aria-hidden="true">
        {Array.from({ length: DUST_COUNT }, (_, index) => <i key={index} />)}
      </span>
      <span className="hm-star-bursts" aria-hidden="true">
        {Array.from({ length: BURST_COUNT }, (_, index) => <i key={index} />)}
      </span>
      <span className="hm-comets" aria-hidden="true">
        {Array.from({ length: COMET_COUNT }, (_, index) => <i key={index} />)}
      </span>

      <span className="hm-god-stars" aria-hidden="true">
        {Array.from({ length: GOD_STAR_COUNT }, (_, index) => <i key={index} />)}
      </span>
      <span className="hm-luxury-glints" aria-hidden="true">
        {Array.from({ length: GLINT_COUNT }, (_, index) => <i key={index} />)}
      </span>
      <span className="hm-light-dust dust-front-a" aria-hidden="true" />
      <span className="hm-light-dust dust-front-b" aria-hidden="true" />
      <span className="hm-light-rays rays-a" aria-hidden="true" />
      <span className="hm-light-rays rays-b" aria-hidden="true" />
      <span className="hm-light-rays rays-c" aria-hidden="true" />

      <span className="hm-orbit orbit-outer" aria-hidden="true" />
      <span className="hm-orbit orbit-mid" aria-hidden="true" />
      <span className="hm-orbit orbit-inner" aria-hidden="true" />
      <span className="hm-lens-ring lens-a" aria-hidden="true" />
      <span className="hm-lens-ring lens-b" aria-hidden="true" />

      <span className="hm-crown-halo crown-a" aria-hidden="true" />
      <span className="hm-crown-halo crown-b" aria-hidden="true" />

      <span className="hm-art-wrap" aria-hidden="true">
        <img className="hm-reference-art" src={ART_URL} alt="" draggable={false} />
        <span className="hm-holo-scan" />
      </span>

      <span className="hm-aurora aurora-a" aria-hidden="true" />
      <span className="hm-aurora aurora-b" aria-hidden="true" />
      <span className="hm-aurora aurora-c" aria-hidden="true" />
      <span className="hm-presence-glow" aria-hidden="true" />
      <span className="hm-energy-veil" aria-hidden="true" />
      <span className="hm-eye-glow eye-left" aria-hidden="true" />
      <span className="hm-eye-glow eye-right" aria-hidden="true" />
      <span className="hm-mouth-motion" aria-hidden="true" />

      <span className="hm-voice-wave" aria-hidden="true">
        {Array.from({ length: 29 }, (_, index) => <i key={index} />)}
      </span>
      <span className="hm-speech-ripple ripple-a" aria-hidden="true" />
      <span className="hm-speech-ripple ripple-b" aria-hidden="true" />
      <span className="hm-speech-ripple ripple-c" aria-hidden="true" />
      <span className="hm-speaking-pulse pulse-near" aria-hidden="true" />
      <span className="hm-speaking-pulse pulse-far" aria-hidden="true" />

      <span className="hm-voice-sigil" aria-hidden="true">
        <i /><i /><i /><i /><i /><i /><i />
      </span>
      <span className="hm-activation-flash" aria-hidden="true" />
      <span className="hm-cinematic-vignette" aria-hidden="true" />

      <span className="sr-only">{label}</span>
    </button>
  );
}
