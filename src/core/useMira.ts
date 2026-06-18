import { useCallback, useEffect, useRef, useState } from 'react';
import type { BrainTurn, MiraState, Mood, VoiceOption } from './types';
import { loadHistory, saveTurn, recallMemory, distillFacts } from './history-store';
import { detectContent, fetchWeather, pollinationsImage, type Content } from './content';
import { WebSpeechSTT } from './stt/webspeech-stt';
import { startMicLevel, stopMicLevel, primeAudio } from './audio-level';
import { voicePrefs, loadVoicePrefs } from './voice-prefs';
import { SileroVAD } from './vad/silero-vad';
import { loadVadEnabled } from './vad/config';
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

// Tách câu trả lời thành cụm ~câu để phát NỐI TIẾP (streaming TTS): cụm đầu ngắn → phát sớm,
// giảm trễ "time-to-first-audio" (engine server/cloud synth theo độ dài). Gộp cụm <40 ký tự để
// khỏi bắn quá nhiều request tí hon. 1 câu/không dấu câu → trả nguyên (hành vi như cũ).
function chunkSpeech(text: string): string[] {
  const sents = text.match(/[^.!?…\n]+[.!?…]*/g)?.map((s) => s.trim()).filter(Boolean) ?? [];
  if (sents.length <= 1) return [text.trim()].filter(Boolean);
  const out: string[] = [];
  let cur = '';
  for (const s of sents) {
    cur = cur ? `${cur} ${s}` : s;
    if (out.length === 0 || cur.length >= 40) {
      out.push(cur); // cụm ĐẦU = câu đầu (kêu ngay); các cụm sau gộp tới ~40 ký tự
      cur = '';
    }
  }
  if (cur) out.push(cur);
  return out.length ? out : [text.trim()];
}

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
  const [content, setContent] = useState<Content | null>(null); // panel trực quan (thời tiết/ảnh) cạnh avatar
  const [voices, setVoices] = useState<VoiceOption[]>([]);
  const [voiceURI, setVoiceURI] = useState<string | undefined>(''); // mặc định = giọng đầu tiên "Eva" (uri '')
  const voiceURIRef = useRef<string | undefined>('');
  const [brainName, setBrainName] = useState(() => brainRef.current!.name);
  const pendingTranscriptRef = useRef('');
  const emptyCountRef = useRef(0);
  const startListeningRef = useRef<() => void>(() => {});
  const pendingListenRef = useRef<number | null>(null);
  const vadRef = useRef<SileroVAD | null>(null);
  const speakSeqRef = useRef(0); // token phiên nói: ++ mỗi speak mới / khi huỷ → dừng hàng đợi streaming cũ

  // Huỷ nói: tăng token (vô hiệu hàng đợi streaming đang phát) + dừng TTS. Dùng cho mọi barge-in/stop.
  const cancelSpeech = useCallback(() => {
    speakSeqRef.current++;
    ttsRef.current?.cancel();
  }, []);

  const pushHistory = useCallback((turn: BrainTurn) => {
    historyRef.current = [...historyRef.current, turn].slice(-12);
    setHistory(historyRef.current);
    saveTurn(turn); // lưu lên Neon (fire-and-forget; thiếu DB thì im lặng bỏ qua)
  }, []);

  // Nạp lịch sử hội thoại từ Neon khi mở app → Mira nhớ chuyện phiên trước. Lỗi/thiếu DB → bỏ qua.
  useEffect(() => {
    let alive = true;
    loadHistory().then((turns) => {
      if (!alive || !turns.length || historyRef.current.length) return; // đừng đè lượt của phiên hiện tại
      historyRef.current = turns.slice(-12);
      setHistory(historyRef.current);
    });
    return () => {
      alive = false;
    };
  }, []);

  // Nạp danh sách giọng vi-VN (getVoices() thường rỗng cho tới khi 'voiceschanged' bắn).
  // Đọc ttsRef động để vẫn đúng sau khi hot-swap engine giọng.
  useEffect(() => {
    const load = () => {
      const tts = ttsRef.current!;
      const vi = tts.listVoices('vi');
      const list = vi.length ? vi : tts.listVoices();
      setVoices(list);
      // Mặc định là giọng đầu tiên "Eva" (voiceURI = '' → engine tự dùng giọng mặc định). Người dùng đổi tuỳ ý.
    };
    load();
    window.speechSynthesis?.addEventListener?.('voiceschanged', load);
    return () => window.speechSynthesis?.removeEventListener?.('voiceschanged', load);
  }, []);

  // Nạp tốc độ/tính cách giọng (dùng cho speak() và brain).
  useEffect(() => {
    loadVoicePrefs();
  }, []);

  // Dọn dẹp khi unmount: dừng mọi thứ.
  useEffect(
    () => () => {
      liveRef.current = false;
      if (pendingListenRef.current != null) clearTimeout(pendingListenRef.current);
      try {
        stopMicLevel();
        vadRef.current?.destroy();
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
    primeAudio(); // mở khoá AudioContext trong gesture → ElevenLabs/VieNeu không bị câm
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
    cancelSpeech();
    ttsRef.current = createTTS();
    const refresh = () => {
      const vi = ttsRef.current!.listVoices('vi');
      const list = vi.length ? vi : ttsRef.current!.listVoices();
      setVoices(list);
      voiceURIRef.current = undefined; // đổi engine → bỏ chọn, dùng giọng mặc định của engine
      setVoiceURI(undefined);
    };
    refresh();
    window.setTimeout(refresh, 1500); // VieNeu nạp preset voices async từ server → quét lại
  }, [cancelSpeech]);

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
      stopMicLevel();
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
      stopMicLevel(); // nhường audioLevel cho AnalyserNode của TTS (orb nảy theo giọng Mira)
      setWho('MIRA');
      setPartial(false);
      setCaption(text); // hiện FULL câu trả lời (dù phát theo từng cụm)
      setState('speaking');

      // Streaming: phát từng cụm nối tiếp — cụm đầu kêu sớm trong khi cụm sau đang synth.
      const chunks = chunkSpeech(cleanForSpeech(text) || text);
      const token = ++speakSeqRef.current; // phiên nói này; barge-in/đè sẽ tăng token → dừng hàng đợi
      const finishTurn = () => {
        if (stateRef.current !== 'speaking' || speakSeqRef.current !== token) return;
        if (liveRef.current) restartListenSoon(); // live: nói xong tự nghe tiếp
        else goIdle(IDLE_CAPTION);
      };
      const playFrom = (i: number) => {
        if (stateRef.current !== 'speaking' || speakSeqRef.current !== token) return; // bị ngắt/đè
        if (i >= chunks.length) {
          finishTurn();
          return;
        }
        ttsRef.current!.speak({
          text: chunks[i],
          lang: LANG,
          rate: voicePrefs.rate, // tốc độ theo Cài đặt (mặc định bình thường)
          voiceURI: voiceURIRef.current,
          onEnd: () => playFrom(i + 1), // cụm xong → cụm tiếp; cụm cuối → finishTurn()
          onError: finishTurn, // lỗi giữa chừng → kết thúc lượt như cũ (nghe lại / idle)
        });
      };
      playFrom(0);
    },
    [goIdle, restartListenSoon, setState],
  );

  const handleUtterance = useCallback(
    async (text: string) => {
      emptyCountRef.current = 0; // người dùng có nói → reset bộ đếm im lặng
      stopMicLevel(); // hết lượt nghe → trạng thái 'thinking' dùng envelope giả lập
      // QUAN TRỌNG: chốt history TRƯỚC khi push lượt hiện tại — LLMBrain sẽ tự append input.
      // (bug cũ: push trước rồi truyền history chứa luôn input → user nhân đôi → Anthropic 400)
      const prior = historyRef.current;
      pushHistory({ role: 'user', text });
      // Trực quan hoá: phát hiện hỏi thời tiết/ảnh → fetch song song (không chặn câu trả lời) → hiện panel.
      const intent = detectContent(text);
      if (intent?.kind === 'weather') {
        fetchWeather(intent.city).then((w) => w && setContent({ kind: 'weather', data: w }));
      } else if (intent?.kind === 'image') {
        setContent({ kind: 'image', data: { prompt: intent.prompt, url: pollinationsImage(intent.prompt) } });
      }
      setWho('MIRA');
      setPartial(false);
      setCaption('Đang suy nghĩ…');
      setMoodBoth('thinking');
      setState('thinking');
      const t0 = performance.now();
      try {
        const memory = await recallMemory(text); // truy hồi ký ức liên quan (RAG); '' nếu thiếu DB/key
        const reply = await brainRef.current!.reply(text, prior, memory);
        setLatencyMs(Math.round(performance.now() - t0));
        if (stateRef.current !== 'thinking') return; // bị ngắt lúc đang nghĩ → bỏ
        setMoodBoth(reply.mood || 'neutral');
        pushHistory({ role: 'mira', text: reply.text });
        speak(reply.text);
        distillFacts(`Người dùng: ${text}\nMira: ${reply.text}`); // chắt lọc hồ sơ người dùng (Gemini free, nền)
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
      cancelSpeech();
      goIdle('Em tạm dừng nhé — bật lại trò chuyện khi anh cần.');
    } else {
      setWho('MIRA');
      setCaption('Em vẫn đang nghe…');
      restartListenSoon();
    }
  }, [goIdle, restartListenSoon, setLive, cancelSpeech]);

  const startListening = useCallback(() => {
    const stt = sttRef.current!;
    clearPendingListen(); // đang mở mic ngay → huỷ mọi lượt nghe còn hẹn
    ttsRef.current!.unlock();
    cancelSpeech(); // chắc chắn TTS đã tắt trước khi mở mic
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
    void startMicLevel(); // orb/waveform nảy theo giọng người dùng (best-effort)
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
  }, [clearPendingListen, goIdle, handleEmptyListen, handleUtterance, setLive, setState, cancelSpeech]);

  useEffect(() => {
    startListeningRef.current = startListening;
  }, [startListening]);

  const stopListening = useCallback(() => {
    sttRef.current!.abort();
    goIdle(IDLE_CAPTION);
  }, [goIdle]);

  // Barge-in: dừng TTS tức thì, sang 'interrupted', rồi nghe lại (giữ nguyên live nếu đang live).
  const interrupt = useCallback(() => {
    cancelSpeech();
    sttRef.current!.abort();
    stopMicLevel();
    setState('interrupted');
    setWho('MIRA');
    setPartial(false);
    setCaption('— Được, em nghe đây.');
    // Chỉ nghe lại nếu vẫn còn ở 'interrupted' lúc timer bắn (đã dừng/đổi trạng thái → bỏ).
    schedulePendingListen(350, () => stateRef.current === 'interrupted');
  }, [schedulePendingListen, setState, cancelSpeech]);

  // ── Chế độ trò chuyện trực tiếp (live) ──
  const startLive = useCallback(() => {
    setLive(true);
    emptyCountRef.current = 0;
    ttsRef.current!.unlock();
    // Ngắt lời bằng GIỌNG (opt-in): VAD nghe nền cả phiên, chỉ cắt khi Mira đang 'speaking'
    // (lúc nghe/nghĩ thì bỏ qua — Web Speech lo). Lỗi/không bật → barge-in bằng nút/Space.
    if (loadVadEnabled()) {
      if (!vadRef.current) {
        const vad = new SileroVAD();
        vadRef.current = vad;
        void vad
          .init({
            onSpeechStart: () => {
              if (stateRef.current === 'speaking') interrupt();
            },
          })
          .then((ok) => {
            if (ok && liveRef.current) vad.start();
          });
      } else {
        vadRef.current.start();
      }
    }
    startListening();
  }, [setLive, startListening, interrupt]);

  const stopLive = useCallback(() => {
    setLive(false);
    vadRef.current?.pause();
    cancelSpeech();
    sttRef.current!.abort();
    goIdle('Đã dừng trò chuyện. Chạm để nói, hoặc bật lại khi cần.');
  }, [goIdle, setLive, cancelSpeech]);

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
      stopMicLevel();
      ttsRef.current!.unlock();
      cancelSpeech();
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
    [clearPendingListen, setLive, setState, cancelSpeech],
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
    say: speak, // đọc 1 câu canned (dùng cho phản ứng cử chỉ: chào, cảm ơn…)
    content, // panel trực quan (thời tiết/ảnh) cạnh avatar; null = không có
    clearContent: () => setContent(null),
  };
}

export type UseMira = ReturnType<typeof useMira>;
