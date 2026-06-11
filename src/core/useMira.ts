import { useCallback, useEffect, useRef, useState } from 'react';
import type { BrainTurn, MiraState, Mood, VoiceOption } from './types';
import { WebSpeechSTT } from './stt/webspeech-stt';
import {
  createTTS,
  saveTTSConfig,
  type MiraTTS,
  type TTSConfig,
  type TTSDiagnostics,
} from './tts';
import { createBrain, saveLLMConfig, type LLMConfig } from './brain';

const LANG = 'vi-VN';
const IDLE_CAPTION = 'Chạm để nói, hoặc bật trò chuyện trực tiếp.';
const RESTART_DELAY = 450; // nghỉ giữa các lượt nghe trong chế độ live
const MAX_EMPTY = 5; // số lượt im lặng liên tiếp trước khi tự dừng live (guardrail)

// Câu thoại cho nút trạng thái thủ công + nút "Mô phỏng hội thoại" (không cần mic).
const DEMO_COPY: Record<MiraState, { who: string; txt: string }> = {
  idle: { who: 'CHẠM ĐỂ NÓI', txt: IDLE_CAPTION },
  listening: { who: 'BẠN ĐANG NÓI', txt: 'Mira, tóm tắt phiên audit sáng nay giúp em' },
  thinking: { who: 'MIRA', txt: 'Đang suy nghĩ…' },
  speaking: {
    who: 'MIRA',
    txt: 'Tất nhiên rồi! Phiên sáng nay có ba lỗi nghiêm trọng và mười hai cảnh báo — em ưu tiên phần lệch màu ở màn Đăng nhập trước nhé.',
  },
  interrupted: { who: 'MIRA', txt: '— Được, em dừng lại.' },
  error: { who: 'LỖI', txt: 'Có lỗi xảy ra.' },
};

export function useMira() {
  const sttRef = useRef<WebSpeechSTT | null>(null);
  const ttsRef = useRef<MiraTTS | null>(null);
  const brainRef = useRef<ReturnType<typeof createBrain> | null>(null);
  if (!sttRef.current) sttRef.current = new WebSpeechSTT();
  if (!ttsRef.current) ttsRef.current = createTTS();
  if (!brainRef.current) brainRef.current = createBrain();

  const [state, setStateRaw] = useState<MiraState>('idle');
  const stateRef = useRef<MiraState>('idle');
  const setState = useCallback((s: MiraState) => {
    stateRef.current = s;
    setStateRaw(s);
  }, []);

  const [live, setLiveRaw] = useState(false);
  const liveRef = useRef(false);
  const setLive = useCallback((v: boolean) => {
    liveRef.current = v;
    setLiveRaw(v);
  }, []);

  // Mood điều khiển biểu cảm avatar VRM (lấy từ BrainReply.mood).
  const [mood, setMood] = useState<Mood>('neutral');
  const moodRef = useRef<Mood>('neutral');
  const setMoodBoth = useCallback((m: Mood) => {
    moodRef.current = m;
    setMood(m);
  }, []);

  const [caption, setCaption] = useState(IDLE_CAPTION);
  const [who, setWho] = useState('CHẠM ĐỂ NÓI');
  const [partial, setPartial] = useState(false);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<BrainTurn[]>([]);
  const historyRef = useRef<BrainTurn[]>([]);
  const [voices, setVoices] = useState<VoiceOption[]>([]);
  const [voiceURI, setVoiceURI] = useState<string | undefined>(undefined);
  const voiceURIRef = useRef<string | undefined>(undefined);
  const [brainName, setBrainName] = useState(() => brainRef.current!.name);
  const pendingTranscriptRef = useRef('');
  const emptyCountRef = useRef(0);
  const startListeningRef = useRef<() => void>(() => {});
  const pendingListenRef = useRef<number | null>(null);

  const pushHistory = useCallback((turn: BrainTurn) => {
    historyRef.current = [...historyRef.current, turn].slice(-12);
    setHistory(historyRef.current);
  }, []);

  // Nạp danh sách giọng vi-VN (getVoices() thường rỗng cho tới khi 'voiceschanged' bắn).
  // Đọc ttsRef động để vẫn đúng sau khi hot-swap engine giọng.
  useEffect(() => {
    const load = () => {
      const tts = ttsRef.current!;
      const vi = tts.listVoices('vi');
      const list = vi.length ? vi : tts.listVoices();
      setVoices(list);
      if (!voiceURIRef.current && vi[0]) {
        voiceURIRef.current = vi[0].voiceURI;
        setVoiceURI(vi[0].voiceURI);
      }
    };
    load();
    window.speechSynthesis?.addEventListener?.('voiceschanged', load);
    return () => window.speechSynthesis?.removeEventListener?.('voiceschanged', load);
  }, []);

  // Dọn dẹp khi unmount: dừng mọi thứ.
  useEffect(
    () => () => {
      liveRef.current = false;
      if (pendingListenRef.current != null) clearTimeout(pendingListenRef.current);
      try {
        ttsRef.current?.cancel();
        sttRef.current?.abort();
      } catch {
        /* noop */
      }
    },
    [],
  );

  const selectVoice = useCallback((uri: string) => {
    voiceURIRef.current = uri;
    setVoiceURI(uri);
  }, []);

  const unlockAudio = useCallback(() => {
    ttsRef.current!.unlock();
  }, []);

  // Developer Console: lưu API key → tạo lại bộ não ngay, không cần reload.
  const applyLLMConfig = useCallback((cfg: LLMConfig) => {
    saveLLMConfig(cfg);
    brainRef.current = createBrain();
    setBrainName(brainRef.current.name);
  }, []);

  // Đọc câu thử (gọi trong user-gesture) + bảng chẩn đoán TTS cho popup.
  const testVoice = useCallback(() => {
    ttsRef.current!.test(voiceURIRef.current);
  }, []);
  const ttsDiagnostics = useCallback((): TTSDiagnostics => ttsRef.current!.diagnostics(), []);

  // Developer Console: đổi engine giọng (hệ thống / ElevenLabs / VieNeu) — hot-swap như brain.
  const applyTTSConfig = useCallback((cfg: TTSConfig) => {
    saveTTSConfig(cfg);
    ttsRef.current?.cancel();
    ttsRef.current = createTTS();
    const refresh = () => {
      const vi = ttsRef.current!.listVoices('vi');
      const list = vi.length ? vi : ttsRef.current!.listVoices();
      setVoices(list);
      const pick = (cfg.voiceId && list.find((v) => v.voiceURI === cfg.voiceId)) || list[0];
      voiceURIRef.current = pick?.voiceURI;
      setVoiceURI(pick?.voiceURI);
    };
    refresh();
    window.setTimeout(refresh, 1500); // VieNeu nạp preset voices async từ server → quét lại
  }, []);

  // Developer Console: gọi thử bộ não 1 câu, trả kết quả/lỗi THẬT để chẩn đoán tại chỗ.
  const testBrain = useCallback(async (): Promise<string> => {
    try {
      const r = await brainRef.current!.reply('Chào em, em nghe rõ không?', []);
      return `OK — "${r.text.slice(0, 90)}"`;
    } catch (e) {
      return `LỖI: ${e instanceof Error ? e.message : String(e)}`;
    }
  }, []);

  // MỘT timer "nghe lại trễ" duy nhất cho cả vòng live lẫn barge-in.
  // clear-before-arm (chỉ lượt mới nhất tồn tại) + guard tại thời điểm bắn
  // → không bao giờ có 2 lượt nghe chồng nhau, và mọi điểm dừng đều huỷ được nó.
  const clearPendingListen = useCallback(() => {
    if (pendingListenRef.current != null) {
      clearTimeout(pendingListenRef.current);
      pendingListenRef.current = null;
    }
  }, []);

  const schedulePendingListen = useCallback(
    (delayMs: number, guard: () => boolean) => {
      clearPendingListen();
      pendingListenRef.current = window.setTimeout(() => {
        pendingListenRef.current = null;
        if (guard()) startListeningRef.current();
      }, delayMs);
    },
    [clearPendingListen],
  );

  const goIdle = useCallback(
    (msg?: string) => {
      clearPendingListen(); // về idle = huỷ mọi lượt nghe đang hẹn
      setMoodBoth('neutral');
      setState('idle');
      setWho('CHẠM ĐỂ NÓI');
      setPartial(false);
      if (msg) setCaption(msg);
    },
    [clearPendingListen, setMoodBoth, setState],
  );

  // Trong chế độ live: nghe lại sau một nhịp ngắn (guard liveRef lúc bắn).
  const restartListenSoon = useCallback(() => {
    schedulePendingListen(RESTART_DELAY, () => liveRef.current);
  }, [schedulePendingListen]);

  // Văn bản ĐỌC: bỏ markdown/emoji lọt lưới (giọng đọc ký tự lạ nghe rất "AI").
  const cleanForSpeech = (s: string) =>
    s
      .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1') // [text](link) → text
      .replace(/[*_`#>~|]/g, '')
      .replace(/\p{Extended_Pictographic}/gu, '')
      .replace(/\s{2,}/g, ' ')
      .trim();

  const speak = useCallback(
    (text: string) => {
      sttRef.current!.abort(); // nhả mic trước khi nói (half-duplex: không nghe trong lúc nói → hết echo)
      setWho('MIRA');
      setPartial(false);
      setCaption(text);
      setState('speaking');
      ttsRef.current!.speak({
        text: cleanForSpeech(text) || text,
        lang: LANG,
        rate: 1.04, // giọng hệ thống đọc hơi lê thê — nhanh nhẹ lên nghe tự nhiên hơn
        voiceURI: voiceURIRef.current,
        onEnd: () => {
          if (stateRef.current !== 'speaking') return;
          if (liveRef.current) restartListenSoon(); // live: nói xong tự nghe tiếp
          else goIdle(IDLE_CAPTION);
        },
        onError: () => {
          if (stateRef.current !== 'speaking') return;
          if (liveRef.current) restartListenSoon();
          else goIdle(IDLE_CAPTION);
        },
      });
    },
    [goIdle, restartListenSoon, setState],
  );

  const handleUtterance = useCallback(
    async (text: string) => {
      emptyCountRef.current = 0; // người dùng có nói → reset bộ đếm im lặng
      // QUAN TRỌNG: chốt history TRƯỚC khi push lượt hiện tại — LLMBrain sẽ tự append input.
      // (bug cũ: push trước rồi truyền history chứa luôn input → user nhân đôi → Anthropic 400)
      const prior = historyRef.current;
      pushHistory({ role: 'user', text });
      setWho('MIRA');
      setPartial(false);
      setCaption('Đang suy nghĩ…');
      setMoodBoth('thinking');
      setState('thinking');
      const t0 = performance.now();
      try {
        const reply = await brainRef.current!.reply(text, prior);
        setLatencyMs(Math.round(performance.now() - t0));
        if (stateRef.current !== 'thinking') return; // bị ngắt lúc đang nghĩ → bỏ
        setMoodBoth(reply.mood || 'neutral');
        pushHistory({ role: 'mira', text: reply.text });
        speak(reply.text);
      } catch (e) {
        setLatencyMs(Math.round(performance.now() - t0));
        const msg = e instanceof Error ? e.message : String(e);
        console.error('[Mira Brain] reply failed:', e);
        setError(`Bộ não lỗi: ${msg.slice(0, 160)}`); // hiện lý do thật trên errbar
        if (stateRef.current === 'thinking')
          speak('Xin lỗi anh, bộ não của em đang trục trặc. Anh thử lại giúp em nhé.');
      }
    },
    [pushHistory, setMoodBoth, setState, speak],
  );

  // Lượt nghe rỗng (người dùng im lặng): live thì nghe lại; quá ngưỡng thì tự dừng.
  const handleEmptyListen = useCallback(() => {
    if (!liveRef.current) {
      goIdle('Em chưa nghe rõ — anh nhấn mic nói lại nhé.');
      return;
    }
    emptyCountRef.current += 1;
    if (emptyCountRef.current >= MAX_EMPTY) {
      setLive(false);
      ttsRef.current!.cancel();
      goIdle('Em tạm dừng nhé — bật lại trò chuyện khi anh cần.');
    } else {
      setWho('MIRA');
      setCaption('Em vẫn đang nghe…');
      restartListenSoon();
    }
  }, [goIdle, restartListenSoon, setLive]);

  const startListening = useCallback(() => {
    const stt = sttRef.current!;
    clearPendingListen(); // đang mở mic ngay → huỷ mọi lượt nghe còn hẹn
    ttsRef.current!.unlock();
    ttsRef.current!.cancel(); // chắc chắn TTS đã tắt trước khi mở mic
    setError(null);
    pendingTranscriptRef.current = '';
    if (!stt.available) {
      setState('error');
      setLive(false);
      setError('Trình duyệt không hỗ trợ nhận giọng nói. Hãy mở bằng Chrome hoặc Edge.');
      return;
    }
    setWho('BẠN ĐANG NÓI');
    setPartial(true);
    setCaption('Đang nghe…');
    setState('listening');
    stt.start({
      lang: LANG,
      onResult: (r) => {
        pendingTranscriptRef.current = r.transcript;
        setCaption(r.transcript || 'Đang nghe…');
        setPartial(!r.isFinal);
        if (r.isFinal && r.transcript) handleUtterance(r.transcript);
      },
      onError: (err) => {
        if (err === 'aborted' || err === 'no-speech') return; // để onEnd quyết định (tránh xử lý 2 lần)
        if (err === 'not-allowed' || err === 'service-not-allowed') {
          setLive(false);
          setState('error');
          setError('Mic bị chặn. Cho phép quyền micro cho trang này rồi thử lại nhé.');
          return;
        }
        if (err === 'network') {
          setLive(false);
          setState('error');
          setError('Mất kết nối khi nhận giọng nói.');
          return;
        }
        setLive(false);
        goIdle();
      },
      onEnd: () => {
        if (stateRef.current !== 'listening') return; // đã chuyển trạng thái (final/error) → bỏ qua
        const pending = pendingTranscriptRef.current.trim();
        if (pending) handleUtterance(pending);
        else handleEmptyListen();
      },
    });
  }, [clearPendingListen, goIdle, handleEmptyListen, handleUtterance, setLive, setState]);

  useEffect(() => {
    startListeningRef.current = startListening;
  }, [startListening]);

  const stopListening = useCallback(() => {
    sttRef.current!.abort();
    goIdle(IDLE_CAPTION);
  }, [goIdle]);

  // Barge-in: dừng TTS tức thì, sang 'interrupted', rồi nghe lại (giữ nguyên live nếu đang live).
  const interrupt = useCallback(() => {
    ttsRef.current!.cancel();
    sttRef.current!.abort();
    setState('interrupted');
    setWho('MIRA');
    setPartial(false);
    setCaption('— Được, em nghe đây.');
    // Chỉ nghe lại nếu vẫn còn ở 'interrupted' lúc timer bắn (đã dừng/đổi trạng thái → bỏ).
    schedulePendingListen(350, () => stateRef.current === 'interrupted');
  }, [schedulePendingListen, setState]);

  // ── Chế độ trò chuyện trực tiếp (live) ──
  const startLive = useCallback(() => {
    setLive(true);
    emptyCountRef.current = 0;
    ttsRef.current!.unlock();
    startListening();
  }, [setLive, startListening]);

  const stopLive = useCallback(() => {
    setLive(false);
    ttsRef.current!.cancel();
    sttRef.current!.abort();
    goIdle('Đã dừng trò chuyện. Chạm để nói, hoặc bật lại khi cần.');
  }, [goIdle, setLive]);

  const toggleLive = useCallback(() => {
    if (liveRef.current) stopLive();
    else startLive();
  }, [startLive, stopLive]);

  // Nút mic / Space:
  //  - đang live → ngắt lời (reset lượt, nghe lại) nhưng KHÔNG thoát live
  //  - thường: speaking→ngắt, listening→dừng, còn lại→bắt đầu nghe một lượt
  const toggleMic = useCallback(() => {
    if (liveRef.current) {
      interrupt();
      return;
    }
    const s = stateRef.current;
    if (s === 'speaking') interrupt();
    else if (s === 'listening') stopListening();
    else startListening();
  }, [interrupt, startListening, stopListening]);

  // Đổi trạng thái thủ công (nút debug + mô phỏng). speakIt=true → đọc luôn để test TTS.
  const demoGo = useCallback(
    (s: MiraState, speakIt = false) => {
      setLive(false);
      clearPendingListen();
      ttsRef.current!.unlock();
      ttsRef.current!.cancel();
      sttRef.current!.abort();
      const c = DEMO_COPY[s];
      setWho(c.who);
      setPartial(false);
      setCaption(c.txt);
      setState(s);
      if (speakIt && s === 'speaking') {
        ttsRef.current!.speak({ text: c.txt, lang: LANG, voiceURI: voiceURIRef.current });
      }
    },
    [clearPendingListen, setLive, setState],
  );

  return {
    state,
    stateRef,
    live,
    mood,
    moodRef,
    caption,
    who,
    partial,
    latencyMs,
    error,
    history,
    voices,
    voiceURI,
    selectVoice,
    unlockAudio,
    sttAvailable: sttRef.current!.available,
    ttsAvailable: ttsRef.current!.available,
    brainName,
    applyLLMConfig,
    applyTTSConfig,
    testBrain,
    testVoice,
    ttsDiagnostics,
    toggleMic,
    toggleLive,
    startListening,
    interrupt,
    demoGo,
  };
}

export type UseMira = ReturnType<typeof useMira>;
