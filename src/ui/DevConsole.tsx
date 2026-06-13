import { useEffect, useMemo, useRef, useState } from 'react';
import { defaultModelFor, loadLLMConfig, type LLMConfig } from '../core/brain';
import { loadTTSConfig, VIENEU_DEFAULT_URL, EDGE_DEFAULT_URL, type TTSConfig, type TTSDiagnostics } from '../core/tts';
import { loadVadEnabled, saveVadEnabled } from '../core/vad/config';
import { SCENES, GENDERS, OUTFITS, lookImage, type AvatarSel, type Scene } from '../core/avatar-config';
import type { Theme } from '../core/types';

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
}

export default function DevConsole({
  open, onClose, brainName, onSaveLLM, onSaveTTS, onTestBrain, onTestVoice, getDiagnostics,
  theme, onTheme, avatarSel, onAvatarChange, avatarOpacity, onAvatarOpacity,
}: Props) {
  const initial = useMemo(() => (open ? loadLLMConfig() : null), [open]);
  const [tab, setTab] = useState<Tab>('interface');
  const [previewKey, setPreviewKey] = useState(0); // bust cache ảnh khi "Làm mới"
  const thumbRow = useRef<HTMLDivElement>(null);
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
  }, [initial]);

  useEffect(() => {
    if (!open) return;
    setDiag(getDiagnostics());
    const id = window.setInterval(() => setDiag(getDiagnostics()), 500);
    return () => clearInterval(id);
  }, [open, getDiagnostics]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
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

  // ── Nhân vật (bối cảnh → giới tính → trang phục) ──
  const outfits = OUTFITS[avatarSel.gender][avatarSel.scene];
  const setScene = (scene: AvatarSel['scene']) =>
    onAvatarChange({ ...avatarSel, scene, outfit: OUTFITS[avatarSel.gender][scene][0].id });
  const setGender = (gender: AvatarSel['gender']) =>
    onAvatarChange({ ...avatarSel, gender, outfit: OUTFITS[gender][avatarSel.scene][0].id });
  const setOutfit = (outfit: string) => onAvatarChange({ ...avatarSel, outfit });
  const sceneOrder: Scene[] = ['office', 'home', 'intimate'];
  const nextScene = () => setScene(sceneOrder[(sceneOrder.indexOf(avatarSel.scene) + 1) % sceneOrder.length]);
  const nextOutfit = () => {
    const i = outfits.findIndex((o) => o.id === avatarSel.outfit);
    setOutfit(outfits[(i + 1) % outfits.length].id);
  };
  const lookOf = (outfit: string) => lookImage({ ...avatarSel, outfit }) + (previewKey ? `?k=${previewKey}` : '');
  const onLookErr = (e: { currentTarget: HTMLImageElement }) => {
    const t = e.currentTarget;
    if (!t.src.includes('mira.webp')) t.src = '/avatars/mira.webp';
  };
  const scrollThumbs = (d: number) => thumbRow.current?.scrollBy({ left: d, behavior: 'smooth' });

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
      <div className="modal" role="dialog" aria-label="Cài đặt">
        <div className="modal-head">
          <b>⌘ Cài đặt</b>
          <button className="modal-x" onClick={onClose} aria-label="Đóng">✕</button>
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
              <div className="modal-sub">Giới tính</div>
              <div className="opt-row">
                {GENDERS.map((g) => (
                  <button key={g.id} className="opt" aria-pressed={avatarSel.gender === g.id} onClick={() => setGender(g.id)}>
                    {g.label}
                  </button>
                ))}
              </div>
              <div className="modal-sub">Trang phục (gợi ý theo bối cảnh)</div>
              <div className="opt-row">
                {outfits.map((o) => (
                  <button key={o.id} className="opt" aria-pressed={avatarSel.outfit === o.id} onClick={() => setOutfit(o.id)}>
                    {o.label}
                  </button>
                ))}
              </div>
              <div className="modal-sub">Màu chủ đạo</div>
              <div className="opt-row">
                {THEMES.map((t) => (
                  <button
                    key={t.id}
                    className={`opt sw-opt ${t.id}`}
                    aria-pressed={theme === t.id}
                    onClick={() => onTheme(t.id)}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              <div className="modal-note">
                Đổi trang phục chỉ hiện hình khi đã có file model tương ứng trong
                <code> public/avatars/ </code> (tên <code>&lt;giới tính&gt;-&lt;bối cảnh&gt;-&lt;trang phục&gt;.vrm</code>);
                chưa có thì giữ model hiện tại. Mục 18+ chỉ là nhãn phân loại.
              </div>
            </div>

            <div className="modal-sec">
              <div className="modal-tl">Giọng nói</div>
              <div className="modal-row">
                <label>Engine</label>
                <select value={ttsEngine} onChange={(e) => setTtsEngine(e.target.value as TTSConfig['engine'])}>
                  <option value="system">Giọng hệ thống (miễn phí)</option>
                  <option value="edge">Edge — Microsoft (tiếng Việt tự nhiên, free)</option>
                  <option value="vieneu">VieNeu — server nhà (tự nhiên, bảo mật)</option>
                  <option value="elevenlabs">ElevenLabs (cloud, cần key)</option>
                </select>
              </div>
              {ttsEngine === 'elevenlabs' && (
                <div className="modal-row">
                  <label>ElevenLabs key</label>
                  <input type="password" value={ttsKey} onChange={(e) => setTtsKey(e.target.value)}
                    placeholder="xi-…  (free tier ~10k ký tự/tháng)" autoComplete="off" spellCheck={false} />
                </div>
              )}
              {(ttsEngine === 'vieneu' || ttsEngine === 'edge') && (
                <div className="modal-row">
                  <label>Server URL</label>
                  <input type="text" value={ttsServer} onChange={(e) => setTtsServer(e.target.value)}
                    placeholder={ttsEngine === 'edge' ? EDGE_DEFAULT_URL : VIENEU_DEFAULT_URL} spellCheck={false} />
                </div>
              )}
              <div className="modal-actions">
                <button className="mbtn primary" onClick={saveTts}>Lưu giọng</button>
                <button className="mbtn" onClick={onTestVoice}>🔊 Đọc thử</button>
                {(ttsSaved || diag) && (
                  <span className="modal-status">
                    {ttsSaved ? `${ttsSaved} · ` : ''}
                    {diag && `giọng: ${diag.voices} (${diag.viVoices} vi) · ${diag.speaking ? 'ĐANG NÓI' : diag.pending ? 'chờ' : 'im'}${diag.paused ? ' · PAUSED' : ''}${diag.lastError ? ` · lỗi: ${diag.lastError}` : ''}`}
                  </span>
                )}
              </div>
              <label className="modal-check">
                <input type="checkbox" checked={vadOn} onChange={(e) => { setVadOn(e.target.checked); saveVadEnabled(e.target.checked); }} />
                <span>
                  <b>Ngắt lời bằng giọng (VAD — thử nghiệm).</b> Mira đang nói mà anh cất tiếng là em dừng ngay
                  (full-duplex như Grok). Lần đầu tải model ~1–2MB. Nên đeo tai nghe.
                </span>
              </label>
            </div>
            </div>{/* /iface-left */}

            {/* PHẢI: xem trước hình mẫu áo + chọn model + độ hiển thị */}
            <div className="iface-right">
              <div className="preview-head">
                <div className="modal-tl">Hình mẫu áo</div>
                <button className="mbtn" onClick={() => setPreviewKey((k) => k + 1)} title="Tải lại ảnh">↻ Làm mới</button>
              </div>
              <div className="preview-card">
                <img className="preview-img" src={lookOf(avatarSel.outfit)} alt="Xem trước trang phục" onError={onLookErr} />
                <div className="preview-actions">
                  <button onClick={nextOutfit} title="Đổi trang phục">👗<small>Thay đổi</small></button>
                  <button title="Đổi tư thế (sắp có)">🧍<small>Tư thế</small></button>
                  <button onClick={nextScene} title="Đổi bối cảnh / nền">🖼️<small>Nền</small></button>
                </div>
              </div>
              <div className="modal-sub">Chọn model</div>
              <div className="thumbs">
                <button className="thumb-arrow" onClick={() => scrollThumbs(-180)} aria-label="Trước">‹</button>
                <div className="thumb-row" ref={thumbRow}>
                  {outfits.map((o) => (
                    <button key={o.id} className="thumb" aria-pressed={avatarSel.outfit === o.id} onClick={() => setOutfit(o.id)} title={o.label}>
                      <img src={lookOf(o.id)} alt={o.label} onError={onLookErr} />
                    </button>
                  ))}
                </div>
                <button className="thumb-arrow" onClick={() => scrollThumbs(180)} aria-label="Sau">›</button>
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
              <select value={provider} onChange={(e) => { setProvider(e.target.value as LLMConfig['provider']); setModel(''); setCustom(false); }}>
                <option value="anthropic">Claude (Anthropic)</option>
                <option value="openai">OpenAI</option>
              </select>
            </div>
            <div className="modal-row">
              <label>API key</label>
              <input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)}
                placeholder={provider === 'anthropic' ? 'sk-ant-…' : 'sk-…'} autoComplete="off" spellCheck={false} />
            </div>
            <div className="modal-row">
              <label>Model</label>
              <select
                value={custom ? CUSTOM : model}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === CUSTOM) { setCustom(true); setModel(''); }
                  else { setCustom(false); setModel(v); }
                }}
              >
                <option value="">Mặc định ({defaultModelFor(provider)})</option>
                {MODELS[provider as 'anthropic' | 'openai'].map((m) => (
                  <option key={m.id} value={m.id}>{m.label}</option>
                ))}
                <option value={CUSTOM}>Khác (tự nhập)…</option>
              </select>
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
              <li>🎙️ <b>Nói một lượt:</b> bấm nút mic (hoặc phím <b>Space</b>) rồi nói.</li>
              <li>🔁 <b>Trò chuyện trực tiếp:</b> bấm để nói qua lại liên tục; bấm lại để dừng.</li>
              <li>✋ <b>Ngắt lời:</b> Mira đang nói, bấm mic/Space là dừng. Bật <b>VAD</b> (tab Giao diện) để ngắt bằng giọng.</li>
              <li>📷 <b>Camera:</b> nút 📷 trên đầu — avatar nhìn &amp; biểu cảm theo anh qua webcam (cần HTTPS).</li>
              <li>🔮 <b>Orb / Avatar:</b> nút 🔮 đổi giữa nhân vật 3D và quả cầu giọng nói.</li>
              <li>🗣️ <b>Giọng Việt tự nhiên:</b> tab Giao diện → Giọng nói → <b>Edge</b> (free) hoặc <b>VieNeu</b> (bảo mật).</li>
              <li>🧠 <b>Thông minh hơn:</b> tab Model → dán API key Claude → bật <b>Tìm kiếm web</b> để hỏi tin mới.</li>
              <li>👗 <b>Nhân vật:</b> tab Giao diện → chọn bối cảnh, giới tính, trang phục.</li>
            </ul>
            <div className="modal-note">
              Không nghe thấy gì? Kiểm tra âm lượng máy, đúng thiết bị output, tab trình duyệt không bị tắt tiếng.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
