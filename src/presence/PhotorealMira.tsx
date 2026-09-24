import { useCallback, useEffect, useRef } from 'react';
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react';
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
}

const asset = (path: string) => `${import.meta.env.BASE_URL}${path.startsWith('/') ? path.slice(1) : path}`;
const MIRA_REAL = asset('looks/mira-photoreal.webp');

const POSE_BY_STATE: Record<MiraState, string> = {
  idle: MIRA_REAL,
  listening: MIRA_REAL,
  thinking: MIRA_REAL,
  speaking: MIRA_REAL,
  interrupted: MIRA_REAL,
  error: MIRA_REAL,
};

const SCENE_BY_STATE: Record<MiraState, string> = {
  idle: asset('scenes/home.png'),
  listening: asset('scenes/home.png'),
  thinking: asset('scenes/office.png'),
  speaking: asset('scenes/home.png'),
  interrupted: asset('scenes/home.png'),
  error: asset('scenes/home.png'),
};

const COPY_BY_STATE: Record<MiraState, { eyebrow: string; title: string }> = {
  idle: { eyebrow: 'MIRA · PRESENT', title: 'Em vẫn ở đây.' },
  listening: { eyebrow: 'VOICE · ALWAYS ON', title: 'Em đang nghe anh.' },
  thinking: { eyebrow: 'MEMORY · CONTEXT', title: 'Em đang nghĩ…' },
  speaking: { eyebrow: 'MIRA · SPEAKING', title: 'Em đang trả lời.' },
  interrupted: { eyebrow: 'VOICE · RESUME', title: 'Em nghe tiếp đây.' },
  error: { eyebrow: 'MIRA · CHECK', title: 'Mình kiểm tra kết nối nhé.' },
};

const STATE_LABEL: Record<MiraState, string> = {
  idle: 'READY',
  listening: 'LISTENING',
  thinking: 'THINKING',
  speaking: 'SPEAKING',
  interrupted: 'RESUMING',
  error: 'CHECK',
};

const PRELOAD = [...Object.values(POSE_BY_STATE), ...new Set(Object.values(SCENE_BY_STATE))];
const WAVE_BARS = Array.from({ length: 31 }, (_, index) => index);
const STARS = Array.from({ length: 28 }, (_, index) => index);

export default function PhotorealMira({
  state,
  onActivate,
  contextText = '',
  live = false,
  voiceReady = false,
  caption = '',
  who = 'MIRA',
  brainName = '',
  sttAvailable = true,
  observedMood = 'neutral',
  moodConfidence = 0,
}: Props) {
  const rootRef = useRef<HTMLButtonElement>(null);
  const copy = COPY_BY_STATE[state];
  const memoryStrength = Math.min(1, contextText.trim().split(/\s+/).filter(Boolean).length / 80);
  const brainLabel = /server/i.test(brainName)
    ? 'CLOUD BRAIN'
    : /demo|canned/i.test(brainName)
      ? 'LOCAL FALLBACK'
      : (brainName || 'MIRA BRAIN').toUpperCase();
  const liveLabel = live ? '24/7 ACTIVE' : voiceReady ? 'VOICE READY' : 'CHẠM 1 LẦN ĐỂ BẬT';
  const hint = live
    ? 'Anh cứ nói tự nhiên — không cần chạm lại.'
    : 'Chạm một lần để mở mic và giữ phiên trò chuyện liên tục.';

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
      node.style.setProperty('--pm-breathe', (1 + Math.sin(elapsed / 2100) * 0.0045).toFixed(4));
      node.style.setProperty('--pm-drift-x', `${(Math.sin(elapsed / 3100) * 1.8).toFixed(2)}px`);
      node.style.setProperty('--pm-drift-y', `${(Math.cos(elapsed / 3600) * 1.3).toFixed(2)}px`);
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
    node.style.setProperty('--pm-look-x', `${(x * 10).toFixed(2)}px`);
    node.style.setProperty('--pm-look-y', `${(y * 6).toFixed(2)}px`);
    node.style.setProperty('--pm-scene-x', `${(x * -4).toFixed(2)}px`);
    node.style.setProperty('--pm-scene-y', `${(y * -2).toFixed(2)}px`);
  }, []);

  const resetPointer = useCallback(() => {
    const node = rootRef.current;
    if (!node) return;
    node.style.setProperty('--pm-look-x', '0px');
    node.style.setProperty('--pm-look-y', '0px');
    node.style.setProperty('--pm-scene-x', '0px');
    node.style.setProperty('--pm-scene-y', '0px');
  }, []);

  const rootStyle = { '--pm-memory': memoryStrength.toFixed(3) } as CSSProperties;
  const label = live ? 'Mira đang ở chế độ trò chuyện liên tục' : 'Bật Mira 24/7';

  return (
    <button
      ref={rootRef}
      type="button"
      className={`photo-mira state-${state} user-mood-${observedMood}${live ? ' is-live' : ''}`}
      style={rootStyle}
      onClick={onActivate}
      onPointerMove={handlePointerMove}
      onPointerLeave={resetPointer}
      aria-label={label}
    >
      <span className="pm-scene-shell" aria-hidden="true">
        <img className="pm-scene" src={SCENE_BY_STATE[state]} alt="" draggable={false} />
      </span>
      <span className="pm-scene-shade" aria-hidden="true" />
      <span className="pm-atmosphere" aria-hidden="true" />
      <span className="pm-grid" aria-hidden="true" />
      <span className="pm-stars" aria-hidden="true">{STARS.map((index) => <i key={index} />)}</span>

      <span className="pm-feature-rail" aria-hidden="true">
        <span><i />Voice Loop</span>
        <span><i />Memory</span>
        <span><i />Vision</span>
        <span><i />Spatial AI</span>
      </span>

      <span className="pm-character-zone" aria-hidden="true">
        <span className="pm-character-halo" />
        <span className="pm-character-ring" />
        <img className="pm-character" src={POSE_BY_STATE[state]} alt="" draggable={false} />
        <span className="pm-floor-light" />
      </span>

      <span className="pm-memory-field" aria-hidden="true"><i /><i /><i /><i /><i /><i /></span>

      <span className="pm-copy" aria-hidden="true">
        <small>{copy.eyebrow}</small>
        <b>{copy.title}</b>
        <span>{hint}</span>
      </span>

      <span className="pm-live-pill" aria-hidden="true">
        <i />
        <b>{liveLabel}</b>
        <em>{STATE_LABEL[state]}</em>
      </span>

      <span className="pm-runtime" aria-hidden="true">
        <span className="pm-runtime-head">
          <span><small>MIRA CORE</small><b>Companion Console</b></span>
          <i className={live ? 'online' : ''} />
        </span>
        <span className="pm-runtime-grid">
          <span><small>MIC</small><b>{sttAvailable ? (live ? 'ALWAYS ON' : 'READY') : 'UNAVAILABLE'}</b></span>
          <span><small>VOICE LOOP</small><b>{live ? 'CONTINUOUS' : 'STANDBY'}</b></span>
          <span><small>BRAIN</small><b>{brainLabel}</b></span>
          <span><small>MEMORY</small><b>{Math.round(memoryStrength * 100)}% CONTEXT</b></span>
          <span><small>AFFECT</small><b>{observedMood.toUpperCase()} {Math.round(moodConfidence * 100)}%</b></span>
        </span>
        <span className="pm-caption-card">
          <small>{who || 'MIRA'}</small>
          <b>{caption || (live ? 'Em đang nghe.' : 'Chạm một lần để bắt đầu.')}</b>
        </span>
      </span>

      <span className="pm-wave" aria-hidden="true">{WAVE_BARS.map((index) => <i key={index} />)}</span>
      <span className="pm-state-orb" aria-hidden="true"><i /></span>
      <span className="pm-vignette" aria-hidden="true" />
      <span className="sr-only">{label}</span>
    </button>
  );
}
