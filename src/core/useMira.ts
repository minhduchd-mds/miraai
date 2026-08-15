import { useCallback, useEffect, useRef, useState } from 'react';
import type { BrainTurn, MiraState, Mood, VoiceOption } from './types';
import type { Content } from './content';
import { WebSpeechSTT } from './stt/webspeech-stt';
import { startMicLevel, stopMicLevel, primeAudio } from './audio-level';
import { voicePrefs, loadVoicePrefs } from './voice-prefs';
import { SileroVAD } from './vad/silero-vad';
import { loadVadEnabled } from './vad/config';
import { loadSmartTurn } from './stt/turn-config';
import { computeEndpointDelay, ENDPOINT } from './stt/endpointer';
import {
  createTTS,
  saveTTSConfig,
  type MiraTTS,
  type TTSConfig,
  type TTSDiagnostics,
} from './tts';
import { createBrain, saveLLMConfig, type LLMConfig } from './brain';
import { transition, type ConversationEvent } from '../runtime/conversation-machine';
import { SpeechQueue } from '../runtime/speech-queue';
import {
  interruptionRecoveryDelayMs,
  planConversationTiming,
  resumeListeningDelayMs,
  silenceRetryDelayMs,
  type ConversationSource,
} from '../runtime/conversation-timing';
import { TurnManager } from '../runtime/turn-manager';
import { MemoryService } from '../intelligence/memory/memory-service';
import { createDefaultSkillRegistry } from '../intelligence/skills';
import { getHostBridge } from '../host';

const LANG = 'vi-VN';
const IDLE_CAPTION = 'Chạm để nói, hoặc nhập tin nhắn cho Mira.';
const MAX_EMPTY = 5;

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
  const memoryRef = useRef<MemoryService | null>(null);
  const skillRegistryRef = useRef<ReturnType<typeof createDefaultSkillRegistry> | null>(null);
  const speechQueueRef = useRef<SpeechQueue | null>(null);
  const turnManagerRef = useRef<TurnManager | null>(null);

  if (!sttRef.current) sttRef.current = new WebSpeechSTT();
  if (!ttsRef.current) ttsRef.current = createTTS();
  if (!brainRef.current) brainRef.current = createBrain();
  if (!memoryRef.current) memoryRef.current = new MemoryService();
  if (!skillRegistryRef.current) skillRegistryRef.current = createDefaultSkillRegistry();
  if (!speechQueueRef.current) speechQueueRef.current = new SpeechQueue(() => ttsRef.current);
  if (!turnManagerRef.current) {
    turnManagerRef.current = new TurnManager(
      () => brainRef.current!,
      memoryRef.current!,
      skillRegistryRef.current!,
      getHostBridge(),
    );
  }

  const [state, setStateRaw] = useState<MiraState>('idle');
  const stateRef = useRef<MiraState>('idle');

  const forceState = useCallback((next: MiraState) => {
    stateRef.current = next;
    setStateRaw(next);
  }, []);

  const sendEvent = useCallback((event: ConversationEvent) => {
    const next = transition(stateRef.current, event);
    stateRef.current = next;
    setStateRaw(next);
    return next;
  }, []);

  const [live, setLiveRaw] = useState(false);
  const liveRef = useRef(false);
  const setLive = useCallback((value: boolean) => {
    liveRef.current = value;
    setLiveRaw(value);
  }, []);

  const [mood, setMood] = useState<Mood>('neutral');
  const moodRef = useRef<Mood>('neutral');
  const setMoodBoth = useCallback((value: Mood) => {
    moodRef.current = value;
    setMood(value);
  }, []);

  const [caption, setCaption] = useState(IDLE_CAPTION);
  const [who, setWho] = useState('CHẠM ĐỂ NÓI');
  const [partial, setPartial] = useState(false);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<BrainTurn[]>([]);
  const historyRef = useRef<BrainTurn[]>([]);
  const [content, setContent] = useState<Content | null>(null);
  const [voices, setVoices] = useState<VoiceOption[]>([]);
  const [voiceURI, setVoiceURI] = useState<string | undefined>('');
  const voiceURIRef = useRef<string | undefined>('');
  const [brainName, setBrainName] = useState(() => brainRef.current!.name);

  const pendingTranscriptRef = useRef('');
  const emptyCountRef = useRef(0);
  const startListeningRef = useRef<() => void>(() => {});
  const pendingListenRef = useRef<number | null>(null);
  const endpointTimerRef = useRef<number | null>(null);
  const thinkingCaptionTimerRef = useRef<number | null>(null);
  const thinkingCueTimerRef = useRef<number | null>(null);
  const thinkingLongTimerRef = useRef<number | null>(null);
  const vadRef = useRef<SileroVAD | null>(null);
  const turnSeqRef = useRef(0);
  const lastBrainLatencyRef = useRef<number | null>(null);
  const recentThinkingCueRef = useRef('');
  const interruptedTurnRef = useRef(false);

  const clearThinkingSignals = useCallback(() => {
    for (const ref of [thinkingCaptionTimerRef, thinkingCueTimerRef, thinkingLongTimerRef]) {
      if (ref.current != null) {
        window.clearTimeout(ref.current);
        ref.current = null;
      }
    }
  }, []);

  const cancelSpeech = useCallback(() => {
    clearThinkingSignals();
    speechQueueRef.current?.cancel();
  }, [clearThinkingSignals]);

  const pushHistory = useCallback((turn: BrainTurn) => {
    historyRef.current = [...historyRef.current, turn].slice(-12);
    setHistory(historyRef.current);
    memoryRef.current!.save(turn);
  }, []);

  useEffect(() => {
    let alive = true;
    memoryRef.current!.loadRecent().then((turns) => {
      if (!alive || !turns.length || historyRef.current.length) return;
      historyRef.current = turns.slice(-12);
      setHistory(historyRef.current);
    });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    const load = () => {
      const tts = ttsRef.current!;
      const vi = tts.listVoices('vi');
      setVoices(vi.length ? vi : tts.listVoices());
    };
    load();
    window.speechSynthesis?.addEventListener?.('voiceschanged', load);
    return () => window.speechSynthesis?.removeEventListener?.('voiceschanged', load);
  }, []);

  useEffect(() => {
    loadVoicePrefs();
  }, []);

  useEffect(
    () => () => {
      liveRef.current = false;
      turnSeqRef.current += 1;
      if (pendingListenRef.current != null) clearTimeout(pendingListenRef.current);
      if (endpointTimerRef.current != null) clearTimeout(endpointTimerRef.current);
      clearThinkingSignals();
      try {
        stopMicLevel();
        vadRef.current?.destroy();
        speechQueueRef.current?.cancel();
        sttRef.current?.abort();
      } catch {
        // best-effort cleanup
      }
    },
    [clearThinkingSignals],
  );

  const selectVoice = useCallback((uri: string) => {
    voiceURIRef.current = uri;
    setVoiceURI(uri);
  }, []);

  const unlockAudio = useCallback(() => {
    primeAudio();
    ttsRef.current!.unlock();
  }, []);

  const applyLLMConfig = useCallback((cfg: LLMConfig) => {
    saveLLMConfig(cfg);
    brainRef.current = createBrain();
    setBrainName(brainRef.current.name);
  }, []);

  const testVoice = useCallback(() => {
    ttsRef.current!.test(voiceURIRef.current);
  }, []);

  const ttsDiagnostics = useCallback((): TTSDiagnostics => ttsRef.current!.diagnostics(), []);

  const applyTTSConfig = useCallback((cfg: TTSConfig) => {
    saveTTSConfig(cfg);
    cancelSpeech();
    ttsRef.current = createTTS();
    const refresh = () => {
      const vi = ttsRef.current!.listVoices('vi');
      setVoices(vi.length ? vi : ttsRef.current!.listVoices());
      voiceURIRef.current = undefined;
      setVoiceURI(undefined);
    };
    refresh();
    window.setTimeout(refresh, 1500);
  }, [cancelSpeech]);

  const testBrain = useCallback(async (): Promise<string> => {
    try {
      const result = await brainRef.current!.reply('Chào em, em nghe rõ không?', []);
      return `OK — "${result.text.slice(0, 90)}"`;
    } catch (err) {
      return `LỖI: ${err instanceof Error ? err.message : String(err)}`;
    }
  }, []);

  const clearPendingListen = useCallback(() => {
    if (pendingListenRef.current != null) {
      clearTimeout(pendingListenRef.current);
      pendingListenRef.current = null;
    }
  }, []);

  const clearEndpointTimer = useCallback(() => {
    if (endpointTimerRef.current != null) {
      clearTimeout(endpointTimerRef.current);
      endpointTimerRef.current = null;
    }
  }, []);

  const schedulePendingListen = useCallback((delayMs: number, guard: () => boolean) => {
    clearPendingListen();
    pendingListenRef.current = window.setTimeout(() => {
      pendingListenRef.current = null;
      if (guard()) startListeningRef.current();
    }, delayMs);
  }, [clearPendingListen]);

  const scheduleThinkingSignals = useCallback((
    text: string,
    source: ConversationSource,
    token: number,
    wasInterrupted: boolean,
  ) => {
    clearThinkingSignals();
    const plan = planConversationTiming({
      input: text,
      source,
      turnIndex: token,
      previousLatencyMs: lastBrainLatencyRef.current,
      interrupted: wasInterrupted,
      recentCue: recentThinkingCueRef.current,
    });
    const stillThinking = () => turnSeqRef.current === token && stateRef.current === 'thinking';

    thinkingCaptionTimerRef.current = window.setTimeout(() => {
      thinkingCaptionTimerRef.current = null;
      if (!stillThinking()) return;
      setWho('MIRA');
      setPartial(false);
      setCaption(plan.captionText);
    }, plan.captionDelayMs);

    if (plan.audibleCue && plan.audibleCueDelayMs != null) {
      thinkingCueTimerRef.current = window.setTimeout(() => {
        thinkingCueTimerRef.current = null;
        if (!stillThinking()) return;
        recentThinkingCueRef.current = plan.audibleCue!;
        setWho('MIRA');
        setPartial(false);
        setCaption(plan.audibleCue!);
        speechQueueRef.current?.playCue({
          text: plan.audibleCue!,
          lang: LANG,
          rate: voicePrefs.rate,
          voiceURI: voiceURIRef.current,
          isActive: stillThinking,
        });
      }, plan.audibleCueDelayMs);
    }

    if (plan.longWaitCaption && plan.longWaitDelayMs != null) {
      thinkingLongTimerRef.current = window.setTimeout(() => {
        thinkingLongTimerRef.current = null;
        if (!stillThinking()) return;
        setWho('MIRA');
        setPartial(false);
        setCaption(plan.longWaitCaption!);
      }, plan.longWaitDelayMs);
    }
  }, [clearThinkingSignals]);

  const goIdle = useCallback((message?: string) => {
    clearPendingListen();
    clearEndpointTimer();
    clearThinkingSignals();
    stopMicLevel();
    setMoodBoth('neutral');
    sendEvent('RESET');
    setWho('CHẠM ĐỂ NÓI');
    setPartial(false);
    if (message) setCaption(message);
  }, [clearEndpointTimer, clearPendingListen, clearThinkingSignals, sendEvent, setMoodBoth]);

  const restartListenSoon = useCallback((responseText: string) => {
    schedulePendingListen(resumeListeningDelayMs(responseText), () => liveRef.current);
  }, [schedulePendingListen]);

  const speak = useCallback((text: string) => {
    clearThinkingSignals();
    sttRef.current!.abort();
    clearEndpointTimer();
    stopMicLevel();
    setWho('MIRA');
    setPartial(false);
    setCaption(text);
    sendEvent('SPEAK');

    speechQueueRef.current!.play({
      text,
      lang: LANG,
      rate: voicePrefs.rate,
      voiceURI: voiceURIRef.current,
      isActive: () => stateRef.current === 'speaking',
      onDone: () => {
        if (stateRef.current !== 'speaking') return;
        sendEvent('TTS_DONE');
        if (liveRef.current) {
          restartListenSoon(text);
        } else {
          setMoodBoth('neutral');
          setWho('CHẠM ĐỂ NÓI');
          setPartial(false);
          setCaption(IDLE_CAPTION);
        }
      },
    });
  }, [clearEndpointTimer, clearThinkingSignals, restartListenSoon, sendEvent, setMoodBoth]);

  const handleUtterance = useCallback(async (rawText: string, source: ConversationSource = 'voice') => {
    const text = rawText.trim();
    if (!text) return;

    emptyCountRef.current = 0;
    stopMicLevel();
    const token = ++turnSeqRef.current;
    const wasInterrupted = interruptedTurnRef.current;
    interruptedTurnRef.current = false;
    const prior = historyRef.current;
    pushHistory({ role: 'user', text });

    setError(null);
    setWho('MIRA');
    setPartial(false);
    setCaption('Đang suy nghĩ…');
    setMoodBoth('thinking');
    sendEvent(source === 'voice' ? 'STT_FINAL' : 'TEXT_SUBMIT');
    scheduleThinkingSignals(text, source, token, wasInterrupted);

    try {
      const result = await turnManagerRef.current!.run(text, prior, (skillResult) => {
        if (turnSeqRef.current === token && skillResult.content) setContent(skillResult.content);
      });
      if (turnSeqRef.current !== token || stateRef.current !== 'thinking') return;

      clearThinkingSignals();
      lastBrainLatencyRef.current = result.latencyMs;
      setLatencyMs(result.latencyMs);
      setMoodBoth(result.reply.mood || 'neutral');
      pushHistory({ role: 'mira', text: result.reply.text });
      speak(result.reply.text);
    } catch (err) {
      clearThinkingSignals();
      if (turnSeqRef.current !== token) return;
      const message = err instanceof Error ? err.message : String(err);
      console.error('[Mira Brain] reply failed:', err);
      setError(`Bộ não lỗi: ${message.slice(0, 160)}`);
      if (stateRef.current === 'thinking') {
        speak('Xin lỗi anh, bộ não của em đang trục trặc. Anh thử lại giúp em nhé.');
      }
    }
  }, [clearThinkingSignals, pushHistory, scheduleThinkingSignals, sendEvent, setMoodBoth, speak]);

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
      schedulePendingListen(silenceRetryDelayMs(emptyCountRef.current), () => liveRef.current);
    }
  }, [cancelSpeech, goIdle, schedulePendingListen, setLive]);

  const startListening = useCallback(() => {
    const stt = sttRef.current!;
    turnSeqRef.current += 1;
    clearPendingListen();
    clearEndpointTimer();
    const smart = loadSmartTurn() && stt.available;
    ttsRef.current!.unlock();
    cancelSpeech();
    setError(null);
    pendingTranscriptRef.current = '';

    if (!stt.available) {
      sendEvent('FAIL');
      setLive(false);
      setError('Trình duyệt không hỗ trợ nhận giọng nói. Hãy mở bằng Chrome hoặc Edge.');
      return;
    }

    setWho('BẠN ĐANG NÓI');
    setPartial(true);
    setCaption('Đang nghe…');
    sendEvent('MIC_START');
    void startMicLevel();

    stt.start({
      lang: LANG,
      continuous: smart,
      onResult: (result) => {
        pendingTranscriptRef.current = result.transcript;
        setCaption(result.transcript || 'Đang nghe…');
        setPartial(!result.isFinal);

        if (smart) {
          clearEndpointTimer();
          const delay = result.isFinal ? computeEndpointDelay(result.transcript) : ENDPOINT.trailing;
          endpointTimerRef.current = window.setTimeout(() => {
            endpointTimerRef.current = null;
            if (stateRef.current !== 'listening') return;
            const text = pendingTranscriptRef.current.trim();
            stt.abort();
            if (text) void handleUtterance(text, 'voice');
            else handleEmptyListen();
          }, delay);
        } else if (result.isFinal && result.transcript) {
          void handleUtterance(result.transcript, 'voice');
        }
      },
      onError: (err) => {
        if (err === 'aborted' || err === 'no-speech') return;
        if (err === 'not-allowed' || err === 'service-not-allowed') {
          setLive(false);
          sendEvent('FAIL');
          setError('Mic bị chặn. Cho phép quyền micro cho trang này rồi thử lại nhé.');
          return;
        }
        if (err === 'network') {
          setLive(false);
          sendEvent('FAIL');
          setError('Mất kết nối khi nhận giọng nói.');
          return;
        }
        setLive(false);
        goIdle();
      },
      onEnd: () => {
        if (stateRef.current !== 'listening') return;
        clearEndpointTimer();
        const pending = pendingTranscriptRef.current.trim();
        if (pending) void handleUtterance(pending, 'voice');
        else handleEmptyListen();
      },
    });
  }, [cancelSpeech, clearEndpointTimer, clearPendingListen, goIdle, handleEmptyListen, handleUtterance, sendEvent, setLive]);

  useEffect(() => {
    startListeningRef.current = startListening;
  }, [startListening]);

  const stopListening = useCallback(() => {
    sttRef.current!.abort();
    sendEvent('MIC_STOP');
    goIdle(IDLE_CAPTION);
  }, [goIdle, sendEvent]);

  const interrupt = useCallback(() => {
    turnSeqRef.current += 1;
    interruptedTurnRef.current = true;
    cancelSpeech();
    sttRef.current!.abort();
    clearEndpointTimer();
    stopMicLevel();
    sendEvent('INTERRUPT');
    setWho('MIRA');
    setPartial(false);
    setCaption('— Được, em nghe đây.');
    schedulePendingListen(interruptionRecoveryDelayMs(), () => stateRef.current === 'interrupted');
  }, [cancelSpeech, clearEndpointTimer, schedulePendingListen, sendEvent]);

  const startLive = useCallback(() => {
    setLive(true);
    emptyCountRef.current = 0;
    ttsRef.current!.unlock();

    if (loadVadEnabled()) {
      if (!vadRef.current) {
        const vad = new SileroVAD();
        vadRef.current = vad;
        void vad.init({
          onSpeechStart: () => {
            if (stateRef.current === 'speaking') interrupt();
          },
        }).then((ok) => {
          if (ok && liveRef.current) vad.start();
        });
      } else {
        vadRef.current.start();
      }
    }

    startListening();
  }, [interrupt, setLive, startListening]);

  const stopLive = useCallback(() => {
    turnSeqRef.current += 1;
    interruptedTurnRef.current = false;
    setLive(false);
    vadRef.current?.pause();
    cancelSpeech();
    sttRef.current!.abort();
    goIdle('Đã dừng trò chuyện. Chạm để nói hoặc nhập tin nhắn khi anh cần.');
  }, [cancelSpeech, goIdle, setLive]);

  const toggleLive = useCallback(() => {
    if (liveRef.current) stopLive();
    else startLive();
  }, [startLive, stopLive]);

  const toggleMic = useCallback(() => {
    const current = stateRef.current;
    if (liveRef.current) {
      if (current === 'idle') startListening();
      else interrupt();
      return;
    }

    if (current === 'speaking' || current === 'thinking') interrupt();
    else if (current === 'listening') stopListening();
    else startListening();
  }, [interrupt, startListening, stopListening]);

  const sendText = useCallback((rawText: string) => {
    const text = rawText.trim();
    if (!text) return;

    turnSeqRef.current += 1;
    interruptedTurnRef.current = false;
    setLive(false);
    vadRef.current?.pause();
    clearPendingListen();
    clearEndpointTimer();
    cancelSpeech();
    sttRef.current!.abort();
    void handleUtterance(text, 'text');
  }, [cancelSpeech, clearEndpointTimer, clearPendingListen, handleUtterance, setLive]);

  const demoGo = useCallback((next: MiraState, speakIt = false) => {
    turnSeqRef.current += 1;
    interruptedTurnRef.current = false;
    setLive(false);
    clearPendingListen();
    clearEndpointTimer();
    stopMicLevel();
    ttsRef.current!.unlock();
    cancelSpeech();
    sttRef.current!.abort();

    const copy = DEMO_COPY[next];
    setWho(copy.who);
    setPartial(false);
    setCaption(copy.txt);
    forceState(next);

    if (speakIt && next === 'speaking') {
      ttsRef.current!.speak({ text: copy.txt, lang: LANG, voiceURI: voiceURIRef.current });
    }
  }, [cancelSpeech, clearEndpointTimer, clearPendingListen, forceState, setLive]);

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
    sendText,
    demoGo,
    say: speak,
    content,
    clearContent: () => setContent(null),
  };
}

export type UseMira = ReturnType<typeof useMira>;
