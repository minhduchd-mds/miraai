import { useState, type RefObject } from 'react';
import type { MiraState, Theme, VoiceOption } from '../core/types';

interface Props {
  who: string;
  caption: string;
  partial: boolean;
  state: MiraState;
  waveRef: RefObject<HTMLDivElement>;
  micRef: RefObject<HTMLButtonElement>;
  voices: VoiceOption[];
  voiceURI?: string;
  onSelectVoice: (uri: string) => void;
  onMic: () => void;
  onGoState: (s: MiraState, speakIt?: boolean) => void;
  onSimulate: () => void;
  simulating: boolean;
  theme: Theme;
  onTheme: (t: Theme) => void;
  live: boolean;
  onToggleLive: () => void;
}

const STATE_BTNS: { go: MiraState; label: string; warn?: boolean }[] = [
  { go: 'idle', label: 'Idle' },
  { go: 'listening', label: 'Listening' },
  { go: 'thinking', label: 'Thinking' },
  { go: 'speaking', label: 'Speaking' },
  { go: 'interrupted', label: 'Ngắt lời', warn: true },
];

export default function VoiceDock({
  who, caption, partial, state, waveRef, micRef,
  voices, voiceURI, onSelectVoice, onMic, onGoState, onSimulate, simulating,
  theme, onTheme, live, onToggleLive,
}: Props) {
  const [showDebug, setShowDebug] = useState(false);
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

      <button
        className={`livebtn${live ? ' on' : ''}`}
        onClick={onToggleLive}
        aria-pressed={live}
      >
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

      {/* Hàng điều khiển tối giản (kiểu Grok): chỉ giọng + màu + nút "⋯" mở công cụ demo. */}
      <div className="controls">
        {voices.length > 0 && (
          <select
            className="vsel"
            value={voiceURI}
            onChange={(e) => onSelectVoice(e.target.value)}
            title="Chọn giọng đọc"
          >
            {voices.map((v) => (
              <option key={v.voiceURI} value={v.voiceURI}>
                {v.name} ({v.lang})
              </option>
            ))}
          </select>
        )}

        <div className="themes">
          <span className="tl">Màu</span>
          {(['nova', 'aura', 'ember', 'iris'] as const).map((t) => (
            <button
              key={t}
              className={`sw ${t}`}
              aria-pressed={theme === t}
              onClick={() => onTheme(t)}
              title={t[0].toUpperCase() + t.slice(1)}
            />
          ))}
        </div>

        <button
          className="dbg-toggle"
          aria-pressed={showDebug}
          onClick={() => setShowDebug((v) => !v)}
          title="Công cụ demo (trạng thái + mô phỏng)"
        >
          ⋯
        </button>
      </div>

      {/* Công cụ demo — ẩn mặc định để giao diện gọn như Grok voice. */}
      {showDebug && (
        <div className="controls dbg">
          <div className="seg" role="group" aria-label="Trạng thái demo">
            {STATE_BTNS.map((b) => (
              <button
                key={b.go}
                className={b.warn ? 'warn' : undefined}
                aria-pressed={state === b.go}
                onClick={() => onGoState(b.go, b.go === 'speaking')}
              >
                {b.label}
              </button>
            ))}
          </div>
          <div className="seg">
            <button onClick={onSimulate}>
              {simulating ? '■ Dừng' : '▶ Mô phỏng hội thoại'}
            </button>
          </div>
        </div>
      )}
    </footer>
  );
}
