import type { RefObject } from 'react';

// Dock tối giản: caption + sóng + orb mic (chạm = bắt đầu/dừng trò chuyện trực tiếp).
// Chọn giọng / màu / demo nằm trong ⌘ Cài đặt.
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
        <svg viewBox="0 0 24 24">
          <path d="M12 15a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3Zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V22h2v-3.08A7 7 0 0 0 19 12h-2Z" />
        </svg>
      </button>

      <div className="hint">
        {live ? (
          <>
            Đang trò chuyện · chạm <b>mic</b> để dừng · <b>Space</b> để ngắt lời
          </>
        ) : (
          <>
            Chạm <b>mic</b> để bắt đầu trò chuyện
          </>
        )}
      </div>
    </footer>
  );
}
