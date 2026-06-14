import { useEffect, useRef, useState } from 'react';
import { useMira } from './core/useMira';
import { audioLevel } from './core/audio-level';
import { startFaceTracking, stopFaceTracking } from './core/face/face-tracker';
import { startGestureTracking, stopGestureTracking, handData } from './core/face/gesture-tracker';
import { loadAvatarSel, saveAvatarSel, resolveAvatarUrl, has3D, lookImage, sceneBg, type AvatarSel } from './core/avatar-config';
import type { MiraState, Theme } from './core/types';
import MiraStage from './ui/MiraStage';
import VoiceDock from './ui/VoiceDock';
import DevConsole from './ui/DevConsole';
import ContentPanel from './ui/ContentPanel';
import { IconCamera, IconCameraOff, IconSettings, IconHand } from './ui/icons';

const N_BARS = 52;

export default function App() {
  const mira = useMira();
  const { stateRef } = mira;

  const [theme, setTheme] = useState<Theme>('nova');
  const [faceOn, setFaceOn] = useState(false);
  const [handOn, setHandOn] = useState(false); // điều khiển bằng bàn tay (gesture)
  const [avatarSel, setAvatarSel] = useState<AvatarSel>(loadAvatarSel);
  const [avatarOpacity, setAvatarOpacity] = useState(1);
  // Ưu tiên ảnh 2D (PNG trong suốt) thay vì model 3D — bật/tắt bằng nút trên header, nhớ qua localStorage.
  const [avatar2d, setAvatar2d] = useState(() => {
    try { return localStorage.getItem('mira.avatar2d') === '1'; } catch { return false; }
  });
  const toggle2d = () => setAvatar2d((v) => {
    const n = !v;
    try { localStorage.setItem('mira.avatar2d', n ? '1' : '0'); } catch { /* noop */ }
    return n;
  });
  // Hiện 3D khi: không ưu tiên 2D & bộ có model 3D. Còn lại → avatarUrl=null để sân khấu hiện ảnh PNG (lookSrc).
  const avatarUrl = !avatar2d && has3D(avatarSel) ? resolveAvatarUrl(avatarSel) : null;
  const lookSrc = lookImage(avatarSel);
  const onAvatarChange = (s: AvatarSel) => {
    setAvatarSel(s);
    saveAvatarSel(s);
  };
  // Nền cảnh đổi theo bối cảnh nếu có file public/scenes/<scene>.jpg (không có → giữ gradient).
  const sceneBgRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = sceneBgRef.current;
    if (!el) return;
    const url = sceneBg(avatarSel.scene);
    const img = new Image();
    img.onload = () => {
      el.style.backgroundImage = `url("${url}")`;
      el.style.opacity = '1';
    };
    img.onerror = () => {
      el.style.backgroundImage = '';
      el.style.opacity = '0';
    };
    img.src = url;
  }, [avatarSel.scene]);
  const [simulating, setSimulating] = useState(false);

  // Webcam: 2 chế độ LOẠI TRỪ nhau — gương mặt (face) HOẶC điều khiển tay (gesture). Tắt hết khi rời trang.
  useEffect(() => () => { stopFaceTracking(); stopGestureTracking(); }, []);
  const toggleFace = async () => {
    if (faceOn) {
      stopFaceTracking();
      setFaceOn(false);
      return;
    }
    if (handOn) { stopGestureTracking(); setHandOn(false); } // nhường camera cho chế độ gương
    const ok = await startFaceTracking();
    setFaceOn(ok); // thất bại (từ chối camera/không HTTPS) → giữ tắt; lý do đã log ở tracker
  };
  const toggleHand = async () => {
    if (handOn) {
      stopGestureTracking();
      setHandOn(false);
      return;
    }
    if (faceOn) { stopFaceTracking(); setFaceOn(false); } // nhường camera cho chế độ tay
    const ok = await startGestureTracking();
    setHandOn(ok);
  };
  const simTimers = useRef<number[]>([]);
  const [showConsole, setShowConsole] = useState(false);
  const consoleOpenRef = useRef(false);
  useEffect(() => {
    consoleOpenRef.current = showConsole;
  }, [showConsole]);

  const waveRef = useRef<HTMLDivElement>(null);
  const footglowRef = useRef<HTMLDivElement>(null);
  const micRef = useRef<HTMLButtonElement>(null);
  const handCursorRef = useRef<HTMLDivElement>(null);

  // Điều khiển bằng tay: vòng lặp đọc handData → con trỏ tay + cử chỉ (✋ giữ = mic, 👋 chào, 👍 cảm ơn).
  useEffect(() => {
    if (!handOn) return;
    let raf = 0;
    let prev = performance.now();
    const hold = { t: 0, fired: false };
    let lastWave = 0;
    let lastThumb = 0;
    let lastG = 'None';
    const loop = () => {
      const now = performance.now();
      const dt = Math.min(0.05, (now - prev) / 1000);
      prev = now;
      const h = handData;
      const cur = handCursorRef.current;
      if (cur) {
        cur.style.opacity = h.present ? '1' : '0';
        if (h.present) {
          cur.style.left = (100 * (1 - h.x)).toFixed(1) + '%'; // soi gương (camera selfie)
          cur.style.top = (100 * h.y).toFixed(1) + '%';
        }
      }
      // ✋ Xoè tay đứng yên ~0.8s → bật/tắt mic (rảnh tay)
      if (h.present && h.gesture === 'Open_Palm' && !h.wave) {
        hold.t += dt;
        if (hold.t >= 0.8 && !hold.fired) {
          hold.fired = true;
          mira.toggleMic();
          cur?.classList.add('act');
        }
      } else {
        hold.t = 0;
        hold.fired = false;
        cur?.classList.remove('act');
      }
      // 👋 Vẫy tay → Mira chào lại
      if (h.wave && now - lastWave > 4500) {
        lastWave = now;
        mira.say('Dạ em chào anh!');
      }
      // 👍 Thumb up (vừa giơ) → Mira cảm ơn
      if (h.gesture === 'Thumb_Up' && lastG !== 'Thumb_Up' && now - lastThumb > 3500) {
        lastThumb = now;
        mira.say('Dạ, cảm ơn anh nhiều ạ!');
      }
      lastG = h.gesture;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handOn]);

  // body[data-state] + body[data-theme] điều khiển toàn bộ CSS theo trạng thái/màu (như mockup).
  useEffect(() => {
    document.body.dataset.state = mira.state;
  }, [mira.state]);
  useEffect(() => {
    document.body.dataset.theme = theme;
  }, [theme]);

  // ── Vòng lặp animation (port frame() từ mira.html) ──
  useEffect(() => {
    const wave = waveRef.current;
    if (!wave) return;
    const bars: HTMLElement[] = [];
    for (let i = 0; i < N_BARS; i++) {
      const b = document.createElement('i');
      wave.appendChild(b);
      bars.push(b);
    }

    let t = 0;
    let raf = 0;
    const loop = () => {
      t += 0.06;
      const state = stateRef.current;
      // Biên độ ÂM THẬT khi Mira đang nói (Edge/VieNeu/ElevenLabs gắn AnalyserNode) → reactive
      // kiểu Grok thay vì sóng sin giả. -1 = không có nguồn thật (giọng hệ thống) → dùng envelope.
      const live = audioLevel.active ? audioLevel.value : -1;
      const speakGain = live >= 0 ? 0.4 + live * 1.7 : 1;
      for (let i = 0; i < N_BARS; i++) {
        let h = 6;
        const center = Math.abs(i - N_BARS / 2) / (N_BARS / 2);
        if (state === 'listening') h = 8 + Math.abs(Math.sin(t * 2 + i * 0.5)) * 26 * (1 - center * 0.6) * (0.6 + Math.random() * 0.5);
        else if (state === 'speaking') h = (8 + Math.abs(Math.sin(t * 3 + i * 0.9) + Math.sin(t * 1.7 + i * 0.3)) * 16 * (1 - center * 0.5)) * speakGain;
        else if (state === 'thinking') h = 8 + Math.max(0, Math.sin(t * 4 - i * 0.6)) * 18;
        else if (state === 'interrupted' || state === 'error') h = 6;
        else h = 6 + Math.sin(t * 0.8 + i * 0.4) * 3;
        bars[i].style.height = Math.max(4, h) + 'px';
        bars[i].style.background = state === 'interrupted' || state === 'error' ? 'var(--warn)' : 'var(--accent)';
      }

      let amp = 0.12;
      if (state === 'listening') amp = 0.45 + Math.abs(Math.sin(t * 2)) * 0.45 * (0.6 + Math.random() * 0.4);
      else if (state === 'speaking') amp = 0.5 + Math.abs(Math.sin(t * 3) + Math.sin(t * 1.7)) * 0.3;
      else if (state === 'thinking') amp = 0.3 + Math.abs(Math.sin(t * 1.4)) * 0.2;
      else if (state === 'interrupted' || state === 'error') amp = 0.04;
      else amp = 0.12 + Math.sin(t * 0.8) * 0.05;
      // Override bằng biên độ thật khi đang nói → orb mic + footglow nảy đúng theo giọng Mira.
      if (live >= 0 && state === 'speaking') amp = 0.18 + live * 0.9;

      const mic = micRef.current;
      const active = state === 'listening' || state === 'speaking' || state === 'thinking';
      if (mic) {
        if (active) {
          mic.style.transform = 'scale(' + (1 + amp * 0.14).toFixed(3) + ')';
          mic.style.boxShadow =
            '0 0 0 ' + (6 + amp * 11).toFixed(0) + 'px color-mix(in srgb,var(--accent) 12%,transparent),0 0 ' +
            (24 + amp * 34).toFixed(0) + 'px color-mix(in srgb,var(--accent) 60%,transparent),' +
            'inset 0 2px 8px color-mix(in srgb,white 40%,transparent),' +
            'inset 0 -7px 16px color-mix(in srgb,var(--accent2) 55%,transparent)';
        } else {
          mic.style.transform = '';
          mic.style.boxShadow = '';
        }
      }

      const fg = footglowRef.current;
      if (fg) {
        fg.style.opacity = (0.45 + amp * 0.55).toFixed(2);
        fg.style.transform = 'translateX(-50%) scale(' + (0.9 + amp * 0.35).toFixed(3) + ')';
        fg.style.background =
          state === 'interrupted' || state === 'error'
            ? 'radial-gradient(ellipse at center, color-mix(in srgb,var(--warn) 75%,transparent), transparent 66%)'
            : 'radial-gradient(ellipse at center, color-mix(in srgb,var(--accent) 75%,transparent), transparent 66%)';
      }

      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      bars.forEach((b) => b.remove());
    };
  }, [stateRef]);

  // ── Mồi engine TTS ngay lần tương tác đầu tiên (fix câm tiếng Chrome/Safari) ──
  useEffect(() => {
    const unlock = () => mira.unlockAudio();
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Phím Space: nói nhanh / ngắt lời ──
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || e.repeat) return;
      if (consoleOpenRef.current) return; // đang mở Developer Console → không cướp phím Space
      const el = e.target as HTMLElement;
      if (el && /^(BUTTON|SELECT|INPUT|TEXTAREA)$/.test(el.tagName)) return;
      e.preventDefault();
      stopSim();
      mira.toggleMic();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Mô phỏng hội thoại (port từ mockup) ──
  const stopSim = () => {
    simTimers.current.forEach((id) => clearTimeout(id));
    simTimers.current = [];
    setSimulating(false);
  };
  const step = (fn: () => void, ms: number) => {
    simTimers.current.push(window.setTimeout(fn, ms));
  };
  const toggleSim = () => {
    if (simulating) {
      stopSim();
      mira.demoGo('idle');
      return;
    }
    setSimulating(true);
    const run = () => {
      mira.demoGo('idle');
      step(() => mira.demoGo('listening'), 1100);
      step(() => mira.demoGo('thinking'), 3600);
      step(() => mira.demoGo('speaking'), 4700);
      step(() => mira.demoGo('interrupted'), 8200);
      step(() => mira.demoGo('listening'), 9100);
      step(() => mira.demoGo('thinking'), 11200);
      step(() => mira.demoGo('speaking'), 12100);
      step(() => run(), 17500);
    };
    run();
  };

  const handleGoState = (s: MiraState, speakIt?: boolean) => {
    stopSim();
    mira.demoGo(s, speakIt);
  };
  const handleMic = () => {
    stopSim();
    mira.toggleMic();
  };
  const handleToggleLive = () => {
    stopSim();
    mira.toggleLive();
  };

  const voiceLabel = mira.voices.find((v) => v.voiceURI === mira.voiceURI)?.name || 'Web Speech · VN';

  return (
    <div className={`stage${mira.content ? ' has-content' : ''}`}>
      <div className="scene-bg" ref={sceneBgRef} aria-hidden="true" />
      <header className="top">
        <div className="brand">
          <div className="logo" aria-hidden="true" />
          <div className="wordmark">
            <b>Mira</b>
            <span>Trợ lý giọng nói 3D</span>
          </div>
          <span className="pill">
            <span className="dot" />
            LIVE
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
          <div className="tele">
            <div>
              <span className="k">LATENCY</span>
              <span className="v acc">{mira.latencyMs != null ? `${mira.latencyMs}ms` : '—'}</span>
            </div>
            <div>
              <span className="k">VOICE</span>
              <span className="v">{voiceLabel}</span>
            </div>
            <div>
              <span className="k">BRAIN</span>
              <span className="v">{mira.brainName}</span>
            </div>
          </div>
          <button
            className="console"
            onClick={toggleFace}
            aria-pressed={faceOn}
            title="Avatar nhìn & biểu cảm theo bạn qua webcam (không deepfake)"
          >
            {faceOn ? <IconCameraOff /> : <IconCamera />}
            <span className="lbl">{faceOn ? 'Tắt camera' : 'Camera'}</span>
          </button>
          <button
            className="console"
            onClick={toggleHand}
            aria-pressed={handOn}
            title="Điều khiển bằng bàn tay qua webcam: ✋ giữ = mic, 👋 vẫy = chào, 👍 = thích"
          >
            <IconHand />
            <span className="lbl">{handOn ? 'Tắt tay' : 'Tay'}</span>
          </button>
          <button
            className="seg2"
            onClick={toggle2d}
            role="switch"
            aria-checked={avatar2d}
            title="Gạt giữa ảnh 2D và model 3D"
          >
            <span className={avatar2d ? 'on' : ''}>2D</span>
            <span className={!avatar2d ? 'on' : ''}>3D</span>
          </button>
          <button className="console" onClick={() => setShowConsole(true)} title="Cài đặt" aria-label="Cài đặt">
            <IconSettings />
            <span className="lbl">Cài đặt</span>
          </button>
        </div>
      </header>

      {mira.error && <div className="errbar" role="alert">{mira.error}</div>}

      {handOn && <div className="hand-cursor" ref={handCursorRef} aria-hidden="true" />}

      <MiraStage
        footglowRef={footglowRef}
        stateRef={mira.stateRef}
        moodRef={mira.moodRef}
        theme={theme}
        avatarUrl={avatarUrl}
        lookSrc={lookSrc}
        avatarOpacity={avatarOpacity}
      />

      {mira.content && <ContentPanel content={mira.content} onClose={mira.clearContent} />}

      <VoiceDock
        who={mira.who}
        caption={mira.caption}
        partial={mira.partial}
        waveRef={waveRef}
        micRef={micRef}
        live={mira.live}
        onToggleLive={handleToggleLive}
      />

      <DevConsole
        open={showConsole}
        onClose={() => setShowConsole(false)}
        brainName={mira.brainName}
        onSaveLLM={mira.applyLLMConfig}
        onSaveTTS={mira.applyTTSConfig}
        onTestBrain={mira.testBrain}
        onTestVoice={mira.testVoice}
        getDiagnostics={mira.ttsDiagnostics}
        theme={theme}
        onTheme={setTheme}
        avatarSel={avatarSel}
        onAvatarChange={onAvatarChange}
        avatarOpacity={avatarOpacity}
        onAvatarOpacity={setAvatarOpacity}
        voices={mira.voices}
        voiceURI={mira.voiceURI}
        onSelectVoice={mira.selectVoice}
        state={mira.state}
        onGoState={handleGoState}
        onSimulate={toggleSim}
        simulating={simulating}
      />
    </div>
  );
}
