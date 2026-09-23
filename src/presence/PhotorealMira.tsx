import { useCallback, useEffect, useRef } from 'react';
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react';
import type { MiraState } from '../core/types';
import { audioLevel } from '../core/audio-level';
import './photoreal-mira.css';

interface Props {
  state: MiraState;
  onActivate: () => void;
  contextText?: string;
}

// Resolve public assets through Vite BASE_URL so the same UI works at /
// (Vercel/local) and under /miraai/ (GitHub Pages).
const asset = (path: string) => `${import.meta.env.BASE_URL}${path.replace(/^\/+/, '')}`;

// V3 uses the high-resolution photoreal cutouts/scenes already shipped in public/.
// Keeping these URLs in one map makes it straightforward to swap in the new asset pack
// without touching the voice/state engine.
const POSE_BY_STATE: Record<MiraState, string> = {
  idle: asset('looks/female-idol.png'),
  listening: asset('looks/female-sweater.png'),
  thinking: asset('looks/female-sweater.png'),
  speaking: asset('looks/female-idol.png'),
  interrupted: asset('looks/female-idol.png'),
  error: asset('looks/female-idol.png'),
};

const SCENE_BY_STATE: Record<MiraState, string> = {
  idle: asset('scenes/home.png'),
  listening: asset('scenes/home.png'),
  thinking: asset('scenes/office.png'),
  speaking: asset('scenes/home.png'),
  interrupted: asset('scenes/home.png'),
  error: asset('scenes/home.png'),
};

const COPY_BY_STATE: Record<MiraState, { eyebrow: string; title: string; hint: string }> = {
  idle: { eyebrow: 'MIRA · PRESENT', title: 'Always here, in your space', hint: 'Chạm hoặc nhấn Space để nói' },
  listening: { eyebrow: 'VOICE · LIVE', title: 'Em đang nghe anh', hint: 'Nói tự nhiên, Mira sẽ tự bắt lượt' },
  thinking: { eyebrow: 'MEMORY · CONTEXT', title: 'Đang kết nối ký ức', hint: 'Ghép ngữ cảnh trước khi trả lời' },
  speaking: { eyebrow: 'MIRA · SPEAKING', title: 'Em đang trả lời', hint: 'Anh có thể ngắt lời bất cứ lúc nào' },
  interrupted: { eyebrow: 'VOICE · PAUSED', title: 'Đã dừng', hint: 'Chạm để tiếp tục cuộc trò chuyện' },
  error: { eyebrow: 'MIRA · CHECK', title: 'Cần kiểm tra kết nối', hint: 'Chạm để thử lại' },
};

const PRELOAD = [...Object.values(POSE_BY_STATE), ...new Set(Object.values(SCENE_BY_STATE))];
const WAVE_BARS = Array.from({ length: 31 }, (_, index) => index);
const STARS = Array.from({ length: 28 }, (_, index) => index);

export default function PhotorealMira({ state, onActivate, contextText = '' }: Props) {
  const rootRef = useRef<HTMLButtonElement>(null);
  const copy = COPY_BY_STATE[state];
  const memoryStrength = Math.min(1, contextText.trim().split(/\s+/).filter(Boolean).length / 80);

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
      const live = audioLevel.active ? audioLevel.value : -1;
      const synthetic = state === 'speaking'
        ? 0.18 + Math.sin(elapsed / 92) * 0.07 + Math.sin(elapsed / 41) * 0.025
        : state === 'listening'
          ? 0.09 + Math.sin(elapsed / 170) * 0.035
          : state === 'thinking'
            ? 0.055 + Math.sin(elapsed / 240) * 0.02
            : 0.018 + Math.sin(elapsed / 1100) * 0.007;
      const target = Math.max(0, Math.min(1, live >= 0 ? live : synthetic));
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
    node.style.setProperty('--pm-look-x', `${(x * 12).toFixed(2)}px`);
    node.style.setProperty('--pm-look-y', `${(y * 7).toFixed(2)}px`);
    node.style.setProperty('--pm-scene-x', `${(x * -5).toFixed(2)}px`);
    node.style.setProperty('--pm-scene-y', `${(y * -3).toFixed(2)}px`);
  }, []);

  const resetPointer = useCallback(() => {
    const node = rootRef.current;
    if (!node) return;
    node.style.setProperty('--pm-look-x', '0px');
    node.style.setProperty('--pm-look-y', '0px');
    node.style.setProperty('--pm-scene-x', '0px');
    node.style.setProperty('--pm-scene-y', '0px');
  }, []);

  const label = state === 'listening'
    ? 'Dừng nghe'
    : state === 'speaking' || state === 'thinking'
      ? 'Ngắt Mira'
      : 'Nói với Mira';

  const rootStyle = { '--pm-memory': memoryStrength.toFixed(3) } as CSSProperties;

  return (
    <button
      ref={rootRef}
      type="button"
      className={`photo-mira state-${state}`}
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
      <span className="pm-stars" aria-hidden="true">
        {STARS.map((index) => <i key={index} />)}
      </span>

      <span className="pm-feature-rail" aria-hidden="true">
        <span><i />Voice</span>
        <span><i />Memory</span>
        <span><i />Vision</span>
        <span><i />Spatial AI</span>
      </span>

      <span className="pm-character-zone" aria-hidden="true">
        <span className="pm-character-halo" />
        <img className="pm-character" src={POSE_BY_STATE[state]} alt="" draggable={false} />
        <span className="pm-floor-light" />
      </span>

      <span className="pm-memory-field" aria-hidden="true">
        <i /><i /><i /><i /><i /><i />
      </span>

      <span className="pm-copy" aria-hidden="true">
        <small>{copy.eyebrow}</small>
        <b>{copy.title}</b>
        <span>{copy.hint}</span>
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
