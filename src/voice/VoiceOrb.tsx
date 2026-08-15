import { useEffect, useRef } from 'react';
import type { MiraState } from '../core/types';
import { audioLevel } from '../core/audio-level';
import './voice-orb.css';

interface Props {
  state: MiraState;
  onActivate: () => void;
}

export default function VoiceOrb({ state, onActivate }: Props) {
  const orbRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let raf = 0;
    let smooth = 0;
    const started = performance.now();

    const frame = (now: number) => {
      const node = orbRef.current;
      if (!node) return;

      const activeState = state === 'listening' || state === 'speaking';
      const fallback = activeState ? 0.12 + Math.sin((now - started) / 150) * 0.055 : 0;
      const target = activeState ? (audioLevel.active ? audioLevel.value : fallback) : 0;
      smooth += (Math.max(0, Math.min(1, target)) - smooth) * 0.2;

      node.style.setProperty('--voice-level', smooth.toFixed(3));
      node.style.setProperty('--voice-scale', (1 + smooth * 0.18).toFixed(3));
      node.style.setProperty('--voice-glow', (0.22 + smooth * 0.78).toFixed(3));
      raf = requestAnimationFrame(frame);
    };

    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [state]);

  const label =
    state === 'listening'
      ? 'Dừng nghe'
      : state === 'speaking' || state === 'thinking'
        ? 'Ngắt Mira'
        : 'Nói với Mira';

  return (
    <button
      ref={orbRef}
      type="button"
      className={`voice-orb state-${state}`}
      onClick={onActivate}
      aria-label={label}
    >
      <span className="voice-orb-halo halo-a" aria-hidden="true" />
      <span className="voice-orb-halo halo-b" aria-hidden="true" />
      <span className="voice-orb-core" aria-hidden="true">
        <i className="voice-orb-shine" />
        <i className="voice-orb-depth" />
      </span>
      <span className="sr-only">{label}</span>
    </button>
  );
}
