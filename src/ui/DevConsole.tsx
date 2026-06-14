import { useEffect, useMemo, useRef, useState } from 'react';
import { defaultModelFor, loadLLMConfig, type LLMConfig } from '../core/brain';
import { loadTTSConfig, VIENEU_DEFAULT_URL, EDGE_DEFAULT_URL, type TTSConfig, type TTSDiagnostics } from '../core/tts';
import { loadVadEnabled, saveVadEnabled } from '../core/vad/config';
import { SCENES, OUTFITS, lookImage, type AvatarSel, type Scene } from '../core/avatar-config';
import { voicePrefs, saveVoicePrefs, SPEEDS, PERSONAS } from '../core/voice-prefs';
import type { Theme, VoiceOption, MiraState } from '../core/types';
import {
  IconClose, IconSettings, IconChevronUp, IconChevronDown, IconRefresh, IconShirt, IconScene,
  IconPerson, IconMic, IconRepeat, IconStop, IconCamera, IconOrb, IconSpeech, IconBrain, PERSONA_ICON,
} from './icons';

// Rút gọn tên giọng cho thẻ + sub mô tả ngắn.
const shortVoice = (n: string) => n.replace(/Microsoft\s+/i, '').replace(/\s*[-–].*$/, '').trim() || n;
const voiceSub = (v: VoiceOption) => (v.lang?.toLowerCase().startsWith('vi') ? 'Tiếng Việt' : v.lang || 'Hệ thống');

const STATE_BTNS: { go: MiraState; label: string; warn?: boolean }[] = [
  { go: 'idle', label: 'Idle' },
  { go: 'listening', label: 'Listening' },
  { go: 'thinking', label: 'Thinking' },
  { go: 'speaking', label: 'Speaking' },
  { go: 'interrupted', label: 'Ngắt lời', warn: true },
];

// Model gợi ý theo nhà cung cấp (vẫn cho "tự nhập" để dùng model bất kỳ).
const MODELS: Record<'anthropic' | 'openai', { id: string; label: string }[]> = {
  anthropic: [
    { id: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6 — cân bằng' },
    { id: 'claude-opus-4-8', label: 'Claude Opus 4.8 — mạnh nhất' },
    { id: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5 — nhanh nhất' },
  ],
  openai: [
    { id: 'gpt-4o-mini', label: 'GPT-4o mini — nhanh, rẻ' },
    { id: 'gpt-4o', label: 'GPT-4o' },
    { id: 'gpt-4.1-mini', label: 'GPT-4.1 mini' },
  ],
};
const CUSTOM = '__custom__';

const THEMES: { id: Theme; label: string }[] = [
  { id: 'nova', label: 'Nova' },
  { id: 'aura', label: 'Aura' },
  { id: 'ember', label: 'Ember' },
  { id: 'iris', label: 'Iris' },
];

type Tab = 'interface' | 'model' | 'notify' | 'guide';
const TABS: { id: Tab; label: string }[] = [
  { id: 'interface', label: 'Giao diện' },
  { id: 'model', label: 'Model' },
  { id: 'notify', label: 'Thông báo' },
  { id: 'guide', label: 'Hướng dẫn' },
];

interface NotifyCfg {
  browser?: boolean;
  sound?: boolean;
  proactive?: boolean;
}
function loadNotify(): NotifyCfg {
  try {
    return JSON.parse(localStorage.getItem('mira.notify') || '{}');
  } catch {
    return {};
  }
}
function saveNotify(n: NotifyCfg): void {
  try {
    localStorage.setItem('mira.notify', JSON.stringify(n));
  } catch {
    /* noop */
  }
}

// Dropdown tự vẽ (select native không style được popup trên Windows → option khó nhìn).
function Dropdown({
  value, options, onChange,
}: {
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', h);
    return () => document.removeEventListener('pointerdown', h);
  }, [open]);
  const cur = options.find((o) => o.value === value);
  return (
    <div className="dd" ref={ref}>
      <button type="button" className="dd-btn" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <span>{cur?.label ?? '—'}</span>
        <i className="dd-arrow" />
      </button>
      {open && (
        <div className="dd-menu" role="listbox">
          {options.map((o) => (
            <button
              key={o.value}
              type="button"
              role="option"
              aria-selected={o.value === value}
              className={`dd-item${o.value === value ? ' sel' : ''}`}
              onClick={() => {
                onChange(o.value);
                setOpen(false);
              }}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

interface Props {
  open: boolean;
  onClose: () => void;
  brainName: string;
  onSaveLLM: (cfg: LLMConfig) => void;
  onSaveTTS: (cfg: TTSConfig) => void;
  onTestBrain: () => Promise<string>;
  onTestVoice: () => void;
  getDiagnostics: () => TTSDiagnostics;
  theme: Theme;
  onTheme: (t: Theme) => void;
  avatarSel: AvatarSel;
  onAvatarChange: (s: AvatarSel) => void;
  avatarOpacity: number;
  onAvatarOpacity: (v: number) => void;
  voices: VoiceOption[];
  voiceURI?: string;
  onSelectVoice: (uri: string) => void;
  state: MiraState;
  onGoState: (s: MiraState, speakIt?: boolean) => void;
  onSimulate: () => void;
  simulating: boolean;
}

export default function DevConsole({
  open, onClose, brainName, onSaveLLM, onSaveTTS, onTestBrain, onTestVoice, getDiagnostics,
  theme, onTheme, avatarSel, onAvatarChange, avatarOpacity, onAvatarOpacity,
  voices, voiceURI, onSelectVoice, state, onGoState, onSimulate, simulating,
}: Props) {
  const initial = useMemo(() => (open ? loadLLMConfig() : null), [open]);
  const [tab, setTab] = useState<Tab>('interface');
  const [previewKey, setPreviewKey] = useState(0); // bust cache ảnh khi "Làm mới"
  const [provider, setProvider] = useState<LLMConfig['provider']>('anthropic');
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('');
  const [custom, setCustom] = useState(false);
  const [webSearch, setWebSearch] = useState(true);
  const [saved, setSaved] = useState<string | null>(null);
  const [diag, setDiag] = useState<TTSDiagnostics | null>(null);
  const [brainTest, setBrainTest] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [ttsEngine, setTtsEngine] = useState<TTSConfig['engine']>('system');
  const [ttsKey, setTtsKey] = useState('');
  const [ttsServer, setTtsServer] = useState('');
  const [ttsSaved, setTtsSaved] = useState<string | null>(null);
  const [vadOn, setVadOn] = useState(false);
  const [notify, setNotify] = useState<NotifyCfg>({});
  const [rate, setRate] = useState(voicePrefs.rate);
  const [persona, setPersona] = useState(voicePrefs.persona);
  const [showAdv, setShowAdv] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!initial) return;
    const p = initial.provider || 'anthropic';
    setProvider(initial.provider || 'anthropic');
    setApiKey(initial.apiKey);
    setModel(initial.model);
    setCustom(!!initial.model && !MODELS[p as 'anthropic' | 'openai'].some((m) => m.id === initial.model));
    setWebSearch(initial.webSearch);
    setSaved(null);
    setBrainTest(null);
    const t = loadTTSConfig();
    setTtsEngine(t.engine);
    setTtsKey(t.apiKey);
    setTtsServer(t.serverUrl);
    setTtsSaved(null);
    setVadOn(loadVadEnabled());
    setNotify(loadNotify());
    setRate(voicePrefs.rate);
    setPersona(voicePrefs.persona);
  }, [initial]);

  useEffect(() => {
    if (!open) return;
    setDiag(getDiagnostics());
    const id = window.setInterval(() => setDiag(getDiagnostics()), 500);
    return () => clearInterval(id);
  }, [open, getDiagnostics]);

  // Esc đóng + bẫy focus trong modal + trả focus về nút mở khi đóng (a11y bàn phím/screen reader).
  useEffect(() => {
    if (!open) return;
    const prevFocus = document.activeElement as HTMLElement | null;
    modalRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key !== 'Tab') return;
      const root = modalRef.current;
      if (!root) return;
      const items = Array.from(
        root.querySelectorAll<HTMLElement>('a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])'),
      ).filter((el) => !el.hasAttribute('disabled') && el.offsetParent !== null);
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      prevFocus?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  const save = () => {
    onSaveLLM({ provider, apiKey: apiKey.trim(), model: model.trim(), webSearch });
    setSaved(apiKey.trim() ? 'Đã lưu — bộ não LLM đang chạy.' : 'Đã xoá key — quay về brain demo.');
  };
  const clear = () => {
    setApiKey('');
    setModel('');
    setCustom(false);
    onSaveLLM({ provider: '', apiKey: '', model: '', webSearch });
    setSaved('Đã xoá key — quay về brain demo.');
  };
  const runBrainTest = async () => {
    setTesting(true);
    setBrainTest('Đang gọi…');
    setBrainTest(await onTestBrain());
    setTesting(false);
  };
  const saveTts = () => {
    onSaveTTS({ engine: ttsEngine, apiKey: ttsKey.trim(), voiceId: '', serverUrl: ttsServer.trim() });
    setTtsSaved(
      ttsEngine === 'edge'
        ? 'Đã đổi sang Edge (Microsoft) — chạy server/ rồi bấm Đọc thử để nghe.'
        : ttsEngine === 'vieneu'
          ? 'Đã đổi sang VieNeu (server nhà) — bấm Đọc thử để nghe.'
          : ttsEngine === 'elevenlabs' && ttsKey.trim()
            ? 'Đã đổi sang giọng ElevenLabs — bấm Đọc thử để nghe.'
            : 'Đang dùng giọng hệ thống (miễn phí).',
    );
  };

  // ── Nhân vật: bối cảnh → trang phục (gộp cả nam + nữ trong một danh sách) ──
  const sceneOutfits = [
    ...OUTFITS.female[avatarSel.scene].map((o) => ({ ...o, gender: 'female' as const })),
    ...OUTFITS.male[avatarSel.scene].map((o) => ({ ...o, gender: 'male' as const })),
  ];
  const setScene = (scene: Scene) => {
    const first = OUTFITS.female[scene][0];
    onAvatarChange({ scene, gender: 'female', outfit: first.id });
  };
  const pickOutfit = (gender: AvatarSel['gender'], outfit: string) =>
    onAvatarChange({ ...avatarSel, gender, outfit });
  const sceneOrder: Scene[] = ['office', 'home', 'intimate'];
  const nextScene = () => setScene(sceneOrder[(sceneOrder.indexOf(avatarSel.scene) + 1) % sceneOrder.length]);
  const nextOutfit = () => {
    const i = sceneOutfits.findIndex((o) => o.gender === avatarSel.gender && o.id === avatarSel.outfit);
    const n = sceneOutfits[(i + 1) % sceneOutfits.length];
    pickOutfit(n.gender, n.id);
  };
  const lookOf = (gender: AvatarSel['gender'], outfit: string) =>
    lookImage({ ...avatarSel, gender, outfit }) + (previewKey ? `?k=${previewKey}` : '');
  const onLookErr = (e: { currentTarget: HTMLImageElement }) => {
    const t = e.currentTarget;
    if (!t.src.includes('mira.webp')) t.src = '/avatars/mira.webp';
  };

  // Danh sách giọng: "Eva" (giọng mặc định của engine) + giọng thiết bị. Chọn giọng = phát thử luôn.
  const voiceList = [
    { uri: '', name: 'Eva', sub: 'Nhẹ nhàng' },
    ...voices.filter((v) => v.voiceURI).map((v) => ({ uri: v.voiceURI, name: shortVoice(v.name), sub: voiceSub(v) })),
  ];
  const pickVoice = (uri: string) => {
    onSelectVoice(uri);
    onTestVoice();
  };

  const setNotifyKey = (k: keyof NotifyCfg, v: boolean) => {
    const n = { ...notify, [k]: v };
    setNotify(n);
    saveNotify(n);
  };
  const toggleBrowserNotify = async (on: boolean) => {
    let ok = on;
    if (on && 'Notification' in window && Notification.permission !== 'granted') {
      try {
        ok = (await Notification.requestPermission()) === 'granted';
      } catch {
        ok = false;
      }
    }
    setNotifyKey('browser', ok);
  };

  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label="Cài đặt" ref={modalRef} tabIndex={-1}>
        <div className="modal-head">
          <b className="modal-title"><IconSettings /> Cài đặt</b>
          <button className="modal-x" onClick={onClose} aria-label="Đóng"><IconClose /></button>
        </div>

        <div className="modal-tabs" role="tablist">
          {TABS.map((t) => (
            <button key={t.id} className="modal-tab" role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}>
              {t.label}
            </button>
          ))}
        </div>

        {/* ── GIAO DIỆN: trái = điều khiển, phải = xem trước "hình mẫu áo" ── */}
        {tab === 'interface' && (
          <div className="iface-grid">
            <div className="iface-left">
            <div className="modal-sec">
              <div className="modal-tl">Nhân vật</div>
              <div className="modal-sub">Bối cảnh</div>
              <div className="opt-row">
                {SCENES.map((s) => (
                  <button key={s.id} className="opt" aria-pressed={avatarSel.scene === s.id} onClick={() => setScene(s.id)}>
                    {s.label}
                    <small>{s.hint}</small>
                  </button>
                ))}
              </div>
              <div className="modal-sub">Trang phục (nam &amp; nữ — chọn trên hình)</div>
              <div className="opt-thumbs scroll-x">
                {sceneOutfits.map((o) => (
                  <button
                    key={`${o.gender}-${o.id}`}
                    className="opt-thumb"
                    aria-pressed={avatarSel.gender === o.gender && avatarSel.outfit === o.id}
                    onClick={() => pickOutfit(o.gender, o.id)}
                    title={o.label}
                  >
                    <img src={lookOf(o.gender, o.id)} alt={o.label} onError={onLookErr} />
                    <span>{o.label}</span>
                  </button>
                ))}
              </div>
              <div className="sub-pair">
                <div>
                  <div className="modal-sub">Màu chủ đạo</div>
                  <div className="opt-row">
                    {THEMES.map((t) => (
                      <button key={t.id} className={`opt sw-opt ${t.id}`} aria-pressed={theme === t.id} onClick={() => onTheme(t.id)}>
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="modal-sub">Tốc độ</div>
                  <div className="opt-row">
                    {SPEEDS.map((s) => (
                      <button key={s.id} className="opt" aria-pressed={Math.abs(rate - s.rate) < 0.01}
                        onClick={() => { setRate(s.rate); saveVoicePrefs({ rate: s.rate }); }}>
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="modal-sec">
              <div className="modal-tl">Giọng nói</div>

              <div className="modal-sub">Chọn giọng (tự nhận thiết bị · chọn là nghe thử luôn)</div>
              <div className="opt-row scroll-x">
                {voiceList.map((v) => (
                  <button key={v.uri || 'eva'} className="opt" aria-pressed={voiceURI === v.uri} onClick={() => pickVoice(v.uri)}>
                    {v.name}
                    <small>{v.sub}</small>
                  </button>
                ))}
              </div>

              <div className="modal-sub">Tính cách</div>
              <div className="opt-row">
                {PERSONAS.map((p) => {
                  const PIcon = PERSONA_ICON[p.id];
                  return (
                    <button key={p.id} className="opt opt-ic" aria-pressed={persona === p.id}
                      onClick={() => { setPersona(p.id); saveVoicePrefs({ persona: p.id }); }}>
                      <b className="ic">{PIcon ? <PIcon /> : p.icon}</b>
                      {p.label}
                    </button>
                  );
                })}
              </div>

              <button className="adv-toggle" aria-pressed={showAdv} onClick={() => setShowAdv((v) => !v)}>
                <IconSettings /> Nâng cao {showAdv ? <IconChevronUp /> : <IconChevronDown />}
              </button>
              {showAdv && (
                <div className="adv-box">
                  <div className="modal-row">
                    <label>Engine</label>
                    <Dropdown value={ttsEngine} onChange={(v) => setTtsEngine(v as TTSConfig['engine'])}
                      options={[
                        { value: 'system', label: 'Giọng hệ thống (miễn phí)' },
                        { value: 'edge', label: 'Edge — Microsoft (tiếng Việt, free)' },
                        { value: 'vieneu', label: 'VieNeu — server nhà (bảo mật)' },
                        { value: 'elevenlabs', label: 'ElevenLabs (cloud, cần key)' },
                      ]} />
                  </div>
                  {ttsEngine === 'elevenlabs' && (
                    <div className="modal-row"><label>ElevenLabs key</label>
                      <input type="password" value={ttsKey} onChange={(e) => setTtsKey(e.target.value)} placeholder="xi-…" autoComplete="off" spellCheck={false} /></div>
                  )}
                  {(ttsEngine === 'vieneu' || ttsEngine === 'edge') && (
                    <div className="modal-row"><label>Server URL</label>
                      <input type="text" value={ttsServer} onChange={(e) => setTtsServer(e.target.value)} placeholder={ttsEngine === 'edge' ? EDGE_DEFAULT_URL : VIENEU_DEFAULT_URL} spellCheck={false} /></div>
                  )}
                  <div className="modal-actions">
                    <button className="mbtn primary" onClick={saveTts}>Lưu giọng</button>
                    {ttsSaved && <span className="modal-status">{ttsSaved}</span>}
                  </div>
                </div>
              )}

              <label className="modal-check">
                <input type="checkbox" checked={vadOn} onChange={(e) => { setVadOn(e.target.checked); saveVadEnabled(e.target.checked); }} />
                <span><b>Ngắt lời bằng giọng (VAD)</b></span>
              </label>
            </div>
            </div>{/* /iface-left */}

            {/* PHẢI: xem trước hình mẫu áo + chọn model + độ hiển thị */}
            <div className="iface-right">
              <div className="preview-head">
                <div className="modal-tl">Hình mẫu áo</div>
                <button className="mbtn" onClick={() => setPreviewKey((k) => k + 1)} title="Tải lại ảnh"><IconRefresh /> Làm mới</button>
              </div>
              <div className="preview-card">
                <img className="preview-img" src={lookOf(avatarSel.gender, avatarSel.outfit)} alt="Xem trước trang phục" onError={onLookErr} />
                <div className="preview-actions">
                  <button onClick={nextOutfit} title="Đổi trang phục"><IconShirt /><small>Thay đổi</small></button>
                  <button title="Đổi tư thế (sắp có)"><IconPerson /><small>Tư thế</small></button>
                  <button onClick={nextScene} title="Đổi bối cảnh / nền"><IconScene /><small>Nền</small></button>
                </div>
              </div>
              <div className="slider-row">
                <span>Độ hiển thị</span>
                <input type="range" min={20} max={100} value={Math.round(avatarOpacity * 100)}
                  onChange={(e) => onAvatarOpacity(Number(e.target.value) / 100)} />
                <span className="slider-val">{Math.round(avatarOpacity * 100)}%</span>
              </div>
            </div>
          </div>
        )}

        {/* ── MODEL (LLM) ── */}
        {tab === 'model' && (
          <div className="modal-sec">
            <div className="modal-tl">Bộ não (LLM)</div>
            <div className="modal-row">
              <label>Nhà cung cấp</label>
              <Dropdown
                value={provider}
                onChange={(v) => { setProvider(v as LLMConfig['provider']); setModel(''); setCustom(false); }}
                options={[
                  { value: 'anthropic', label: 'Claude (Anthropic)' },
                  { value: 'openai', label: 'OpenAI' },
                ]}
              />
            </div>
            <div className="modal-row">
              <label>API key</label>
              <input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)}
                placeholder={provider === 'anthropic' ? 'sk-ant-…' : 'sk-…'} autoComplete="off" spellCheck={false} />
            </div>
            <div className="modal-row">
              <label>Model</label>
              <Dropdown
                value={custom ? CUSTOM : model}
                onChange={(v) => {
                  if (v === CUSTOM) { setCustom(true); setModel(''); }
                  else { setCustom(false); setModel(v); }
                }}
                options={[
                  { value: '', label: `Mặc định (${defaultModelFor(provider)})` },
                  ...MODELS[provider as 'anthropic' | 'openai'].map((m) => ({ value: m.id, label: m.label })),
                  { value: CUSTOM, label: 'Khác (tự nhập)…' },
                ]}
              />
            </div>
            {custom && (
              <div className="modal-row">
                <label>Tên model</label>
                <input type="text" value={model} onChange={(e) => setModel(e.target.value)}
                  placeholder={defaultModelFor(provider) || 'nhập tên model'} spellCheck={false} />
              </div>
            )}
            <div className="modal-actions">
              <button className="mbtn primary" onClick={save}>Lưu</button>
              <button className="mbtn" onClick={clear}>Xoá key</button>
              <button className="mbtn" onClick={runBrainTest} disabled={testing}>🧠 Kiểm tra bộ não</button>
              <span className="modal-status">{brainTest ?? saved ?? `Đang chạy: ${brainName}`}</span>
            </div>
            <label className="modal-check">
              <input type="checkbox" checked={webSearch} onChange={(e) => setWebSearch(e.target.checked)} />
              <span>
                <b>Tìm kiếm web (như Grok).</b> Mira tự tra thông tin mới (tin tức, thời tiết, giá…) khi câu
                hỏi cần rồi trả lời gọn. Hỗ trợ Claude (Anthropic); bấm <b>Lưu</b> để áp dụng.
              </span>
            </label>
            <div className="modal-note">
              ⚠️ Key lưu trong localStorage của trình duyệt và gọi LLM trực tiếp từ trang — chỉ dùng cho
              máy cá nhân/dev. Bản production sẽ gọi qua server proxy.
            </div>
          </div>
        )}

        {/* ── THÔNG BÁO ── */}
        {tab === 'notify' && (
          <div className="modal-sec">
            <div className="modal-tl">Thông báo</div>
            <label className="modal-check">
              <input type="checkbox" checked={!!notify.browser} onChange={(e) => toggleBrowserNotify(e.target.checked)} />
              <span><b>Thông báo trên trình duyệt.</b> Cho phép Mira gửi thông báo hệ thống (xin quyền khi bật).</span>
            </label>
            <label className="modal-check">
              <input type="checkbox" checked={!!notify.sound} onChange={(e) => setNotifyKey('sound', e.target.checked)} />
              <span><b>Âm báo.</b> Phát tiếng nhẹ khi Mira trả lời xong.</span>
            </label>
            <label className="modal-check">
              <input type="checkbox" checked={!!notify.proactive} onChange={(e) => setNotifyKey('proactive', e.target.checked)} />
              <span><b>Mira chủ động.</b> Em chủ động chào/nhắc việc khi hợp lúc.</span>
            </label>
            <div className="modal-note">
              Tuỳ chọn được lưu lại. Âm báo &amp; chủ động sẽ kích hoạt theo các bản cập nhật tới.
            </div>
          </div>
        )}

        {/* ── HƯỚNG DẪN ── */}
        {tab === 'guide' && (
          <div className="modal-sec">
            <div className="modal-tl">Hướng dẫn sử dụng</div>
            <ul className="guide">
              <li><IconMic /> <b>Nói một lượt:</b> bấm nút mic (hoặc phím <b>Space</b>) rồi nói.</li>
              <li><IconRepeat /> <b>Trò chuyện trực tiếp:</b> bấm để nói qua lại liên tục; bấm lại để dừng.</li>
              <li><IconStop /> <b>Ngắt lời:</b> Mira đang nói, bấm mic/Space là dừng. Bật <b>VAD</b> (tab Giao diện) để ngắt bằng giọng.</li>
              <li><IconCamera /> <b>Camera:</b> nút Camera trên đầu — avatar nhìn &amp; biểu cảm theo anh qua webcam (cần HTTPS).</li>
              <li><IconOrb /> <b>Orb / Avatar:</b> nút Orb đổi giữa nhân vật 3D và quả cầu giọng nói.</li>
              <li><IconSpeech /> <b>Giọng Việt tự nhiên:</b> tab Giao diện → Giọng nói → <b>Edge</b> (free) hoặc <b>VieNeu</b> (bảo mật).</li>
              <li><IconBrain /> <b>Thông minh hơn:</b> tab Model → dán API key Claude → bật <b>Tìm kiếm web</b> để hỏi tin mới.</li>
              <li><IconShirt /> <b>Nhân vật:</b> tab Giao diện → chọn bối cảnh, giới tính, trang phục.</li>
            </ul>
            <div className="modal-note">
              Không nghe thấy gì? Kiểm tra âm lượng máy, đúng thiết bị output, tab trình duyệt không bị tắt tiếng.
            </div>

            <div className="modal-tl" style={{ marginTop: 16 }}>Thử nhanh (demo — không cần mic)</div>
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
                <button onClick={onSimulate}>{simulating ? '■ Dừng' : '▶ Mô phỏng hội thoại'}</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
