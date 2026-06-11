import { useEffect, useMemo, useState } from 'react';
import { defaultModelFor, loadLLMConfig, type LLMConfig } from '../core/brain';
import { loadTTSConfig, VIENEU_DEFAULT_URL, type TTSConfig, type TTSDiagnostics } from '../core/tts';

interface Props {
  open: boolean;
  onClose: () => void;
  brainName: string;
  onSaveLLM: (cfg: LLMConfig) => void;
  onSaveTTS: (cfg: TTSConfig) => void;
  onTestBrain: () => Promise<string>;
  onTestVoice: () => void;
  getDiagnostics: () => TTSDiagnostics;
}

export default function DevConsole({
  open, onClose, brainName, onSaveLLM, onSaveTTS, onTestBrain, onTestVoice, getDiagnostics,
}: Props) {
  const initial = useMemo(() => (open ? loadLLMConfig() : null), [open]);
  const [provider, setProvider] = useState<LLMConfig['provider']>('anthropic');
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('');
  const [saved, setSaved] = useState<string | null>(null);
  const [diag, setDiag] = useState<TTSDiagnostics | null>(null);
  const [brainTest, setBrainTest] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [ttsEngine, setTtsEngine] = useState<TTSConfig['engine']>('system');
  const [ttsKey, setTtsKey] = useState('');
  const [ttsServer, setTtsServer] = useState('');
  const [ttsSaved, setTtsSaved] = useState<string | null>(null);

  // Nạp config hiện tại mỗi lần mở popup.
  useEffect(() => {
    if (!initial) return;
    setProvider(initial.provider || 'anthropic');
    setApiKey(initial.apiKey);
    setModel(initial.model);
    setSaved(null);
    setBrainTest(null);
    const t = loadTTSConfig();
    setTtsEngine(t.engine);
    setTtsKey(t.apiKey);
    setTtsServer(t.serverUrl);
    setTtsSaved(null);
  }, [initial]);

  // Live cập nhật bảng chẩn đoán TTS trong lúc popup mở.
  useEffect(() => {
    if (!open) return;
    setDiag(getDiagnostics());
    const id = window.setInterval(() => setDiag(getDiagnostics()), 500);
    return () => clearInterval(id);
  }, [open, getDiagnostics]);

  // Esc để đóng.
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
    onSaveLLM({ provider, apiKey: apiKey.trim(), model: model.trim() });
    setSaved(apiKey.trim() ? 'Đã lưu — bộ não LLM đang chạy.' : 'Đã xoá key — quay về brain demo.');
  };
  const clear = () => {
    setApiKey('');
    setModel('');
    onSaveLLM({ provider: '', apiKey: '', model: '' });
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
      ttsEngine === 'vieneu'
        ? 'Đã đổi sang VieNeu (server nhà) — bấm Đọc thử để nghe.'
        : ttsEngine === 'elevenlabs' && ttsKey.trim()
          ? 'Đã đổi sang giọng ElevenLabs — bấm Đọc thử để nghe.'
          : 'Đang dùng giọng hệ thống (miễn phí).',
    );
  };

  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-label="Developer Console">
        <div className="modal-head">
          <b>⌘ Developer Console</b>
          <button className="modal-x" onClick={onClose} aria-label="Đóng">✕</button>
        </div>

        <div className="modal-sec">
          <div className="modal-tl">Bộ não (LLM)</div>
          <div className="modal-row">
            <label>Nhà cung cấp</label>
            <select value={provider} onChange={(e) => setProvider(e.target.value as LLMConfig['provider'])}>
              <option value="anthropic">Claude (Anthropic)</option>
              <option value="openai">OpenAI</option>
            </select>
          </div>
          <div className="modal-row">
            <label>API key</label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={provider === 'anthropic' ? 'sk-ant-…' : 'sk-…'}
              autoComplete="off"
              spellCheck={false}
            />
          </div>
          <div className="modal-row">
            <label>Model</label>
            <input
              type="text"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder={defaultModelFor(provider) || 'mặc định'}
              spellCheck={false}
            />
          </div>
          <div className="modal-actions">
            <button className="mbtn primary" onClick={save}>Lưu</button>
            <button className="mbtn" onClick={clear}>Xoá key</button>
            <button className="mbtn" onClick={runBrainTest} disabled={testing}>🧠 Kiểm tra bộ não</button>
            <span className="modal-status">{brainTest ?? saved ?? `Đang chạy: ${brainName}`}</span>
          </div>
          <div className="modal-note">
            ⚠️ Key lưu trong localStorage của trình duyệt và gọi LLM trực tiếp từ trang — chỉ dùng cho
            máy cá nhân/dev. Bản production sẽ gọi qua server proxy.
          </div>
        </div>

        <div className="modal-sec">
          <div className="modal-tl">Giọng nói</div>
          <div className="modal-row">
            <label>Engine</label>
            <select value={ttsEngine} onChange={(e) => setTtsEngine(e.target.value as TTSConfig['engine'])}>
              <option value="system">Giọng hệ thống (miễn phí)</option>
              <option value="vieneu">VieNeu — server nhà (tự nhiên, bảo mật)</option>
              <option value="elevenlabs">ElevenLabs (cloud, cần key)</option>
            </select>
          </div>
          {ttsEngine === 'elevenlabs' && (
            <div className="modal-row">
              <label>ElevenLabs key</label>
              <input
                type="password"
                value={ttsKey}
                onChange={(e) => setTtsKey(e.target.value)}
                placeholder="xi-…  (free tier ~10k ký tự/tháng)"
                autoComplete="off"
                spellCheck={false}
              />
            </div>
          )}
          {ttsEngine === 'vieneu' && (
            <div className="modal-row">
              <label>Server URL</label>
              <input
                type="text"
                value={ttsServer}
                onChange={(e) => setTtsServer(e.target.value)}
                placeholder={VIENEU_DEFAULT_URL}
                spellCheck={false}
              />
            </div>
          )}
          <div className="modal-actions">
            <button className="mbtn primary" onClick={saveTts}>Lưu giọng</button>
            <button className="mbtn" onClick={onTestVoice}>🔊 Đọc thử</button>
            {(ttsSaved || diag) && (
              <span className="modal-status">
                {ttsSaved ? `${ttsSaved} · ` : ''}
                {diag &&
                  `giọng: ${diag.voices} (${diag.viVoices} vi) · ${diag.speaking ? 'ĐANG NÓI' : diag.pending ? 'chờ' : 'im'}${diag.paused ? ' · PAUSED' : ''}${diag.lastError ? ` · lỗi: ${diag.lastError}` : ''}`}
              </span>
            )}
          </div>
          <div className="modal-note">
            Giọng hệ thống (Linh) là giọng máy của macOS. Tự nhiên + bảo mật nhất: <b>VieNeu</b> — chạy
            server trong thư mục <code>server/</code> của repo (xem server/README.md) rồi chọn ở trên;
            miệng Mira sẽ khớp âm thanh thật. Nhanh gọn cloud: ElevenLabs (key free tại elevenlabs.io).
            Không nghe thấy gì khi bấm Đọc thử? Kiểm tra: âm lượng máy &amp; đúng thiết bị output,
            tab Chrome không bị tắt tiếng (chuột phải tab → Unmute). "ĐANG NÓI" hiện mà vẫn im →
            máy đang xuất âm ra thiết bị khác.
          </div>
        </div>
      </div>
    </div>
  );
}
