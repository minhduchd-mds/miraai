import { useCallback, useEffect, useRef, useState } from 'react';
import type { MiraState } from '../core/types';
import type { UseMira } from '../core/useMira';
import { useLiveConversation } from '../core/live/useLiveConversation';
import { isAdultConfirmed, voicePrefs } from '../core/voice-prefs';
import { IconMic, IconPhoneOff } from '../ui/app-shell-icons';

// Voice dock: chained voice (mic button), Mira Live realtime (LIVE button) and the
// mandatory text composer. Lazy-loaded so AppV2's boot graph stays within budget.

export interface LiveTalkView {
  state: MiraState;
  caption: string;
  who: string;
  error: string | null;
  /** E4: Live speech-end → first audio, p50 over the session. */
  latency?: { p50: number; n: number } | null;
}

interface Props {
  mira: UseMira;
  activateVoice: () => void;
  voiceSessionActive: boolean;
  idleLabel: string;
  stateCopy: Record<MiraState, string>;
  talk: { state: MiraState; caption: string };
  onLiveView: (view: LiveTalkView | null) => void;
}

export default function VoiceDock({ mira, activateVoice, voiceSessionActive, idleLabel, stateCopy, talk, onLiveView }: Props) {
  const liveTalk = useLiveConversation({
    persona: () => voicePrefs.persona,
    adultConfirmed: isAdultConfirmed,
    recallContext: mira.recallContext,
    recordTurn: (turn) => { void mira.recordTurn(turn); },
  });
  const [text, setText] = useState('');
  const [transcriptOpen, setTranscriptOpen] = useState(true);
  const logRef = useRef<HTMLDivElement | null>(null);
  const turns = mira.transcript;
  const lastTurnId = turns.length ? turns[turns.length - 1].id : 0;

  // Keep the newest line in view (the log is bottom-anchored like a chat).
  useEffect(() => {
    const el = logRef.current;
    if (el && transcriptOpen) el.scrollTop = el.scrollHeight;
  }, [lastTurnId, transcriptOpen]);

  useEffect(() => {
    onLiveView(liveTalk.active || liveTalk.error
      ? { state: liveTalk.state, caption: liveTalk.caption, who: liveTalk.who, error: liveTalk.error, latency: liveTalk.latency }
      : null);
  }, [liveTalk.active, liveTalk.caption, liveTalk.error, liveTalk.latency, liveTalk.state, liveTalk.who, onLiveView]);

  const toggleRealtime = useCallback(() => {
    if (liveTalk.active) { liveTalk.stop(); return; }
    if (mira.live) mira.stopLive();
    mira.unlockAudio();
    void liveTalk.start();
  }, [liveTalk, mira]);

  const submit = useCallback((event: { preventDefault: () => void }) => {
    event.preventDefault();
    const message = text.trim();
    if (!message) return;
    if (liveTalk.active) liveTalk.sendText(message);
    else mira.sendText(message);
    setText('');
  }, [liveTalk, mira, text]);

  const live = liveTalk.active;
  const inSession = mira.live || live;
  const hasTurns = turns.length > 0;
  // The transcript now carries answers; the caption is only for transient states
  // (listening / thinking / Live streaming) or the first-run hint.
  // An idle caption that differs from the default hint is a notice ("Em tạm dừng nghe…").
  const idleNotice = talk.state === 'idle' && Boolean(talk.caption) && talk.caption !== mira.idleCaption;
  const showCaption = live || (talk.state !== 'idle' && talk.state !== 'speaking') || !hasTurns || idleNotice;
  return (
    <section className={`voice-footer state-${talk.state}${inSession ? ' is-live' : ''}${live ? ' is-realtime' : ''}`} aria-label="Trò chuyện với Mira">
      {hasTurns && (
        <section className={`voice-transcript${transcriptOpen ? '' : ' collapsed'}`} aria-label="Hội thoại">
          <button
            type="button"
            className="voice-transcript-toggle"
            onClick={() => setTranscriptOpen((open) => !open)}
            aria-expanded={transcriptOpen}
          >
            {transcriptOpen ? 'Ẩn hội thoại' : `Hiện hội thoại · ${turns.length}`}
          </button>
          {transcriptOpen && (
            <div ref={logRef} className="voice-transcript-log" role="log" aria-live="polite" aria-relevant="additions">
              <ol className="voice-transcript-list">
              {turns.map((turn) => (
                <li key={turn.id} className={`voice-turn ${turn.role}${turn.failed ? ' failed' : ''}`}>
                  <span className="sr-only">{turn.role === 'user' ? 'Anh: ' : 'Mira: '}</span>
                  <p>{turn.text}</p>
                  {turn.failed && turn.id === lastTurnId && mira.retryText && (
                    <button type="button" className="voice-turn-retry" onClick={mira.retryLast}>Thử lại</button>
                  )}
                </li>
              ))}
              </ol>
            </div>
          )}
        </section>
      )}
      {showCaption && (
        <div className="voice-session-caption" aria-hidden="true">
          {talk.state !== 'idle' && <small>{live ? `Live · ${stateCopy[talk.state]}` : stateCopy[talk.state]}</small>}
          <span>{talk.state === 'idle' && !live ? talk.caption || idleLabel : talk.caption}</span>
        </div>
      )}
      <div className="voice-control-dock">
        <span className="voice-wave-mini" aria-hidden="true">
          {Array.from({ length: 9 }, (_, index) => <i key={index} />)}
        </span>
        <button
          type="button"
          className={`voice-realtime${live ? ' active' : ''}`}
          onClick={toggleRealtime}
          aria-pressed={live}
          aria-label={live ? 'Kết thúc Mira Live' : 'Bắt đầu Mira Live — nói chuyện thời gian thực'}
          title={live ? 'Kết thúc Mira Live' : 'Mira Live'}
          data-spatial-action="voice.realtime"
          data-spatial-label="Mira Live"
        >
          <span aria-hidden="true">LIVE</span>
        </button>
        <button
          type="button"
          className={`voice-primary state-${mira.state}${voiceSessionActive ? ' active' : ''}`}
          disabled={live}
          onClick={mira.live ? mira.toggleMic : activateVoice}
          aria-label={mira.live ? 'Điều khiển micro Mira' : 'Bắt đầu trò chuyện bằng giọng nói'}
          title={mira.live ? stateCopy[mira.state] : 'Nói với Mira'}
          data-spatial-action="voice.primary"
          data-spatial-label="Nói với Mira"
        >
          <IconMic />
        </button>
        {inSession && <button
          type="button"
          className="voice-end"
          onClick={live ? liveTalk.stop : mira.stopLive}
          aria-label="Kết thúc trò chuyện"
          title="Kết thúc trò chuyện"
          data-spatial-action="voice.end"
          data-spatial-label="Kết thúc trò chuyện"
        >
          <IconPhoneOff />
        </button>}
      </div>
      <form className="voice-composer" onSubmit={submit}>
        <label className="sr-only" htmlFor="mira-composer">Nhắn cho Mira</label>
        <input
          id="mira-composer"
          type="text"
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder={live ? 'Gõ vào cuộc gọi Live…' : 'Nhắn cho Mira…'}
          autoComplete="off"
          enterKeyHint="send"
          maxLength={2000}
        />
        <button type="submit" disabled={!text.trim()} aria-label="Gửi tin nhắn">Gửi</button>
      </form>
    </section>
  );
}
