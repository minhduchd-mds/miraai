import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import type { Theme, VoiceOption } from '../core/types';
import { isDesktopRuntime } from '../desktop/bridge';
import type { MiraConnectivityReport } from '../runtime/connectivity-diagnostics';
import {
  chooseDesktopMusicFolder,
  loadDesktopPrivacyState,
  rescanDesktopMusicLibrary,
  setDesktopPermission,
  type DesktopPermissionKey,
  type DesktopPrivacyState,
} from '../desktop/preferences';
import type { TTSDiagnostics } from '../core/tts';
import { loadSmartTurn, saveSmartTurn } from '../core/stt/turn-config';
import { loadVadEnabled, saveVadEnabled } from '../core/vad/config';
import {
  buildDeviceDiagnosticsReport,
  runDeviceDiagnostics,
  type DevicePermissionState,
  type MiraDeviceDiagnostics,
} from '../runtime/device-diagnostics';
import {
  loadVoicePrefs,
  PERSONAS,
  RESPONSE_LENGTHS,
  saveVoicePrefs,
  SPEEDS,
  type ResponseLength,
} from '../core/voice-prefs';
import { exportIdentityCapsule, importIdentityCapsule } from '../intelligence/identity/capsule-client';
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
const StructuredMemoryInspector = lazy(() => import('./StructuredMemoryInspector'));

import './settings-v2.css';

interface Props {
  open: boolean;
  onClose: () => void;
  theme: Theme;
  onTheme: (theme: Theme) => void;
  voices: VoiceOption[];
  voiceURI?: string;
  onSelectVoice: (uri: string) => void;
  onTestVoice: () => void;
  getVoiceDiagnostics: () => TTSDiagnostics;
  onOpenLabs: () => void;
}

type Tab = 'voice' | 'appearance' | 'memory';
const THEMES: Theme[] = ['nova', 'aura', 'ember', 'iris'];

function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (next: boolean) => void; label: string; hint?: string }) {
  return <label className="v2-setting-row"><span><b>{label}</b>{hint && <small>{hint}</small>}</span><button type="button" className={`v2-switch${checked ? ' on' : ''}`} role="switch" aria-checked={checked} onClick={() => onChange(!checked)}><i /></button></label>;
}

function permissionLabel(state: DevicePermissionState) {
  if (state === 'granted') return 'Đã cấp';
  if (state === 'denied') return 'Bị chặn';
  if (state === 'prompt') return 'Chưa hỏi';
  if (state === 'unsupported') return 'Không đọc được';
  return 'Không rõ';
}

function DeviceCheckItem({ label, value, status = 'neutral' }: { label: string; value: string; status?: 'ok' | 'warn' | 'neutral' }) {
  return <div className="v2-device-item" data-status={status}><span>{label}</span><b>{value}</b></div>;
}

function FactRow({ fact, onChanged }: { fact: MemoryFact; onChanged: () => void }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(fact.fact);
  const [busy, setBusy] = useState(false);
  const save = async () => { if (!value.trim()) return; setBusy(true); try { await updateMemoryFact(fact.id, value.trim()); setEditing(false); onChanged(); } finally { setBusy(false); } };
  const remove = async () => { setBusy(true); try { await forgetMemoryFact(fact.id); onChanged(); } finally { setBusy(false); } };
  return <div className="v2-memory-fact">{editing ? <input value={value} onChange={(event) => setValue(event.target.value)} maxLength={300} aria-label="Nội dung ký ức" /> : <span>{fact.fact}</span>}<div>{editing ? <><button type="button" onClick={() => { setEditing(false); setValue(fact.fact); }} disabled={busy}>Huỷ</button><button type="button" className="primary" onClick={save} disabled={busy || !value.trim()}>Lưu</button></> : <><button type="button" onClick={() => setEditing(true)} disabled={busy}>Sửa</button><button type="button" className="danger" onClick={remove} disabled={busy}>Quên</button></>}</div></div>;
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
  const [capsuleBusy, setCapsuleBusy] = useState(false);
  const [desktopRuntime] = useState(isDesktopRuntime);
  const [desktopPrivacy, setDesktopPrivacy] = useState<DesktopPrivacyState | null>(null);
  const [desktopPrivacyBusy, setDesktopPrivacyBusy] = useState(false);
  const [desktopLibraryBusy, setDesktopLibraryBusy] = useState(false);
  const [voiceDiagnostics, setVoiceDiagnostics] = useState<TTSDiagnostics | null>(null);
  const [deviceDiagnostics, setDeviceDiagnostics] = useState<MiraDeviceDiagnostics | null>(null);
  const [connectivity, setConnectivity] = useState<MiraConnectivityReport | null>(null);
  const [deviceDiagnosticsBusy, setDeviceDiagnosticsBusy] = useState(false);
  const capsuleInputRef = useRef<HTMLInputElement>(null);

  const refreshDesktopPrivacy = useCallback(async () => {
    if (!desktopRuntime) return;
    try { setDesktopPrivacy(await loadDesktopPrivacyState()); }
    catch { setDesktopPrivacy(null); }
  }, [desktopRuntime]);

  const refreshProfile = useCallback(async () => {
    setLoadingProfile(true); setProfileError('');
    try { setProfile(await loadMemoryProfile()); }
    catch { setProfile(null); setProfileError(desktopRuntime ? 'Lỗi đọc SQLite native. Kiểm tra thiết bị trong tab Giọng & hội thoại; không xóa dữ liệu.' : 'Không đọc được ký ức cloud. Kiểm tra cấu hình DATABASE_URL.'); }
    finally { setLoadingProfile(false); }
  }, [desktopRuntime]);

  useEffect(() => {
    if (!props.open) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') props.onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [props.open, props.onClose]);
  useEffect(() => {
    if (props.open && tab === 'memory') {
      void refreshProfile();
      void refreshDesktopPrivacy();
    }
  }, [props.open, refreshDesktopPrivacy, refreshProfile, tab]);
  useEffect(() => {
    if (!props.open || tab !== 'voice') return;
    const refresh = () => {
      try { setVoiceDiagnostics(props.getVoiceDiagnostics()); }
      catch { setVoiceDiagnostics(null); }
    };
    refresh();
    const timer = window.setInterval(refresh, 1500);
    return () => window.clearInterval(timer);
  }, [props.getVoiceDiagnostics, props.open, tab]);
  if (!props.open) return null;

  const runDeviceCheck = async () => {
    if (deviceDiagnosticsBusy) return;
    setDeviceDiagnosticsBusy(true);
    try {
      const [device, network] = await Promise.allSettled([
        runDeviceDiagnostics(),
        import('../runtime/connectivity-diagnostics').then(({ checkMiraConnectivity }) => checkMiraConnectivity()),
      ]);
      setDeviceDiagnostics(device.status === 'fulfilled' ? device.value : null);
      setConnectivity(network.status === 'fulfilled' ? network.value : null);
    } finally { setDeviceDiagnosticsBusy(false); }
  };
  const exportDeviceReport = () => {
    if (!deviceDiagnostics) return;
    const report = buildDeviceDiagnosticsReport(deviceDiagnostics, {
      provider: voiceDiagnostics?.provider || 'unknown',
      health: voiceDiagnostics?.health || 'unknown',
    });
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `mira-device-report-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const changeRate = (next: number) => { setRate(next); saveVoicePrefs({ rate: next }); };
  const changePersona = (next: string) => { setPersona(next); saveVoicePrefs({ persona: next }); };
  const changeResponseLength = (next: ResponseLength) => { setResponseLength(next); saveVoicePrefs({ responseLength: next }); };
  const changeSmart = (next: boolean) => { setSmartTurn(next); saveSmartTurn(next); };
  const changeVad = (next: boolean) => { setVad(next); saveVadEnabled(next); };
  const changeMemory = (next: boolean) => { setMemoryOn(next); setMemoryEnabled(next); };
  const changeDesktopPermission = async (key: DesktopPermissionKey, next: boolean) => {
    setDesktopPrivacyBusy(true); setProfileError('');
    try {
      await setDesktopPermission(key, next);
      setDesktopPrivacy((current) => current ? {
        ...current,
        permissions: { ...current.permissions, [key]: next },
      } : current);
    } catch (error) {
      setProfileError('Không cập nhật được quyền Desktop: ' + (error instanceof Error ? error.message : String(error)));
    } finally { setDesktopPrivacyBusy(false); }
  };
  const chooseMusicFolder = async () => {
    setDesktopLibraryBusy(true); setProfileError('');
    try {
      const musicLibrary = await chooseDesktopMusicFolder();
      setDesktopPrivacy((current) => current ? { ...current, permissions: { ...current.permissions, 'media.library': true }, musicLibrary } : current);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!/chưa chọn thư mục/i.test(message)) setProfileError('Không tạo được thư viện nhạc local: ' + message);
    } finally { setDesktopLibraryBusy(false); }
  };
  const rescanMusic = async () => {
    setDesktopLibraryBusy(true); setProfileError('');
    try {
      const musicLibrary = await rescanDesktopMusicLibrary();
      setDesktopPrivacy((current) => current ? { ...current, musicLibrary } : current);
    } catch (error) {
      setProfileError('Không quét lại được thư viện nhạc: ' + (error instanceof Error ? error.message : String(error)));
    } finally { setDesktopLibraryBusy(false); }
  };
  const eraseAll = async () => {
    if (!window.confirm('Xoá toàn bộ lịch sử và hồ sơ Mira đã ghi nhớ? Thao tác này không hoàn tác được.')) return;
    setProfileError('');
    try {
      await forgetAllMemory();
      await refreshProfile();
    } catch (error) {
      setProfileError('Không xóa được ký ức; vui lòng kiểm tra lại bộ nhớ native: ' +
        (error instanceof Error ? error.message : String(error)));
    }
  };
  const exportCapsule = async () => {
    setCapsuleBusy(true); setProfileError('');
    try { await exportIdentityCapsule(props.theme, props.voiceURI); }
    catch (error) { setProfileError('Không tạo được Identity Capsule: ' + (error instanceof Error ? error.message : String(error))); }
    finally { setCapsuleBusy(false); }
  };
  const importCapsule = async (file?: File) => {
    if (!file) return;
    if (!window.confirm('Nhập Identity Capsule này vào Mira? Dữ liệu sẽ được gộp, không xoá ký ức hiện có.')) {
      if (capsuleInputRef.current) capsuleInputRef.current.value = '';
      return;
    }
    setCapsuleBusy(true); setProfileError('');
    try {
      const restored = await importIdentityCapsule(file);
      if (restored.theme) props.onTheme(restored.theme);
      if (restored.voiceURI != null) props.onSelectVoice(restored.voiceURI);
      const vp = loadVoicePrefs();
      setRate(vp.rate); setPersona(vp.persona); setResponseLength(vp.responseLength);
      setSmartTurn(loadSmartTurn()); setVad(loadVadEnabled()); setMemoryOn(memoryEnabled());
      await refreshProfile();
    } catch (error) {
      setProfileError('Không nhập được Identity Capsule: ' + (error instanceof Error ? error.message : String(error)));
    } finally {
      setCapsuleBusy(false);
      if (capsuleInputRef.current) capsuleInputRef.current.value = '';
    }
  };
  const selectedResponseLength = RESPONSE_LENGTHS.find((item) => item.id === responseLength) ?? RESPONSE_LENGTHS[1];
  const voiceStatus = voiceDiagnostics?.health === 'healthy'
    ? 'Sẵn sàng'
    : voiceDiagnostics?.health === 'unhealthy'
      ? 'Đang phục hồi'
      : 'Đang kiểm tra';

  return (
    <div className="v2-settings-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && props.onClose()}>
      <section className="v2-settings" role="dialog" aria-modal="true" aria-labelledby="mira-settings-title">
        <header><div><span>CÀI ĐẶT</span><h2 id="mira-settings-title">Mira của anh</h2></div><button type="button" className="v2-settings-close" onClick={props.onClose} aria-label="Đóng cài đặt">×</button></header>
        <nav className="v2-settings-tabs" aria-label="Nhóm cài đặt">
          <button type="button" className={tab === 'voice' ? 'active' : ''} onClick={() => setTab('voice')}>Giọng & hội thoại</button>
          <button type="button" className={tab === 'appearance' ? 'active' : ''} onClick={() => setTab('appearance')}>Giao diện</button>
          <button type="button" className={tab === 'memory' ? 'active' : ''} onClick={() => setTab('memory')}>Ký ức & riêng tư</button>
        </nav>
        <div className="v2-settings-body">
          {tab === 'voice' && <>
            <div className="v2-setting-group">
              <h3>Giọng nói</h3>
              <label className="v2-field"><span>Giọng Mira</span><select value={props.voiceURI || ''} onChange={(event) => props.onSelectVoice(event.target.value)}><option value="">Tự động · Tiếng Việt</option>{props.voices.map((voice) => <option key={voice.voiceURI || voice.name} value={voice.voiceURI}>{voice.name}</option>)}</select></label>
              <div className="v2-voice-runtime" data-health={voiceDiagnostics?.health || 'unknown'}>
                <i aria-hidden="true" />
                <span><b>{voiceDiagnostics?.provider || 'Đang kiểm tra'}</b><small>{voiceStatus}</small></span>
              </div>
              <div className="v2-choice-block"><span>Tốc độ</span><div className="v2-segmented">{SPEEDS.map((speed) => <button key={speed.id} type="button" className={Math.abs(rate - speed.rate) < .01 ? 'active' : ''} onClick={() => changeRate(speed.rate)}>{speed.label}</button>)}</div></div>
              <div className="v2-memory-actions"><button type="button" onClick={props.onTestVoice}>Nghe thử giọng</button></div>
              <p className="v2-disclosure">Mira dùng ElevenLabs qua gateway server-side; khi gateway lỗi Mira báo trạng thái và không tự chuyển sang provider khác.</p>
            </div>
            <div className="v2-setting-group v2-device-check">
              <div className="v2-device-check-head">
                <div><h3>Thiết bị & kết nối</h3><p>Preflight read-only · không bật camera/mic, không xin quyền.</p></div>
                <div className="v2-device-check-actions">
                  <button type="button" disabled={deviceDiagnosticsBusy} onClick={() => void runDeviceCheck()}>{deviceDiagnosticsBusy ? 'Đang kiểm tra…' : 'Kiểm tra thiết bị'}</button>
                  <button type="button" disabled={!deviceDiagnostics} onClick={exportDeviceReport}>Xuất báo cáo</button>
                </div>
              </div>
              {deviceDiagnostics ? <>
                <div className="v2-device-grid">
                  <DeviceCheckItem label="Kết nối an toàn" value={deviceDiagnostics.secureContext ? 'HTTPS / Local' : 'Cần HTTPS'} status={deviceDiagnostics.secureContext ? 'ok' : 'warn'} />
                  <DeviceCheckItem label="Camera" value={deviceDiagnostics.mediaDevices ? permissionLabel(deviceDiagnostics.cameraPermission) : 'API không có'} status={deviceDiagnostics.mediaDevices && deviceDiagnostics.cameraPermission !== 'denied' ? 'ok' : 'warn'} />
                  <DeviceCheckItem label="Microphone" value={deviceDiagnostics.mediaDevices ? permissionLabel(deviceDiagnostics.microphonePermission) : 'API không có'} status={deviceDiagnostics.mediaDevices && deviceDiagnostics.microphonePermission !== 'denied' ? 'ok' : 'warn'} />
                  <DeviceCheckItem label="WebXR AR" value={!deviceDiagnostics.webxr ? 'Không hỗ trợ' : deviceDiagnostics.immersiveAr === true ? 'Sẵn sàng' : deviceDiagnostics.immersiveAr === false ? 'Không có AR' : 'Không xác định'} status={deviceDiagnostics.immersiveAr === true ? 'ok' : 'neutral'} />
                  <DeviceCheckItem label="AI tăng tốc" value={deviceDiagnostics.webnn ? 'WebNN' : deviceDiagnostics.webgpu ? 'WebGPU' : 'CPU / WASM'} status={deviceDiagnostics.webnn || deviceDiagnostics.webgpu ? 'ok' : 'neutral'} />
                  <DeviceCheckItem label="Video frame" value={deviceDiagnostics.requestVideoFrameCallback ? 'Tối ưu' : 'Fallback'} status={deviceDiagnostics.requestVideoFrameCallback ? 'ok' : 'neutral'} />
                  <DeviceCheckItem label="Voice gateway" value={voiceStatus} status={voiceDiagnostics?.health === 'healthy' ? 'ok' : voiceDiagnostics?.health === 'unhealthy' ? 'warn' : 'neutral'} />
                  {connectivity && <DeviceCheckItem label="Brain model" value={connectivity.model === 'ready' ? 'Đã cấu hình' : connectivity.model === 'unconfigured' ? 'Thiếu API key' : 'Không kết nối'} status={connectivity.model === 'ready' ? 'ok' : 'warn'} />}
                  {connectivity && desktopRuntime && <DeviceCheckItem label="SQLite Desktop" value={connectivity.memory === 'ready' ? `Hoạt động · ${connectivity.memoryTurnCount ?? 0} lượt` : 'Không đọc được'} status={connectivity.memory === 'ready' ? 'ok' : 'warn'} />}
                  <DeviceCheckItem label="Chế độ đề xuất" value={deviceDiagnostics.productMode === 'full' ? 'Full' : deviceDiagnostics.productMode === 'balanced' ? 'Balanced' : 'Compatibility'} status={deviceDiagnostics.productMode === 'full' ? 'ok' : 'neutral'} />
                </div>
                {connectivity && <p className="v2-disclosure" role="status">{connectivity.modelDetail}{desktopRuntime ? ' · ' + connectivity.memoryDetail : ''}</p>}
                <p className="v2-device-meta">{deviceDiagnostics.hardwareConcurrency ? `${deviceDiagnostics.hardwareConcurrency} CPU threads` : 'CPU threads: không rõ'} · {deviceDiagnostics.deviceMemoryGb ? `${deviceDiagnostics.deviceMemoryGb} GB RAM báo bởi trình duyệt` : 'RAM: trình duyệt không báo'} · {deviceDiagnostics.crossOriginIsolated ? 'cross-origin isolated' : 'standard isolation'}</p>
              </> : <p className="v2-disclosure">Bấm “Kiểm tra thiết bị” để xem khả năng hiện tại. Mira chỉ đọc capability và permission state nếu trình duyệt cho phép.</p>}
              {deviceDiagnostics && <p className="v2-disclosure">Báo cáo JSON không chứa camera frame, mic audio, user-agent, device ID hay vị trí.</p>}
            </div>
            <div className="v2-setting-group"><h3>Độ dài câu trả lời</h3><div className="v2-choice-block"><span>Mức chi tiết</span><div className="v2-segmented">{RESPONSE_LENGTHS.map((item) => <button key={item.id} type="button" className={responseLength === item.id ? 'active' : ''} onClick={() => changeResponseLength(item.id)}>{item.label}</button>)}</div><p className="v2-disclosure">{selectedResponseLength.description}</p></div></div>
            <div className="v2-setting-group"><h3>Tính cách</h3><div className="v2-personas">{PERSONAS.map((item) => <button key={item.id} type="button" className={persona === item.id ? 'active' : ''} onClick={() => changePersona(item.id)}><span>{item.icon}</span><b>{item.label}</b></button>)}</div></div>
            <div className="v2-setting-group"><h3>Hội thoại tự nhiên</h3><Toggle checked={smartTurn} onChange={changeSmart} label="Smart turn-taking" hint="Chờ đúng lúc anh nói xong thay vì cắt theo khoảng lặng cứng." /><Toggle checked={vad} onChange={changeVad} label="Ngắt lời bằng giọng" hint="Cho phép nói chen khi Mira đang trả lời." /></div>
          </>}
          {tab === 'appearance' && <div className="v2-setting-group"><h3>Màu quả cầu</h3><div className="v2-theme-grid">{THEMES.map((item) => <button key={item} type="button" data-theme-preview={item} className={props.theme === item ? 'active' : ''} onClick={() => props.onTheme(item)}><i /><span>{item}</span></button>)}</div></div>}
          {tab === 'memory' && <>
            <div className="v2-setting-group"><h3>Ký ức</h3><Toggle checked={memoryOn} onChange={changeMemory} label="Cho phép Mira ghi nhớ" hint="Tắt để ngừng lưu lượt mới, truy hồi ký ức và chắt lọc hồ sơ." /><div className="v2-memory-meta"><span>{loadingProfile ? 'Đang đọc kho ký ức…' : profile ? `${profile.messageCount} lượt hội thoại đã lưu` : 'Chưa đọc được bộ nhớ'}</span><button type="button" onClick={() => void refreshProfile()}>Làm mới</button></div>{profileError && <p className="v2-profile-error">{profileError}</p>}<div className="v2-memory-list">{profile?.facts.map((fact) => <FactRow key={fact.id} fact={fact} onChanged={() => void refreshProfile()} />)}{!loadingProfile && profile && !profile.facts.length && <p className="v2-empty">Mira chưa ghi nhớ thông tin bền vững nào về anh.</p>}</div><div className="v2-memory-actions"><button type="button" className="primary" disabled={capsuleBusy} onClick={() => void exportCapsule()}>{capsuleBusy ? 'Đang xử lý…' : 'Xuất Identity Capsule'}</button><button type="button" disabled={capsuleBusy} onClick={() => capsuleInputRef.current?.click()}>Nhập Capsule</button><button type="button" onClick={() => void exportMemory()}>Xuất dữ liệu thô</button><button type="button" className="danger" onClick={() => void eraseAll()}>Xoá toàn bộ ký ức</button><input ref={capsuleInputRef} type="file" accept="application/json,.json" hidden onChange={(event) => void importCapsule(event.target.files?.[0])} /></div><p className="v2-disclosure">Identity Capsule đóng gói ký ức, lịch sử và tuỳ chọn Mira thành JSON có version + SHA-256 để mang sang thiết bị hoặc model khác. Nhập Capsule chỉ gộp dữ liệu, không xoá dữ liệu đang có.</p></div>
            {desktopRuntime && <div className="v2-setting-group v2-desktop-local"><h3>Mira Desktop Local</h3><div className="v2-desktop-local-status"><span><b>{desktopPrivacy?.info?.platform === 'macos' ? 'macOS' : desktopPrivacy?.info?.platform === 'windows' ? 'Windows' : 'Desktop'}</b><small>{desktopPrivacy?.info?.localFrontend ? 'Frontend chạy cục bộ · không dùng Vercel làm giao diện' : 'Đang kiểm tra runtime local'}</small></span><i data-ready={desktopPrivacy?.info?.localFrontend ? 'true' : 'false'} /></div><Toggle checked={desktopPrivacy?.permissions['media.control'] ?? true} onChange={(next) => void changeDesktopPermission('media.control', next)} label="Cho phép điều khiển nhạc" hint="Chỉ chạy khi anh ra lệnh rõ ràng như bật, dừng, chuyển hoặc mở một bài cụ thể." /><Toggle checked={desktopPrivacy?.permissions['media.library'] ?? false} onChange={(next) => void changeDesktopPermission('media.library', next)} label="Cho phép thư viện nhạc local" hint="Mira chỉ index file âm thanh trong đúng thư mục anh đã chọn; không tự quét ổ đĩa." /><div className="v2-music-library"><div><b>{desktopPrivacy?.musicLibrary?.trackCount ? desktopPrivacy.musicLibrary.trackCount.toLocaleString('vi-VN') + ' bài đã index' : 'Chưa có thư viện nhạc local'}</b><small>{desktopPrivacy?.musicLibrary?.trackCount ? `${(desktopPrivacy.musicLibrary.taggedTrackCount || 0).toLocaleString('vi-VN')} bài có metadata · ${desktopPrivacy.musicLibrary.root || ''}` : desktopPrivacy?.musicLibrary?.root || 'Chọn một thư mục Music để Mira có thể tìm bài theo tên và lịch sử nghe.'}</small></div><div><button type="button" disabled={desktopLibraryBusy} onClick={() => void chooseMusicFolder()}>{desktopPrivacy?.musicLibrary?.root ? 'Đổi thư mục' : 'Chọn thư mục'}</button><button type="button" disabled={desktopLibraryBusy || !desktopPrivacy?.musicLibrary?.root || !desktopPrivacy?.permissions['media.library']} onClick={() => void rescanMusic()}>Quét lại</button></div></div><Toggle checked={desktopPrivacy?.permissions['memory.affect'] ?? true} onChange={(next) => void changeDesktopPermission('memory.affect', next)} label="Lưu tín hiệu cảm xúc cục bộ" hint="Lưu mood/confidence theo thời gian vào mira.db để giữ mạch cảm xúc; không coi đây là chẩn đoán." />{(desktopPrivacyBusy || desktopLibraryBusy) && <p className="v2-disclosure">Đang cập nhật dữ liệu local…</p>}{desktopPrivacy?.info?.memoryDb && <p className="v2-local-path">Memory DB <code>{desktopPrivacy.info.memoryDb}</code></p>}<p className="v2-disclosure">Quyền được kiểm tra lại ở native Rust layer trước khi thực thi. Tắt quyền ở đây sẽ chặn hành động ngay cả khi UI gửi lệnh.</p></div>}
            {desktopRuntime && <div className="v2-setting-group"><Suspense fallback={<p className="v2-empty">Đang mở memory graph…</p>}><StructuredMemoryInspector /></Suspense></div>}
            <div className="v2-setting-group v2-privacy-note"><h3>Riêng tư mặc định</h3><p>Mic chỉ hoạt động khi anh bật nghe hoặc trò chuyện rảnh tay. Giao diện chính không tải avatar 3D, camera hay hand gesture.</p></div>
            <div className="v2-setting-group v2-labs-entry"><div><h3>Developer Labs</h3><p>Avatar, camera, hand gesture, Splat, simulator, BYOK và chẩn đoán kỹ thuật.</p></div><button type="button" onClick={props.onOpenLabs}>Mở Labs →</button></div>
          </>}
        </div>
      </section>
    </div>
  );
}
