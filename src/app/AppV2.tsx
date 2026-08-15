import { useEffect, useRef, useState } from 'react';
import { useMira } from '../core/useMira';
import {
  has3D,
  loadAvatarSel,
  lookImage,
  resolveAvatarUrl,
  saveAvatarSel,
  type AvatarSel,
} from '../core/avatar-config';
import type { MiraState, Theme } from '../core/types';
import ContentPanel from '../ui/ContentPanel';
import { IconMic, IconSettings } from '../ui/icons';
import Composer from '../conversation/Composer';
import ConversationHistory from '../conversation/ConversationHistory';
import PresenceStage from '../presence/PresenceStage';
import SettingsPanel from '../settings/SettingsPanel';
import '../ui/a11y.css';

const STATE_COPY: Record<MiraState, string> = {
  idle: 'Sẵn sàng', listening: 'Đang nghe anh', thinking: 'Đang suy nghĩ', speaking: 'Đang trả lời', interrupted: 'Đã ngắt lời', error: 'Cần kiểm tra',
};
const THEMES: Theme[] = ['nova', 'aura', 'ember', 'iris'];

function loadTheme(): Theme {
  try { const raw = localStorage.getItem('mira.theme'); if (raw === 'nova' || raw === 'aura' || raw === 'ember' || raw === 'iris') return raw; } catch { /* noop */ }
  return 'nova';
}
function loadAvatar2D(): boolean { try { return localStorage.getItem('mira.avatar2d') === '1'; } catch { return false; } }

export default function AppV2() {
  const mira = useMira();
  const footglowRef = useRef<HTMLDivElement>(null);
  const [theme, setTheme] = useState<Theme>(loadTheme);
  const [avatarSel, setAvatarSel] = useState<AvatarSel>(loadAvatarSel);
  const [avatar2d, setAvatar2d] = useState(loadAvatar2D);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const avatarUrl = !avatar2d && has3D(avatarSel) ? resolveAvatarUrl(avatarSel) : null;
  const lookSrc = lookImage(avatarSel);

  useEffect(() => { document.body.dataset.state = mira.state; document.body.dataset.theme = theme; }, [mira.state, theme]);
  useEffect(() => { try { localStorage.setItem('mira.theme', theme); } catch { /* noop */ } }, [theme]);
  useEffect(() => {
    const unlock = () => mira.unlockAudio();
    window.addEventListener('pointerdown', unlock, { once: true }); window.addEventListener('keydown', unlock, { once: true });
    return () => { window.removeEventListener('pointerdown', unlock); window.removeEventListener('keydown', unlock); };
  }, [mira]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (settingsOpen || historyOpen || event.code !== 'Space' || event.repeat) return;
      const element = event.target as HTMLElement | null;
      if (element && /^(BUTTON|SELECT|INPUT|TEXTAREA)$/.test(element.tagName)) return;
      event.preventDefault(); mira.toggleMic();
    };
    document.addEventListener('keydown', onKey); return () => document.removeEventListener('keydown', onKey);
  }, [historyOpen, mira, settingsOpen]);
  useEffect(() => {
    if (!historyOpen) return;
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') setHistoryOpen(false); };
    document.addEventListener('keydown', close); return () => document.removeEventListener('keydown', close);
  }, [historyOpen]);

  const cycleTheme = () => setTheme(THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length]);
  const changeAvatar = (next: AvatarSel) => { setAvatarSel(next); saveAvatarSel(next); };
  const changeAvatar2d = (next: boolean) => { setAvatar2d(next); try { localStorage.setItem('mira.avatar2d', next ? '1' : '0'); } catch { /* noop */ } };
  const openLabs = () => { const url = new URL(window.location.href); url.searchParams.set('legacy', '1'); window.location.assign(url.toString()); };

  return (
    <div className={`mira-v2${mira.content ? ' has-result' : ''}`}>
      <a className="v2-skip" href="#main-content">Chuyển tới nội dung chính</a>
      <header className="v2-header">
        <div className="v2-brand" aria-label="Mira"><span className="v2-mark" aria-hidden="true"><i /></span><span className="v2-wordmark"><b>Mira</b><small>Voice-first AI Companion</small></span></div>
        <div className="v2-status" role="status" aria-live="polite" aria-atomic="true"><span className={`v2-status-dot ${mira.state}`} aria-hidden="true" /><span>{STATE_COPY[mira.state]}</span>{mira.latencyMs != null && <em>{mira.latencyMs} ms</em>}</div>
        <nav className="v2-actions" aria-label="Điều khiển Mira">
          <button type="button" onClick={cycleTheme} title="Đổi chủ đề màu"><span className="v2-theme-dot" aria-hidden="true" /><span className="sr-only">Đổi chủ đề màu</span></button>
          <button type="button" onClick={() => setSettingsOpen(true)} title="Cài đặt Mira"><IconSettings /><span className="sr-only">Mở Cài đặt Mira</span></button>
        </nav>
      </header>
      {mira.error && <div className="v2-error" role="alert">{mira.error}</div>}
      <main className="v2-workspace" id="main-content" tabIndex={-1}>
        <section className="v2-presence" aria-label="Mira presence"><PresenceStage footglowRef={footglowRef} stateRef={mira.stateRef} moodRef={mira.moodRef} theme={theme} avatarUrl={avatarUrl} lookSrc={lookSrc} avatarOpacity={1} /></section>
        {mira.content && <aside className="v2-result" aria-label="Kết quả trực quan"><ContentPanel content={mira.content} onClose={mira.clearContent} /></aside>}
      </main>
      <section className="v2-conversation" aria-label="Cuộc trò chuyện">
        <div className="v2-caption" aria-live="polite" aria-atomic="true"><span>{mira.who}</span><p>{mira.caption}{mira.partial && <i className="v2-caret" aria-hidden="true" />}</p></div>
        <Composer onSubmit={mira.sendText} busy={mira.state === 'thinking'} />
        <div className="v2-controls">
          <button type="button" className={`v2-mic state-${mira.state}`} onClick={mira.toggleMic} aria-label={mira.state === 'listening' ? 'Dừng nghe' : mira.state === 'speaking' || mira.state === 'thinking' ? 'Ngắt Mira' : 'Nói với Mira'}><span className="v2-mic-glow" aria-hidden="true" /><IconMic /></button>
          <button type="button" className={`v2-live${mira.live ? ' active' : ''}`} onClick={mira.toggleLive} aria-pressed={mira.live}><span className="v2-live-dot" aria-hidden="true" />{mira.live ? 'Dừng trò chuyện rảnh tay' : 'Trò chuyện rảnh tay'}</button>
        </div>
        <div className="v2-hint"><span><kbd>Space</kbd> để nói/ngắt · <kbd>Enter</kbd> để gửi</span><button type="button" className="v2-history-trigger" onClick={() => setHistoryOpen(true)}>Lịch sử · {mira.history.length}</button></div>
      </section>
      <ConversationHistory open={historyOpen} turns={mira.history} onClose={() => setHistoryOpen(false)} />
      <SettingsPanel open={settingsOpen} onClose={() => setSettingsOpen(false)} theme={theme} onTheme={setTheme} avatarSel={avatarSel} onAvatarChange={changeAvatar} avatar2d={avatar2d} onAvatar2d={changeAvatar2d} voices={mira.voices} voiceURI={mira.voiceURI} onSelectVoice={mira.selectVoice} onOpenLabs={openLabs} />
    </div>
  );
}
