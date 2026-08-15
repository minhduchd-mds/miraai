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
    let energy = 0;
    const started = performance.now();

    const frame = (now: number) => {
      const node = orbRef.current;
      if (!node) return;

      const listening = state === 'listening';
      const speaking = state === 'speaking';
      const active = listening || speaking;
      const t = now - started;
      const synthetic = active
        ? speaking
          ? 0.16 + Math.sin(t / 96) * 0.065 + Math.sin(t / 43) * 0.025
          : 0.10 + Math.sin(t / 145) * 0.045
        : state === 'thinking'
          ? 0.055 + Math.sin(t / 230) * 0.025
          : 0.018 + Math.sin(t / 900) * 0.012;
      const raw = active && audioLevel.active ? audioLevel.value : synthetic;
      const target = Math.max(0, Math.min(1, raw));
      smooth += (target - smooth) * (target > smooth ? 0.28 : 0.12);
      energy += (Math.abs(target - smooth) - energy) * 0.16;

      const driftX = Math.sin(t / 1180) * 2.2;
      const driftY = Math.cos(t / 1370) * 1.8;
      node.style.setProperty('--voice-level', smooth.toFixed(3));
      node.style.setProperty('--voice-energy', Math.min(1, energy * 5.5).toFixed(3));
      node.style.setProperty('--voice-scale', (1 + smooth * 0.16).toFixed(3));
      node.style.setProperty('--voice-glow', (0.28 + smooth * 0.72).toFixed(3));
      node.style.setProperty('--orb-drift-x', `${driftX.toFixed(2)}px`);
      node.style.setProperty('--orb-drift-y', `${driftY.toFixed(2)}px`);
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
      <span className="voice-orb-ambient" aria-hidden="true" />
      <span className="voice-orb-ring ring-outer" aria-hidden="true" />
      <span className="voice-orb-ring ring-mid" aria-hidden="true" />
      <span className="voice-orb-ring ring-inner" aria-hidden="true" />

      <span className="voice-orb-ripple ripple-a" aria-hidden="true" />
      <span className="voice-orb-ripple ripple-b" aria-hidden="true" />
      <span className="voice-orb-ripple ripple-c" aria-hidden="true" />

      <span className="voice-orb-particles" aria-hidden="true">
        <i className="p1" /><i className="p2" /><i className="p3" /><i className="p4" />
        <i className="p5" /><i className="p6" /><i className="p7" /><i className="p8" />
      </span>

      <span className="voice-orb-core" aria-hidden="true">
        <i className="voice-orb-plasma plasma-a" />
        <i className="voice-orb-plasma plasma-b" />
        <i className="voice-orb-membrane" />
        <i className="voice-orb-shine" />
        <i className="voice-orb-depth" />
        <i className="voice-orb-spark" />
      </span>
      <span className="sr-only">{label}</span>
    </button>
  );
}
