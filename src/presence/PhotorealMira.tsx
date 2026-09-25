import { useCallback, useEffect, useRef } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import type { MiraState } from '../core/types';
import type { ObservedMood } from '../intelligence/affect/mood-engine';
import { audioLevel } from '../core/audio-level';
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
}

const asset = (path: string) => `${import.meta.env.BASE_URL}${path.startsWith('/') ? path.slice(1) : path}`;
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
}: Props) {
  const rootRef = useRef<HTMLButtonElement>(null);
  const liveLabel = live ? '24/7 ACTIVE' : voiceReady ? 'VOICE READY' : 'CHẠM 1 LẦN ĐỂ BẬT';
  const label = live ? 'Mira đang ở chế độ trò chuyện liên tục' : 'Bật Mira 24/7';

  useEffect(() => {
    const node = rootRef.current;
    if (!node) return;
    const strength = affectActive && affectFollowing
      ? Math.max(0, Math.min(1, Number(moodConfidence) || 0))
      : 0;
    node.style.setProperty('--pm-affect', strength.toFixed(3));
  }, [affectActive, affectFollowing, moodConfidence]);

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
    const x = (event.clientX - rect.left) / rect.width - 0.5;
    const y = (event.clientY - rect.top) / rect.height - 0.5;
    node.style.setProperty('--pm-scene-x', `${(x * -3.2).toFixed(2)}px`);
    node.style.setProperty('--pm-scene-y', `${(y * -1.8).toFixed(2)}px`);
  }, []);

  const resetPointer = useCallback(() => {
    const node = rootRef.current;
    if (!node) return;
    node.style.setProperty('--pm-scene-x', '0px');
    node.style.setProperty('--pm-scene-y', '0px');
  }, []);

  return (
    <button
      ref={rootRef}
      type="button"
      className={`photo-mira bedroom-presence state-${state} user-mood-${observedMood}${live ? ' is-live' : ''}${affectActive ? ' affect-active' : ''}${affectFollowing ? ' affect-follow' : ''}`}
      onClick={onActivate}
      onPointerMove={handlePointerMove}
      onPointerLeave={resetPointer}
      aria-label={label}
    >
      <span className="pm-scene-shell" aria-hidden="true">
        <img className="pm-scene pm-bedroom-scene" src={SCENE_BY_STATE[state]} alt="" draggable={false} />
      </span>

      <span className="pm-bedroom-tint" aria-hidden="true" />

      <span className="pm-live-pill" aria-hidden="true">
        <i />
        <b>{liveLabel}</b>
        <em>{STATE_LABEL[state]}</em>
      </span>

      <span className="pm-wave" aria-hidden="true">
        {WAVE_BARS.map((index) => <i key={index} />)}
      </span>

      <span className="pm-state-orb" aria-hidden="true"><i /></span>
      <span className="pm-vignette" aria-hidden="true" />
      <span className="sr-only">{label}</span>
    </button>
  );
}
