import type { RefObject } from 'react';

// Dock tối giản (kiểu Grok): chỉ caption + sóng + orb mic + nút trò chuyện.
// Chọn giọng / màu / công cụ demo đã chuyển vào ⌘ Cài đặt.
interface Props {
  who: string;
  caption: string;
  partial: boolean;
  waveRef: RefObject<HTMLDivElement>;
  micRef: RefObject<HTMLButtonElement>;
  onMic: () => void;
  live: boolean;
  onToggleLive: () => void;
}

export default function VoiceDock({ who, caption, partial, waveRef, micRef, onMic, live, onToggleLive }: Props) {
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

      <button className="mic" ref={micRef} aria-label="Nhấn để nói" onClick={onMic}>
        <svg viewBox="0 0 24 24">
          <path d="M12 15a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3Zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V22h2v-3.08A7 7 0 0 0 19 12h-2Z" />
        </svg>
      </button>

      <button className={`livebtn${live ? ' on' : ''}`} onClick={onToggleLive} aria-pressed={live}>
        <span className="ldot" />
        {live ? 'Dừng trò chuyện' : 'Trò chuyện trực tiếp'}
      </button>

      <div className="hint">
        {live ? (
          <>
            Đang trò chuyện liên tục · nói xong Mira tự nghe lại · <b>mic / Space</b> để ngắt lời
          </>
        ) : (
          <>
            <b>Mic</b> nói một lượt · <b>Trò chuyện trực tiếp</b> nói qua lại đến khi bấm Dừng
          </>
        )}
      </div>
    </footer>
  );
}
