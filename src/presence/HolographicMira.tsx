import { useCallback, useEffect, useRef } from 'react';
import type { MiraState } from '../core/types';
import { audioLevel } from '../core/audio-level';
import './holographic-mira.css';

interface Props {
  state: MiraState;
  onActivate: () => void;
}

const ART_URL = '/assets/mira-holographic.webp';

export default function HolographicMira({ state, onActivate }: Props) {
  const rootRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let raf = 0;
    let smooth = 0;
    let energy = 0;
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
        ? 0.14 + Math.sin(t / 92) * 0.065 + Math.sin(t / 41) * 0.022
        : listening
          ? 0.075 + Math.sin(t / 160) * 0.035
          : thinking
            ? 0.04 + Math.sin(t / 250) * 0.018
            : 0.008 + Math.sin(t / 1250) * 0.006;

      const raw = active && audioLevel.active ? audioLevel.value : synthetic;
      const target = Math.max(0, Math.min(1, raw));
      smooth += (target - smooth) * (target > smooth ? 0.28 : 0.1);
      energy += (Math.abs(target - smooth) - energy) * 0.14;

      node.style.setProperty('--hm-level', smooth.toFixed(3));
      node.style.setProperty('--hm-energy', Math.min(1, energy * 6).toFixed(3));
      node.style.setProperty('--hm-mouth', (speaking ? Math.max(0.07, smooth) : 0).toFixed(3));
      node.style.setProperty('--hm-breathe', (1 + Math.sin(t / 2100) * 0.0045).toFixed(4));
      node.style.setProperty('--hm-drift-x', `${(Math.sin(t / 2600) * 1.6).toFixed(2)}px`);
      node.style.setProperty('--hm-drift-y', `${(Math.cos(t / 3100) * 1.2).toFixed(2)}px`);
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
    node.style.setProperty('--hm-pointer-x', `${(x * 5).toFixed(2)}px`);
    node.style.setProperty('--hm-pointer-y', `${(y * 4).toFixed(2)}px`);
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
      <img className="hm-reference-art" src={ART_URL} alt="" draggable={false} aria-hidden="true" />

      <span className="hm-atmosphere" aria-hidden="true" />
      <span className="hm-star-field stars-near" aria-hidden="true" />
      <span className="hm-star-field stars-far" aria-hidden="true" />

      <span className="hm-eye-glow eye-left" aria-hidden="true" />
      <span className="hm-eye-glow eye-right" aria-hidden="true" />
      <span className="hm-mouth-motion" aria-hidden="true" />
      <span className="hm-voice-wave" aria-hidden="true">
        {Array.from({ length: 21 }, (_, index) => <i key={index} />)}
      </span>
      <span className="hm-bottom-core" aria-hidden="true" />
      <span className="hm-energy-wash" aria-hidden="true" />

      <span className="sr-only">{label}</span>
    </button>
  );
}
