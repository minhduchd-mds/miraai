import { useEffect, useMemo, useState } from 'react';
import { defaultModelFor, loadLLMConfig, type LLMConfig } from '../core/brain';
import type { TTSDiagnostics } from '../core/tts/webspeech-tts';

interface Props {
  open: boolean;
  onClose: () => void;
  brainName: string;
  onSaveLLM: (cfg: LLMConfig) => void;
  onTestVoice: () => void;
  getDiagnostics: () => TTSDiagnostics;
}

export default function DevConsole({
  open, onClose, brainName, onSaveLLM, onTestVoice, getDiagnostics,
}: Props) {
  const initial = useMemo(() => (open ? loadLLMConfig() : null), [open]);
  const [provider, setProvider] = useState<LLMConfig['provider']>('anthropic');
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('');
  const [saved, setSaved] = useState<string | null>(null);
  const [diag, setDiag] = useState<TTSDiagnostics | null>(null);

  // Nạp config hiện tại mỗi lần mở popup.
  useEffect(() => {
    if (!initial) return;
    setProvider(initial.provider || 'anthropic');
    setApiKey(initial.apiKey);
    setModel(initial.model);
    setSaved(null);
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
            <span className="modal-status">{saved ?? `Đang chạy: ${brainName}`}</span>
          </div>
          <div className="modal-note">
            ⚠️ Key lưu trong localStorage của trình duyệt và gọi LLM trực tiếp từ trang — chỉ dùng cho
            máy cá nhân/dev. Bản production sẽ gọi qua server proxy.
          </div>
        </div>

        <div className="modal-sec">
          <div className="modal-tl">Kiểm tra giọng nói</div>
          <div className="modal-actions">
            <button className="mbtn primary" onClick={onTestVoice}>🔊 Đọc thử</button>
            {diag && (
              <span className="modal-status">
                giọng: {diag.voices} ({diag.viVoices} vi) · {diag.speaking ? 'ĐANG NÓI' : diag.pending ? 'chờ' : 'im'}
                {diag.paused ? ' · PAUSED' : ''}
                {diag.lastError ? ` · lỗi: ${diag.lastError}` : ''}
              </span>
            )}
          </div>
          <div className="modal-note">
            Không nghe thấy gì khi bấm Đọc thử? Kiểm tra: âm lượng máy &amp; thiết bị output đúng loa,
            tab Chrome không bị tắt tiếng (chuột phải tab → Unmute), và System Settings → Spotlight/Siri
            không chiếm mic. Nếu "ĐANG NÓI" hiện mà vẫn im → máy đang xuất âm ra thiết bị khác.
          </div>
        </div>
      </div>
    </div>
  );
}
