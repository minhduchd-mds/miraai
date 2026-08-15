import { useEffect, useRef } from 'react';
import type { MiraState } from '../core/types';
import { audioLevel } from '../core/audio-level';
import './holographic-mira.css';

interface Props {
  state: MiraState;
  onActivate: () => void;
}

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
        ? 0.16 + Math.sin(t / 92) * 0.07 + Math.sin(t / 39) * 0.025
        : listening
          ? 0.09 + Math.sin(t / 145) * 0.04
          : thinking
            ? 0.055 + Math.sin(t / 230) * 0.02
            : 0.012 + Math.sin(t / 1100) * 0.008;
      const raw = active && audioLevel.active ? audioLevel.value : synthetic;
      const target = Math.max(0, Math.min(1, raw));
      smooth += (target - smooth) * (target > smooth ? 0.3 : 0.11);
      energy += (Math.abs(target - smooth) - energy) * 0.14;

      node.style.setProperty('--hm-level', smooth.toFixed(3));
      node.style.setProperty('--hm-energy', Math.min(1, energy * 5.5).toFixed(3));
      node.style.setProperty('--hm-mouth', (speaking ? Math.max(0.08, smooth) : 0.02).toFixed(3));
      node.style.setProperty('--hm-drift-x', `${(Math.sin(t / 2100) * 3.4).toFixed(2)}px`);
      node.style.setProperty('--hm-drift-y', `${(Math.cos(t / 2450) * 2.6).toFixed(2)}px`);
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
      ref={rootRef}
      type="button"
      className={`holo-mira state-${state}`}
      onClick={onActivate}
      aria-label={label}
    >
      <span className="hm-nebula hm-nebula-left" aria-hidden="true" />
      <span className="hm-nebula hm-nebula-right" aria-hidden="true" />
      <span className="hm-stars stars-a" aria-hidden="true" />
      <span className="hm-stars stars-b" aria-hidden="true" />
      <span className="hm-energy-ribbon ribbon-a" aria-hidden="true" />
      <span className="hm-energy-ribbon ribbon-b" aria-hidden="true" />

      <svg className="hm-scene" viewBox="0 0 900 760" aria-hidden="true" focusable="false">
        <defs>
          <radialGradient id="hmFace" cx="50%" cy="34%" r="68%">
            <stop offset="0%" stopColor="#d8e2ff" stopOpacity=".28" />
            <stop offset="48%" stopColor="#8197ff" stopOpacity=".20" />
            <stop offset="100%" stopColor="#5668dd" stopOpacity=".07" />
          </radialGradient>
          <linearGradient id="hmBody" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#dce7ff" stopOpacity=".24" />
            <stop offset="55%" stopColor="#849aff" stopOpacity=".15" />
            <stop offset="100%" stopColor="#6973ef" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="hmLine" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#6f84ff" stopOpacity="0" />
            <stop offset="50%" stopColor="#dce8ff" stopOpacity=".92" />
            <stop offset="100%" stopColor="#8877ff" stopOpacity="0" />
          </linearGradient>
          <filter id="hmGlow" x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur stdDeviation="7" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <filter id="hmSoft" x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur stdDeviation="22" />
          </filter>
          <clipPath id="hmBustClip">
            <path d="M450 126C390 126 350 170 350 236c0 52 23 102 60 124l-8 58c-71 16-126 49-168 104-27 35-44 85-49 144h530c-5-59-22-109-49-144-42-55-97-88-168-104l-8-58c37-22 60-72 60-124 0-66-40-110-100-110Z" />
          </clipPath>
        </defs>

        <g className="hm-orbits">
          <ellipse className="orbit orbit-1" cx="450" cy="340" rx="310" ry="245" />
          <ellipse className="orbit orbit-2" cx="450" cy="340" rx="255" ry="205" />
          <ellipse className="orbit orbit-3" cx="450" cy="340" rx="205" ry="165" />
          <circle className="orbit-dot dot-1" cx="710" cy="285" r="3" />
          <circle className="orbit-dot dot-2" cx="214" cy="428" r="2.4" />
          <circle className="orbit-dot dot-3" cx="608" cy="146" r="2" />
        </g>

        <g className="hm-aura" filter="url(#hmSoft)">
          <ellipse cx="450" cy="328" rx="170" ry="230" fill="#677cff" opacity=".11" />
          <ellipse cx="450" cy="500" rx="250" ry="160" fill="#9b74ff" opacity=".07" />
        </g>

        <g className="hm-body" filter="url(#hmGlow)">
          <path
            className="hm-torso-shape"
            d="M410 352c-5 31-10 50-20 61-76 17-136 50-177 107-31 42-46 91-50 154h574c-4-63-19-112-50-154-41-57-101-90-177-107-10-11-15-30-20-61Z"
            fill="url(#hmBody)"
          />
          <path
            className="hm-neck-shape"
            d="M404 337c8 45 8 67-4 84 34 29 66 37 100 0-12-17-12-39-4-84Z"
            fill="url(#hmFace)"
            stroke="#aabaff"
            strokeOpacity=".32"
          />
          <path
            className="hm-face-shape"
            d="M450 126c-59 0-98 43-98 108 0 68 35 132 98 132s98-64 98-132c0-65-39-108-98-108Z"
            fill="url(#hmFace)"
            stroke="#c3d0ff"
            strokeOpacity=".42"
          />

          <path className="hm-hairline" d="M359 209c7-57 38-91 91-91s84 34 91 91c-16-28-48-43-91-43s-75 15-91 43Z" />

          <g className="hm-eyes">
            <g className="hm-eye eye-left">
              <path d="M385 238c15-12 30-12 45 0-14 10-30 10-45 0Z" />
              <ellipse cx="407" cy="238" rx="6" ry="6" />
              <circle cx="407" cy="238" r="2.1" />
            </g>
            <g className="hm-eye eye-right">
              <path d="M470 238c15-12 30-12 45 0-14 10-30 10-45 0Z" />
              <ellipse cx="492" cy="238" rx="6" ry="6" />
              <circle cx="492" cy="238" r="2.1" />
            </g>
          </g>

          <path className="hm-nose" d="M449 244c-2 18-4 33-10 43 7 5 15 5 23 0" />
          <g className="hm-mouth">
            <path className="hm-lip-line" d="M422 310c18 9 38 9 56 0" />
            <ellipse className="hm-mouth-core" cx="450" cy="314" rx="20" ry="5" />
          </g>

          <path className="hm-collar-line" d="M350 456c69-34 131-34 200 0" />
          <path className="hm-shoulder-line" d="M211 526c99-66 178-77 239-43 61-34 140-23 239 43" />

          <g clipPath="url(#hmBustClip)" className="hm-constellation">
            <path d="M305 516 370 468 421 500 468 452 529 493 604 455" />
            <path d="M332 590 390 548 450 584 507 538 571 574" />
            <path d="M386 181 418 211 449 184 483 216 519 185" />
            <circle cx="370" cy="468" r="3" /><circle cx="421" cy="500" r="2.4" />
            <circle cx="468" cy="452" r="3.5" /><circle cx="529" cy="493" r="2.6" />
            <circle cx="390" cy="548" r="2.8" /><circle cx="450" cy="584" r="3" />
            <circle cx="507" cy="538" r="2.3" /><circle cx="449" cy="184" r="2.6" />
          </g>

          <g className="hm-hands">
            <path className="hm-hand hand-left" d="M298 620c36-21 69-33 101-33 18 0 27 11 23 25-6 18-30 30-52 37-31 10-59 12-80 5-12-4-8-25 8-34Z" />
            <path className="hm-hand hand-right" d="M602 620c-36-21-69-33-101-33-18 0-27 11-23 25 6 18 30 30 52 37 31 10 59 12 80 5 12-4 8-25-8-34Z" />
          </g>
        </g>

        <g className="hm-waveform" filter="url(#hmGlow)">
          <path d="M164 390h78l8-9 10 20 12-42 11 58 13-30 12 15 15-12 12 8h78l9-12 10 24 11-52 11 64 12-35 11 18 14-10 14 15h83l10-15 11 30 11-44 11 52 13-25 10 12 15-10h80" />
        </g>

        <g className="hm-sparkles">
          <circle cx="327" cy="182" r="2" /><circle cx="562" cy="225" r="1.6" />
          <circle cx="615" cy="386" r="2" /><circle cx="294" cy="422" r="1.5" />
          <circle cx="536" cy="554" r="1.8" /><circle cx="363" cy="575" r="1.4" />
          <circle cx="451" cy="425" r="2.5" />
        </g>
      </svg>

      <span className="hm-voice-sigil" aria-hidden="true">
        <i /><i /><i /><i /><i />
      </span>
      <span className="sr-only">{label}</span>
    </button>
  );
}
