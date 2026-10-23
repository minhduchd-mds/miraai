import { useCallback, useEffect, useState } from 'react';
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

  useEffect(() => {
    onLiveView(liveTalk.active || liveTalk.error
      ? { state: liveTalk.state, caption: liveTalk.caption, who: liveTalk.who, error: liveTalk.error }
      : null);
  }, [liveTalk.active, liveTalk.caption, liveTalk.error, liveTalk.state, liveTalk.who, onLiveView]);

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
  return (
    <div className={`voice-footer state-${talk.state}${mira.live || live ? ' is-live' : ''}${live ? ' is-realtime' : ''}`}>
      <div className="voice-session-caption" aria-hidden="true">
        <small>{talk.state === 'idle' ? idleLabel : live ? `Live · ${stateCopy[talk.state]}` : stateCopy[talk.state]}</small>
        <span>{talk.caption}</span>
      </div>
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
        <button
          type="button"
          className="voice-end"
          onClick={live ? liveTalk.stop : mira.stopLive}
          disabled={!mira.live && !live}
          aria-label="Kết thúc trò chuyện"
          title="Kết thúc trò chuyện"
          data-spatial-action="voice.end"
          data-spatial-label="Kết thúc trò chuyện"
        >
          <IconPhoneOff />
        </button>
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
    </div>
  );
}
