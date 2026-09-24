import { useCallback, useEffect, useRef, useState } from 'react';
import { useMira } from '../core/useMira';
import type { MiraState, Theme } from '../core/types';
import ContentPanel from '../ui/ContentPanel';
import { IconCamera, IconCameraOff, IconSettings } from '../ui/icons';
import { useDialogFocus } from '../ui/useDialogFocus';
import SettingsPanel from '../settings/SettingsPanel';
import PhotorealMira from '../presence/PhotorealMira';
import HandSkeletonOverlay, { type HandLandmarkPoint } from '../presence/HandSkeletonOverlay';
import AirControlOverlay from '../presence/AirControlOverlay';
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
const VOICE_HANDSHAKE_TEXT = 'Em nghe anh. Chế độ trò chuyện liên tục đã bật.';
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
  const cameraPreviewRef = useRef<HTMLVideoElement>(null);
  const visionModulesRef = useRef<typeof import('../presence/vision-runtime') | null>(null);
  const [visionOn, setVisionOn] = useState(false);
  const [visionBooting, setVisionBooting] = useState(false);
  const [visionError, setVisionError] = useState('');
  const [faceSeen, setFaceSeen] = useState(false);
  const [handSeen, setHandSeen] = useState(false);
  const [gestureName, setGestureName] = useState('None');
  const [gestureScore, setGestureScore] = useState(0);
  const [handPoint, setHandPoint] = useState({ x: 0.5, y: 0.5 });
  const [waveSeen, setWaveSeen] = useState(false);
  const [handLandmarks, setHandLandmarks] = useState<HandLandmarkPoint[]>([]);
  const [airPoint, setAirPoint] = useState({ x: 0.5, y: 0.5 });
  const [pinching, setPinching] = useState(false);
  const [airTargetLabel, setAirTargetLabel] = useState('');
  const [airFeedback, setAirFeedback] = useState('');
  const pinchWasDownRef = useRef(false);
  const palmHoldSinceRef = useRef(0);
  const victoryLatchRef = useRef(false);
  const lastAirActionRef = useRef(0);

  useDialogFocus(settingsOpen, '.v2-settings');

  useEffect(() => {
    document.body.dataset.state = mira.state;
    document.body.dataset.theme = theme;
  }, [mira.state, theme]);

  useEffect(() => {
    try { localStorage.setItem('mira.theme', theme); } catch { /* noop */ }
  }, [theme]);

  const loadVisionModules = useCallback(async () => {
    if (visionModulesRef.current) return visionModulesRef.current;
    const runtime = await import('../presence/vision-runtime');
    visionModulesRef.current = runtime;
    return runtime;
  }, []);

  const stopVision = useCallback(async () => {
    const modules = visionModulesRef.current;
    modules?.stopVision();
    if (cameraPreviewRef.current) cameraPreviewRef.current.srcObject = null;
    setVisionOn(false);
    setFaceSeen(false);
    setHandSeen(false);
    setGestureName('None');
    setGestureScore(0);
    setWaveSeen(false);
    setHandLandmarks([]);
    setPinching(false);
    setAirTargetLabel('');
    setAirFeedback('');
    pinchWasDownRef.current = false;
    palmHoldSinceRef.current = 0;
    victoryLatchRef.current = false;
  }, []);

  const toggleVision = useCallback(async () => {
    if (visionBooting) return;
    if (visionOn) {
      await stopVision();
      return;
    }

    setVisionBooting(true);
    setVisionError('');
    try {
      const modules = await loadVisionModules();
      const result = await modules.startVision();
      const on = result.ok;
      setVisionOn(on);

      const stream = modules.visionStream();
      if (on && stream && cameraPreviewRef.current) {
        cameraPreviewRef.current.srcObject = stream;
        cameraPreviewRef.current.muted = true;
        cameraPreviewRef.current.playsInline = true;
        await cameraPreviewRef.current.play().catch(() => {});
      }

      if (!on) {
        setVisionError(result.error || 'Không mở được camera. Hãy kiểm tra quyền Camera của trình duyệt.');
      }
    } catch (error) {
      setVisionError(error instanceof Error ? error.message : 'Không mở được camera.');
      await stopVision();
    } finally {
      setVisionBooting(false);
    }
  }, [loadVisionModules, stopVision, visionBooting, visionOn]);

  useEffect(() => {
    if (!visionOn) return;
    const modules = visionModulesRef.current;
    const preview = cameraPreviewRef.current;
    const stream = modules?.visionStream() || null;
    if (preview && stream) {
      preview.srcObject = stream;
      preview.muted = true;
      preview.playsInline = true;
      void preview.play().catch(() => {});
    }

    const timer = window.setInterval(() => {
      const current = visionModulesRef.current;
      const snapshot = current?.visionSnapshot();
      setFaceSeen(Boolean(snapshot?.faceSeen));
      setHandSeen(Boolean(snapshot?.handSeen));
      setGestureName(snapshot?.gesture || 'None');
      setGestureScore(Number(snapshot?.gestureScore || 0));
      setWaveSeen(Boolean(snapshot?.wave));
      setHandLandmarks(Array.isArray(snapshot?.landmarks) ? snapshot.landmarks : []);
      setPinching(Boolean(snapshot?.pinching));
      if (snapshot?.handSeen) {
        setAirPoint({
          x: Math.max(0.03, Math.min(0.97, Number(snapshot.pointerX ?? 0.5))),
          y: Math.max(0.04, Math.min(0.96, Number(snapshot.pointerY ?? 0.5))),
        });
        setHandPoint({
          x: Math.max(0, Math.min(1, Number(snapshot.handX ?? 0.5))),
          y: Math.max(0, Math.min(1, Number(snapshot.handY ?? 0.5))),
        });
      }
    }, 120);
    return () => window.clearInterval(timer);
  }, [visionOn]);

  useEffect(() => () => {
    const modules = visionModulesRef.current;
    modules?.stopVision();
  }, []);

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
    window.setTimeout(() => mira.startLive(), 80);
  }, [clearBootTimer, mira.startLive]);

  useEffect(() => {
    if (!voiceBooting || !bootPendingRef.current) return;
    if (mira.state === 'speaking') bootSawSpeakingRef.current = true;
    if (mira.state === 'idle' && bootSawSpeakingRef.current) finishVoiceHandshake();
  }, [finishVoiceHandshake, mira.state, voiceBooting]);

  useEffect(() => () => clearBootTimer(), [clearBootTimer]);

  const activateVoice = useCallback(() => {
    mira.unlockAudio();

    if (voiceReady) {
      if (!mira.live) {
        mira.startLive();
      } else if (mira.stateRef.current === 'speaking' || mira.stateRef.current === 'thinking') {
        mira.interrupt();
      } else if (mira.stateRef.current === 'idle' || mira.stateRef.current === 'interrupted') {
        mira.startListening();
      }
      return;
    }

    if (bootPendingRef.current) {
      bootPendingRef.current = false;
      bootSawSpeakingRef.current = false;
      clearBootTimer();
      setVoiceBooting(false);
      setVoiceReady(true);
      if (mira.stateRef.current === 'speaking' || mira.stateRef.current === 'thinking') mira.interrupt();
      else mira.startLive();
      return;
    }

    if (mira.stateRef.current !== 'idle') {
      setVoiceReady(true);
      mira.startLive();
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
      else mira.startLive();
    }, VOICE_HANDSHAKE_TIMEOUT);
  }, [clearBootTimer, mira.interrupt, mira.live, mira.say, mira.startListening, mira.startLive, mira.stateRef, mira.unlockAudio, voiceReady]);

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

  const resolveAirTarget = useCallback((x: number, y: number): HTMLElement | null => {
    const candidates = Array.from(document.querySelectorAll<HTMLElement>('[data-air-action="safe"]'))
      .filter((element) => !element.hasAttribute('disabled') && element.offsetParent !== null);
    let winner: HTMLElement | null = null;
    let bestDistance = 78;

    for (const element of candidates) {
      const rect = element.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const distance = Math.hypot(cx - x, cy - y);
      if (distance < bestDistance) {
        bestDistance = distance;
        winner = element;
      }
    }
    return winner;
  }, []);

  useEffect(() => {
    if (!visionOn || !handSeen) {
      setAirTargetLabel('');
      pinchWasDownRef.current = false;
      palmHoldSinceRef.current = 0;
      victoryLatchRef.current = false;
      return;
    }

    const x = airPoint.x * window.innerWidth;
    const y = airPoint.y * window.innerHeight;
    const target = resolveAirTarget(x, y);
    setAirTargetLabel(target?.dataset.airLabel || '');

    const now = Date.now();
    const freshAction = now - lastAirActionRef.current > 900;

    if (pinching && !pinchWasDownRef.current && target && freshAction) {
      target.click();
      lastAirActionRef.current = now;
      setAirFeedback(`Pinch · ${target.dataset.airLabel || 'Đã chọn'}`);
      window.setTimeout(() => setAirFeedback(''), 900);
    }
    pinchWasDownRef.current = pinching;

    if (gestureName === 'Open_Palm' && gestureScore >= 0.58) {
      if (!palmHoldSinceRef.current) palmHoldSinceRef.current = now;
      const held = now - palmHoldSinceRef.current;
      if (held >= 720 && freshAction && (mira.stateRef.current === 'speaking' || mira.stateRef.current === 'thinking')) {
        mira.interrupt();
        lastAirActionRef.current = now;
        palmHoldSinceRef.current = 0;
        setAirFeedback('✋ Mira đã dừng');
        window.setTimeout(() => setAirFeedback(''), 900);
      }
    } else {
      palmHoldSinceRef.current = 0;
    }

    if (gestureName === 'Victory' && gestureScore >= 0.62) {
      if (!victoryLatchRef.current && freshAction) {
        victoryLatchRef.current = true;
        mira.unlockAudio();
        setVoiceReady(true);
        mira.toggleLive();
        lastAirActionRef.current = now;
        setAirFeedback(mira.live ? '✌ Live voice · tắt' : '✌ Live voice · bật');
        window.setTimeout(() => setAirFeedback(''), 900);
      }
    } else {
      victoryLatchRef.current = false;
    }
  }, [airPoint, gestureName, gestureScore, handSeen, mira.interrupt, mira.live, mira.stateRef, mira.toggleLive, mira.unlockAudio, pinching, resolveAirTarget, visionOn]);

  useEffect(() => {
    const resumeIfNeeded = () => {
      if (document.visibilityState !== 'visible' || !mira.live) return;
      if (mira.stateRef.current === 'idle' || mira.stateRef.current === 'interrupted') {
        window.setTimeout(() => {
          if (mira.live && (mira.stateRef.current === 'idle' || mira.stateRef.current === 'interrupted')) {
            mira.startListening();
          }
        }, 180);
      }
    };
    document.addEventListener('visibilitychange', resumeIfNeeded);
    window.addEventListener('focus', resumeIfNeeded);
    return () => {
      document.removeEventListener('visibilitychange', resumeIfNeeded);
      window.removeEventListener('focus', resumeIfNeeded);
    };
  }, [mira.live, mira.startListening, mira.stateRef]);
  const gestureLabel = waveSeen ? 'Wave' : ({
    Open_Palm: 'Open Palm',
    Closed_Fist: 'Closed Fist',
    Thumb_Up: 'Thumb Up',
    Thumb_Down: 'Thumb Down',
    Victory: 'Victory',
    Pointing_Up: 'Pointing Up',
    ILoveYou: 'I Love You',
    None: 'No gesture',
  } as Record<string, string>)[gestureName] || gestureName;

  const constellationContext = [
    ...mira.history.slice(-6).map((turn) => turn.text),
    mira.caption,
  ].join(' ');

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
          <button
            type="button"
            className={visionOn ? 'vision-active' : ''}
            onClick={() => void toggleVision()}
            aria-pressed={visionOn}
            title={visionOn ? 'Tắt camera nhận diện' : 'Bật camera nhận diện'}
          >
            {visionOn ? <IconCameraOff /> : <IconCamera />}
            <span className="sr-only">{visionOn ? 'Tắt camera nhận diện' : 'Bật camera nhận diện'}</span>
          </button>
          <button type="button" data-air-action="safe" data-air-label="Đổi theme" onClick={cycleTheme} title="Đổi màu"><span className="v2-theme-dot" aria-hidden="true" /><span className="sr-only">Đổi màu</span></button>
          <button type="button" data-air-action="safe" data-air-label="Cài đặt" onClick={() => setSettingsOpen(true)} title="Cài đặt"><IconSettings /><span className="sr-only">Mở cài đặt</span></button>
        </nav>
      </header>

      {(mira.error || visionError) && <div className="v2-error" role="alert">{visionError || mira.error}</div>}

      {visionOn && (
        <div className="v2-vision-monitor" aria-live="polite">
          <div className="v2-camera-frame">
            <video ref={cameraPreviewRef} className="v2-camera-preview" autoPlay muted playsInline aria-label="Camera preview" />
            <div className="v2-camera-status">
              <span className={faceSeen ? 'detected' : ''}>Face</span>
              <span className={handSeen ? 'detected' : ''}>Hand</span>
            </div>
            {handSeen && (
              <>
                <HandSkeletonOverlay points={handLandmarks} active={handSeen} />
                <span
                  className={`v2-hand-point${waveSeen ? ' wave' : ''}`}
                  style={{ left: `${(1 - handPoint.x) * 100}%`, top: `${handPoint.y * 100}%` }}
                  aria-hidden="true"
                />
                <div className={`v2-gesture-overlay${waveSeen ? ' wave' : ''}`}>
                  <b>{gestureLabel}</b>
                  <span>{Math.round(gestureScore * 100)}%</span>
                </div>
              </>
            )}
            {!handSeen && <div className="v2-gesture-hint">Đưa bàn tay vào khung</div>}
          </div>
        </div>
      )}
      {visionBooting && <div className="v2-vision-loading">Đang mở camera…</div>}
      <AirControlOverlay
        visible={visionOn && handSeen}
        x={airPoint.x}
        y={airPoint.y}
        pinching={pinching}
        targetLabel={airTargetLabel}
        feedback={airFeedback}
      />

      <main className="v2-workspace voice-workspace" id="main-content" tabIndex={-1}>
        <div className="voice-stage holographic-stage">
          <PhotorealMira
            state={mira.state}
            onActivate={activateVoice}
            contextText={constellationContext}
            live={mira.live}
            voiceReady={voiceReady}
            caption={mira.caption}
            who={mira.who}
            brainName={mira.brainName}
            sttAvailable={mira.sttAvailable}
          />
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
          data-air-action="safe"
          data-air-label={mira.live ? 'Tắt live voice' : 'Bật live voice'}
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
