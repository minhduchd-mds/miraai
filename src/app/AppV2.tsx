import { useCallback, useEffect, useRef, useState } from 'react';
import { useMira } from '../core/useMira';
import type { MiraState, Theme } from '../core/types';
import ContentPanel from '../ui/ContentPanel';
import { IconSettings } from '../ui/icons';
import { useDialogFocus } from '../ui/useDialogFocus';
import SettingsPanel from '../settings/SettingsPanel';
import HolographicMira from '../presence/HolographicMira';
import '../ui/a11y.css';

const STATE_COPY: Record<MiraState, string> = {
  idle: 'Sẵn sàng',
  listening: 'Đang nghe',
  thinking: 'Đang nghĩ',
  speaking: 'Đang nói',
  interrupted: 'Đã dừng',
  error: 'Cần kiểm tra',
};
const THEMES: Theme[] = ['nova', 'aura', 'ember', 'iris'];
const VOICE_HANDSHAKE_TEXT = 'Em nghe anh.';
const VOICE_HANDSHAKE_TIMEOUT = 5000;

function loadTheme(): Theme {
  try {
    const raw = localStorage.getItem('mira.theme');
    if (raw === 'nova' || raw === 'aura' || raw === 'ember' || raw === 'iris') return raw;
  } catch {
    // noop
  }
  return 'nova';
}

export default function AppV2() {
  const mira = useMira();
  const [theme, setTheme] = useState<Theme>(loadTheme);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [voiceReady, setVoiceReady] = useState(false);
  const [voiceBooting, setVoiceBooting] = useState(false);
  const bootPendingRef = useRef(false);
  const bootSawSpeakingRef = useRef(false);
  const bootTimerRef = useRef<number | null>(null);

  useDialogFocus(settingsOpen, '.v2-settings');

  useEffect(() => {
    document.body.dataset.state = mira.state;
    document.body.dataset.theme = theme;
  }, [mira.state, theme]);

  useEffect(() => {
    try { localStorage.setItem('mira.theme', theme); } catch { /* noop */ }
  }, [theme]);

  useEffect(() => {
    const unlock = () => mira.unlockAudio();
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, [mira.unlockAudio]);

  const clearBootTimer = useCallback(() => {
    if (bootTimerRef.current != null) {
      window.clearTimeout(bootTimerRef.current);
      bootTimerRef.current = null;
    }
  }, []);

  const finishVoiceHandshake = useCallback(() => {
    if (!bootPendingRef.current) return;
    bootPendingRef.current = false;
    bootSawSpeakingRef.current = false;
    clearBootTimer();
    setVoiceBooting(false);
    setVoiceReady(true);
    window.setTimeout(() => mira.startListening(), 80);
  }, [clearBootTimer, mira.startListening]);

  useEffect(() => {
    if (!voiceBooting || !bootPendingRef.current) return;
    if (mira.state === 'speaking') bootSawSpeakingRef.current = true;
    if (mira.state === 'idle' && bootSawSpeakingRef.current) finishVoiceHandshake();
  }, [finishVoiceHandshake, mira.state, voiceBooting]);

  useEffect(() => () => clearBootTimer(), [clearBootTimer]);

  const activateVoice = useCallback(() => {
    mira.unlockAudio();

    if (voiceReady) {
      mira.toggleMic();
      return;
    }

    if (bootPendingRef.current) {
      bootPendingRef.current = false;
      bootSawSpeakingRef.current = false;
      clearBootTimer();
      setVoiceBooting(false);
      setVoiceReady(true);
      if (mira.stateRef.current === 'speaking' || mira.stateRef.current === 'thinking') mira.interrupt();
      else mira.startListening();
      return;
    }

    if (mira.stateRef.current !== 'idle') {
      setVoiceReady(true);
      mira.toggleMic();
      return;
    }

    bootPendingRef.current = true;
    bootSawSpeakingRef.current = false;
    setVoiceBooting(true);
    mira.say(VOICE_HANDSHAKE_TEXT);

    bootTimerRef.current = window.setTimeout(() => {
      if (!bootPendingRef.current) return;
      bootPendingRef.current = false;
      bootSawSpeakingRef.current = false;
      bootTimerRef.current = null;
      setVoiceBooting(false);
      setVoiceReady(true);
      if (mira.stateRef.current === 'speaking' || mira.stateRef.current === 'thinking') mira.interrupt();
      else mira.startListening();
    }, VOICE_HANDSHAKE_TIMEOUT);
  }, [clearBootTimer, mira.interrupt, mira.say, mira.startListening, mira.stateRef, mira.toggleMic, mira.unlockAudio, voiceReady]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (settingsOpen || event.code !== 'Space' || event.repeat) return;
      const element = event.target as HTMLElement | null;
      if (element && /^(BUTTON|SELECT|INPUT|TEXTAREA)$/.test(element.tagName)) return;
      event.preventDefault();
      activateVoice();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [activateVoice, settingsOpen]);

  const cycleTheme = () => setTheme(THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length]);
  const openLabs = () => {
    const url = new URL(window.location.href);
    url.searchParams.set('legacy', '1');
    window.location.assign(url.toString());
  };
  const toggleLive = () => {
    mira.unlockAudio();
    setVoiceReady(true);
    mira.toggleLive();
  };

  return (
    <div className={`mira-v2 voice-only holographic-ui${voiceBooting ? ' voice-booting' : ''}${mira.content ? ' has-result' : ''}`}>
      <a className="v2-skip" href="#main-content">Chuyển tới nội dung chính</a>

      <header className="v2-header voice-header">
        <div className="v2-brand" aria-label="Mira">
          <span className="v2-mark" aria-hidden="true"><i /></span>
          <span className="v2-wordmark"><b>Mira</b><small>Voice Companion</small></span>
        </div>
        <div className="v2-status compact" role="status" aria-live="polite" aria-atomic="true" title={STATE_COPY[mira.state]}>
          <span className={`v2-status-dot ${mira.state}`} aria-hidden="true" />
          <span className="sr-only">{STATE_COPY[mira.state]}</span>
        </div>
        <nav className="v2-actions" aria-label="Điều khiển Mira">
          <button type="button" onClick={cycleTheme} title="Đổi màu"><span className="v2-theme-dot" aria-hidden="true" /><span className="sr-only">Đổi màu</span></button>
          <button type="button" onClick={() => setSettingsOpen(true)} title="Cài đặt"><IconSettings /><span className="sr-only">Mở cài đặt</span></button>
        </nav>
      </header>

      {mira.error && <div className="v2-error" role="alert">{mira.error}</div>}

      <main className="v2-workspace voice-workspace" id="main-content" tabIndex={-1}>
        <div className="voice-stage holographic-stage">
          <HolographicMira state={mira.state} onActivate={activateVoice} />
        </div>

        <div className="sr-only" aria-live="polite" aria-atomic="true">
          {mira.who}: {mira.caption}
        </div>

        {mira.content && (
          <aside className="v2-result" aria-label="Kết quả trực quan">
            <ContentPanel content={mira.content} onClose={mira.clearContent} />
          </aside>
        )}
      </main>

      <div className="voice-footer">
        <button
          type="button"
          className={`voice-live${mira.live ? ' active' : ''}`}
          onClick={toggleLive}
          aria-pressed={mira.live}
          aria-label={mira.live ? 'Tắt trò chuyện rảnh tay' : 'Bật trò chuyện rảnh tay'}
          title={mira.live ? 'Tắt trò chuyện rảnh tay' : 'Bật trò chuyện rảnh tay'}
        >
          <span aria-hidden="true" />
        </button>
      </div>

      <SettingsPanel
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        theme={theme}
        onTheme={setTheme}
        voices={mira.voices}
        voiceURI={mira.voiceURI}
        onSelectVoice={mira.selectVoice}
        onTestVoice={mira.testVoice}
        onOpenLabs={openLabs}
      />
    </div>
  );
}
