import type { RefObject } from 'react';
import { IconMic } from './icons';

// Dock tối giản: caption + sóng + orb mic (chạm = bắt đầu/dừng trò chuyện trực tiếp).
// Chọn giọng / màu / demo nằm trong Cài đặt.
interface Props {
  who: string;
  caption: string;
  partial: boolean;
  waveRef: RefObject<HTMLDivElement>;
  micRef: RefObject<HTMLButtonElement>;
  live: boolean;
  onToggleLive: () => void;
}

export default function VoiceDock({ who, caption, partial, waveRef, micRef, live, onToggleLive }: Props) {
  return (
    <footer className="dock">
      <div className="caption" aria-live="polite">
        <div className="who">{who}</div>
        <div className="txt">
          {caption}
          {partial && <span className="cursor" />}
        </div>
      </div>

      <div className="wave" ref={waveRef} aria-hidden="true" />

      <button
        className={`mic${live ? ' live' : ''}`}
        ref={micRef}
        onClick={onToggleLive}
        aria-pressed={live}
        aria-label={live ? 'Dừng trò chuyện' : 'Chạm để trò chuyện'}
      >
        <IconMic />
      </button>
    </footer>
  );
}
