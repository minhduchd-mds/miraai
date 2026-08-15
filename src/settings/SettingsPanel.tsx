import { useCallback, useEffect, useState } from 'react';
import type { AvatarSel } from '../core/avatar-config';
import type { Theme, VoiceOption } from '../core/types';
import { loadSmartTurn, saveSmartTurn } from '../core/stt/turn-config';
import { loadVadEnabled, saveVadEnabled } from '../core/vad/config';
import {
  loadVoicePrefs,
  PERSONAS,
  RESPONSE_LENGTHS,
  saveVoicePrefs,
  SPEEDS,
  type ResponseLength,
} from '../core/voice-prefs';
import { memoryEnabled, setMemoryEnabled } from '../intelligence/memory/preferences';
import {
  exportMemory,
  forgetAllMemory,
  forgetMemoryFact,
  loadMemoryProfile,
  updateMemoryFact,
  type MemoryFact,
  type MemoryProfile,
} from '../intelligence/memory/profile-client';
import { AVATAR_PACKS, avatarPackThumbnail, sameAvatar } from '../presence/avatar-manifest';
import './settings-v2.css';

interface Props {
  open: boolean;
  onClose: () => void;
  theme: Theme;
  onTheme: (theme: Theme) => void;
  avatarSel: AvatarSel;
  onAvatarChange: (avatar: AvatarSel) => void;
  avatar2d: boolean;
  onAvatar2d: (enabled: boolean) => void;
  voices: VoiceOption[];
  voiceURI?: string;
  onSelectVoice: (uri: string) => void;
  onOpenLabs: () => void;
}

type Tab = 'voice' | 'appearance' | 'memory';
const THEMES: Theme[] = ['nova', 'aura', 'ember', 'iris'];

function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (next: boolean) => void; label: string; hint?: string }) {
  return (
    <label className="v2-setting-row">
      <span><b>{label}</b>{hint && <small>{hint}</small>}</span>
      <button type="button" className={`v2-switch${checked ? ' on' : ''}`} role="switch" aria-checked={checked} onClick={() => onChange(!checked)}>
        <i />
      </button>
    </label>
  );
}

function FactRow({ fact, onChanged }: { fact: MemoryFact; onChanged: () => void }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(fact.fact);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!value.trim()) return;
    setBusy(true);
    try { await updateMemoryFact(fact.id, value.trim()); setEditing(false); onChanged(); }
    finally { setBusy(false); }
  };
  const remove = async () => {
    setBusy(true);
    try { await forgetMemoryFact(fact.id); onChanged(); }
    finally { setBusy(false); }
  };

  return (
    <div className="v2-memory-fact">
      {editing ? <input value={value} onChange={(event) => setValue(event.target.value)} maxLength={300} aria-label="Nội dung ký ức" /> : <span>{fact.fact}</span>}
      <div>
        {editing ? <><button type="button" onClick={() => { setEditing(false); setValue(fact.fact); }} disabled={busy}>Huỷ</button><button type="button" className="primary" onClick={save} disabled={busy || !value.trim()}>Lưu</button></>
          : <><button type="button" onClick={() => setEditing(true)} disabled={busy}>Sửa</button><button type="button" className="danger" onClick={remove} disabled={busy}>Quên</button></>}
      </div>
    </div>
  );
}

export default function SettingsPanel(props: Props) {
  const [tab, setTab] = useState<Tab>('voice');
  const [rate, setRate] = useState(() => loadVoicePrefs().rate);
  const [persona, setPersona] = useState(() => loadVoicePrefs().persona);
  const [responseLength, setResponseLength] = useState<ResponseLength>(() => loadVoicePrefs().responseLength);
  const [smartTurn, setSmartTurn] = useState(loadSmartTurn);
  const [vad, setVad] = useState(loadVadEnabled);
  const [memoryOn, setMemoryOn] = useState(memoryEnabled);
  const [profile, setProfile] = useState<MemoryProfile | null>(null);
  const [profileError, setProfileError] = useState('');
  const [loadingProfile, setLoadingProfile] = useState(false);

  const refreshProfile = useCallback(async () => {
    setLoadingProfile(true); setProfileError('');
    try { setProfile(await loadMemoryProfile()); }
    catch { setProfile(null); setProfileError('Chưa kết nối được kho ký ức. Mira vẫn dùng được bình thường.'); }
    finally { setLoadingProfile(false); }
  }, []);

  useEffect(() => {
    if (!props.open) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') props.onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [props]);

  useEffect(() => { if (props.open && tab === 'memory') void refreshProfile(); }, [props.open, refreshProfile, tab]);

  if (!props.open) return null;

  const changeRate = (next: number) => { setRate(next); saveVoicePrefs({ rate: next }); };
  const changePersona = (next: string) => { setPersona(next); saveVoicePrefs({ persona: next }); };
  const changeResponseLength = (next: ResponseLength) => { setResponseLength(next); saveVoicePrefs({ responseLength: next }); };
  const changeSmart = (next: boolean) => { setSmartTurn(next); saveSmartTurn(next); };
  const changeVad = (next: boolean) => { setVad(next); saveVadEnabled(next); };
  const changeMemory = (next: boolean) => { setMemoryOn(next); setMemoryEnabled(next); };

  const eraseAll = async () => {
    if (!window.confirm('Xoá toàn bộ lịch sử và hồ sơ Mira đã ghi nhớ? Thao tác này không hoàn tác được.')) return;
    await forgetAllMemory(); await refreshProfile();
  };
  const selectedResponseLength = RESPONSE_LENGTHS.find((item) => item.id === responseLength) ?? RESPONSE_LENGTHS[1];

  return (
    <div className="v2-settings-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && props.onClose()}>
      <section className="v2-settings" role="dialog" aria-modal="true" aria-labelledby="mira-settings-title">
        <header><div><span>CÀI ĐẶT</span><h2 id="mira-settings-title">Mira của anh</h2></div><button type="button" className="v2-settings-close" onClick={props.onClose} aria-label="Đóng cài đặt">×</button></header>
        <nav className="v2-settings-tabs" aria-label="Nhóm cài đặt">
          <button type="button" className={tab === 'voice' ? 'active' : ''} onClick={() => setTab('voice')}>Giọng & hội thoại</button>
          <button type="button" className={tab === 'appearance' ? 'active' : ''} onClick={() => setTab('appearance')}>Hiện diện</button>
          <button type="button" className={tab === 'memory' ? 'active' : ''} onClick={() => setTab('memory')}>Ký ức & riêng tư</button>
        </nav>

        <div className="v2-settings-body">
          {tab === 'voice' && (
            <>
              <div className="v2-setting-group">
                <h3>Giọng nói</h3>
                <label className="v2-field"><span>Giọng Mira</span><select value={props.voiceURI || ''} onChange={(event) => props.onSelectVoice(event.target.value)}><option value="">Tự động · Tiếng Việt</option>{props.voices.map((voice) => <option key={voice.voiceURI || voice.name} value={voice.voiceURI}>{voice.name}</option>)}</select></label>
                <div className="v2-choice-block"><span>Tốc độ</span><div className="v2-segmented">{SPEEDS.map((speed) => <button key={speed.id} type="button" className={Math.abs(rate - speed.rate) < .01 ? 'active' : ''} onClick={() => changeRate(speed.rate)}>{speed.label}</button>)}</div></div>
                <p className="v2-disclosure">Giọng Mira là giọng tổng hợp bởi hệ thống TTS đã chọn.</p>
              </div>

              <div className="v2-setting-group">
                <h3>Độ dài câu trả lời</h3>
                <div className="v2-choice-block">
                  <span>Mức chi tiết</span>
                  <div className="v2-segmented">
                    {RESPONSE_LENGTHS.map((item) => <button key={item.id} type="button" className={responseLength === item.id ? 'active' : ''} onClick={() => changeResponseLength(item.id)}>{item.label}</button>)}
                  </div>
                  <p className="v2-disclosure">{selectedResponseLength.description}</p>
                </div>
                <p className="v2-disclosure">Trong mọi chế độ, anh có thể nói “nói kỹ hơn”, “phân tích sâu”, “kể tiếp” hoặc “nói gọn thôi” để đổi độ dài ngay cho lượt hiện tại.</p>
              </div>

              <div className="v2-setting-group"><h3>Tính cách</h3><div className="v2-personas">{PERSONAS.map((item) => <button key={item.id} type="button" className={persona === item.id ? 'active' : ''} onClick={() => changePersona(item.id)}><span>{item.icon}</span><b>{item.label}</b></button>)}</div></div>

              <div className="v2-setting-group">
                <h3>Hội thoại tự nhiên</h3>
                <Toggle checked={smartTurn} onChange={changeSmart} label="Smart turn-taking" hint="Chờ đúng lúc anh nói xong thay vì cắt theo khoảng lặng cứng." />
                <Toggle checked={vad} onChange={changeVad} label="Ngắt lời bằng giọng" hint="Cho phép nói chen khi Mira đang trả lời dài. SpeechQueue dừng ngay phần còn lại." />
              </div>
            </>
          )}

          {tab === 'appearance' && (
            <>
              <div className="v2-setting-group"><h3>Mira Presence</h3><div className="v2-avatar-grid">{AVATAR_PACKS.map((pack) => <button key={pack.id} type="button" className={sameAvatar(props.avatarSel, pack.selection) ? 'active' : ''} onClick={() => props.onAvatarChange(pack.selection)}><img src={avatarPackThumbnail(pack)} alt="" /><span><b>{pack.label}</b><small>{pack.description}</small></span></button>)}</div><Toggle checked={props.avatar2d} onChange={props.onAvatar2d} label="Ưu tiên 2D" hint="Nhanh và nhẹ hơn; tắt để Mira tải model 3D sau khi giao diện sẵn sàng." /></div>
              <div className="v2-setting-group"><h3>Màu giao diện</h3><div className="v2-theme-grid">{THEMES.map((item) => <button key={item} type="button" data-theme-preview={item} className={props.theme === item ? 'active' : ''} onClick={() => props.onTheme(item)}><i /><span>{item}</span></button>)}</div></div>
            </>
          )}

          {tab === 'memory' && (
            <>
              <div className="v2-setting-group">
                <h3>Ký ức</h3>
                <Toggle checked={memoryOn} onChange={changeMemory} label="Cho phép Mira ghi nhớ" hint="Tắt để ngừng lưu lượt mới, truy hồi ký ức và chắt lọc hồ sơ." />
                <div className="v2-memory-meta"><span>{loadingProfile ? 'Đang đọc kho ký ức…' : `${profile?.messageCount ?? 0} lượt hội thoại đã lưu`}</span><button type="button" onClick={() => void refreshProfile()}>Làm mới</button></div>
                {profileError && <p className="v2-profile-error">{profileError}</p>}
                <div className="v2-memory-list">{profile?.facts.map((fact) => <FactRow key={fact.id} fact={fact} onChanged={() => void refreshProfile()} />)}{!loadingProfile && profile && !profile.facts.length && <p className="v2-empty">Mira chưa ghi nhớ thông tin bền vững nào về anh.</p>}</div>
                <div className="v2-memory-actions"><button type="button" onClick={() => void exportMemory()}>Xuất dữ liệu</button><button type="button" className="danger" onClick={() => void eraseAll()}>Xoá toàn bộ ký ức</button></div>
              </div>
              <div className="v2-setting-group v2-privacy-note"><h3>Riêng tư mặc định</h3><p>Mic chỉ hoạt động khi anh bật nghe/trò chuyện. Camera và điều khiển tay không chạy trên giao diện chính; chúng chỉ nằm trong Labs và cần bật chủ động.</p><p>Kho ký ức được khóa theo scope HttpOnly của trình duyệt. ID cũ chỉ dùng làm seed lần đầu để giữ lịch sử đã có.</p></div>
              <div className="v2-setting-group v2-labs-entry"><div><h3>Developer Labs</h3><p>Camera, hand gesture, Splat, simulator, BYOK và chẩn đoán kỹ thuật.</p></div><button type="button" onClick={props.onOpenLabs}>Mở Labs →</button></div>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
