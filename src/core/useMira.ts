import { useCallback, useEffect, useRef, useState } from 'react';
import type { BrainTurn, MiraState, Mood, TranscriptTurn, VoiceOption } from './types';
import type { Content } from './content';
import { WebSpeechSTT } from './stt/webspeech-stt';
import { startMicLevel, stopMicLevel, primeAudio } from './audio-level';
import { voicePrefs, loadVoicePrefs } from './voice-prefs';
import { SileroVAD } from './vad/silero-vad';
import { loadVadEnabled } from './vad/config';
import { loadSmartTurn } from './stt/turn-config';
import { computeEndpointDelay, computeStableFinalEndpointDelay, ENDPOINT } from './stt/endpointer';
import { createTTS, type MiraTTS, type TTSDiagnostics } from './tts';
import { createBrain, saveLLMConfig, type LLMConfig } from './brain';
import { brainFailureMessage } from './brain/brain-failure';
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
import { ResponseLatencyWindow, type ResponseLatencySnapshot } from '../runtime/response-latency';
import { MemoryService } from '../intelligence/memory/memory-service';
import { createDefaultSkillRegistry } from '../intelligence/skills';
import { getHostBridge } from '../host';
import { neutralAffect, type AffectState } from '../intelligence/affect/mood-engine';
import { ProactiveEngine } from '../intelligence/proactive/proactive-engine';
import { crisisReply, isHighRiskText } from '../intelligence/safety/crisis-client';

const LANG = 'vi-VN';
const IDLE_CAPTION = 'Chạm mic để nói, hoặc gõ tin nhắn bên dưới.';
const MAX_EMPTY_BACKOFF = 6;
// Hands-free mode stops itself after this many consecutive empty listens (~1 min of silence):
// an open mic nobody uses costs battery and privacy (voice QA 24/10).
const SILENCE_AUTO_STOP = 8;
const SILENCE_STOP_CAPTION = 'Em tạm dừng nghe vì mình im lặng một lúc. Chạm mic khi anh muốn nói tiếp nhé.';
/** STT sometimes returns pure noise/punctuation; never send that to the model. */
export function isMeaningfulTranscript(text: string): boolean {
  return /[\p{L}\p{N}]/u.test(text);
}

const DEMO_COPY: Record<MiraState, { who: string; txt: string }> = {
  idle: { who: 'CHẠM ĐỂ NÓI', txt: IDLE_CAPTION },
  listening: { who: 'BẠN ĐANG NÓI', txt: 'Mira, hôm nay em thấy thế nào?' },
  thinking: { who: 'MIRA', txt: 'Đang suy nghĩ…' },
  speaking: {
    who: 'MIRA',
    txt: 'Em ổn ạ, cảm ơn anh đã hỏi. Hôm nay của anh thế nào, có chuyện gì vui kể em nghe với?',
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
  // Final transcript -> first audible response. Local-only telemetry, no audio
  // recordings or utterance text persisted, and never confused with brain time.
  const [firstAudioLatencyMs, setFirstAudioLatencyMs] = useState<number | null>(null);
  const latencyWindowRef = useRef<ResponseLatencyWindow | null>(null);
  if (!latencyWindowRef.current) latencyWindowRef.current = new ResponseLatencyWindow(64);
  const [responseLatency, setResponseLatency] = useState<ResponseLatencySnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<BrainTurn[]>([]);
  const historyRef = useRef<BrainTurn[]>([]);
  // On-screen transcript for THIS session only (turns loaded from Memory are not replayed).
  // Without it a typed answer vanished as soon as speech ended or TTS failed (UI QA 24/10).
  const [transcript, setTranscript] = useState<TranscriptTurn[]>([]);
  const transcriptSeqRef = useRef(0);
  // The user text of the last turn that got no AI answer, so the UI can offer "Thử lại".
  const [retryText, setRetryText] = useState<string | null>(null);
  const [content, setContent] = useState<Content | null>(null);
  const [voices, setVoices] = useState<VoiceOption[]>([]);
  const [voiceURI, setVoiceURI] = useState<string | undefined>('');
  const voiceURIRef = useRef<string | undefined>('');
  const [brainName, setBrainName] = useState(() => brainRef.current!.name);

  const pendingTranscriptRef = useRef('');
  const lastInterimRef = useRef<{ transcript: string; atMs: number } | null>(null);
  const emptyCountRef = useRef(0);
  const silentStreakRef = useRef(0);
  const sttNetworkRetryRef = useRef(false);
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
  const affectRef = useRef<AffectState>(neutralAffect());
  const [observedMood, setObservedMood] = useState<AffectState['mood']>('neutral');
  // Crisis banner: set when a self-harm disclosure is detected, cleared only by the user.
  const [crisis, setCrisis] = useState(false);
  const proactiveRef = useRef(new ProactiveEngine());

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

  const pushHistory = useCallback((turn: BrainTurn, persist = true, failed = false) => {
    historyRef.current = [...historyRef.current, turn].slice(-12);
    setHistory(historyRef.current);
    const id = ++transcriptSeqRef.current;
    setTranscript((prev) => [...prev, { id, role: turn.role, text: turn.text, ...(failed ? { failed } : {}) }].slice(-30));
    // Crisis disclosures stay in the on-screen session only: never distilled into memory.
    if (persist) memoryRef.current!.save(turn);
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

  const observeAffect = useCallback((affect: AffectState) => {
    affectRef.current = affect;
    setObservedMood(affect.mood);
    proactiveRef.current.observeAffect(affect);
    memoryRef.current?.observeAffect(affect);
  }, []);


  const testBrain = useCallback(async (): Promise<string> => {
    try {
      const result = await brainRef.current!.reply('Chào em, em nghe rõ không?', []);
      if (result.runtimeSource === 'fallback') {
        return 'CHƯA KẾT NỐI MODEL — Mira đang trả lời dự phòng, không phải mô hình AI.';
      }
      if (result.runtimeSource !== 'provider' && result.runtimeSource !== 'local_model') {
        return 'CHƯA XÁC MINH — Không xác định được nguồn phản hồi từ model.';
      }
      return `OK MODEL (${result.provider || result.runtimeSource}) — "${result.text.slice(0, 90)}"`;
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

  const speak = useCallback((text: string, onFirstAudio?: () => void) => {
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
      rate: Math.max(0.72, Math.min(1.2, voicePrefs.rate * affectRef.current.speechRate)),
      voiceURI: voiceURIRef.current,
      isActive: () => stateRef.current === 'speaking',
      onFirstAudio,
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
    silentStreakRef.current = 0;
    setRetryText(null);
    proactiveRef.current.noteUserActivity();
    stopMicLevel();
    const token = ++turnSeqRef.current;
    const turnStartedAt = performance.now();
    setFirstAudioLatencyMs(null);
    const wasInterrupted = interruptedTurnRef.current;
    interruptedTurnRef.current = false;
    const prior = historyRef.current;
    const crisisTurn = await isHighRiskText(text);
    if (turnSeqRef.current !== token) return;
    pushHistory({ role: 'user', text }, !crisisTurn);

    // Deterministic safety net — works on every runtime (Web, Pages, Desktop) and never
    // depends on a model being reachable. Resources are also shown as a persistent banner.
    if (crisisTurn) {
      clearThinkingSignals();
      setCrisis(true);
      setError(null);
      const reply = await crisisReply();
      pushHistory({ role: 'mira', text: reply }, false);
      sendEvent(source === 'voice' ? 'STT_FINAL' : 'TEXT_SUBMIT');
      speak(reply);
      return;
    }

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
      }, affectRef.current.promptContext);
      if (turnSeqRef.current !== token || stateRef.current !== 'thinking') return;

      clearThinkingSignals();
      lastBrainLatencyRef.current = result.latencyMs;
      setLatencyMs(result.latencyMs);
      setMoodBoth(result.reply.mood || 'neutral');
      const noAnswer = result.reply.runtimeSource === 'fallback';
      if (noAnswer) {
        setError(brainFailureMessage(result.reply.failureCode));
        setRetryText(text);
      }
      // A fallback line is not a real answer: show it, but never distil it into Memory.
      pushHistory({ role: 'mira', text: result.reply.text }, !noAnswer, noAnswer);
      speak(result.reply.text, () => {
        if (turnSeqRef.current !== token) return;
        const firstAudioMs = Math.max(0, Math.round(performance.now() - turnStartedAt));
        setFirstAudioLatencyMs(firstAudioMs);
        if (result.timings) {
          latencyWindowRef.current?.record({
            ...result.timings,
            firstAudioMs,
            source: result.reply.runtimeSource || 'unknown',
          });
          setResponseLatency(latencyWindowRef.current?.snapshot() || null);
        }
      });
    } catch (err) {
      clearThinkingSignals();
      if (turnSeqRef.current !== token) return;
      // Raw provider/runtime errors go to the console only, never into the UI.
      console.error('[Mira Brain] reply failed:', err);
      setError(brainFailureMessage());
      setRetryText(text);
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

    emptyCountRef.current = Math.min(emptyCountRef.current + 1, MAX_EMPTY_BACKOFF);
    silentStreakRef.current += 1;
    if (silentStreakRef.current >= SILENCE_AUTO_STOP) {
      silentStreakRef.current = 0;
      setLive(false);
      vadRef.current?.pause();
      goIdle(SILENCE_STOP_CAPTION);
      return;
    }
    const proactive = proactiveRef.current.nextForSilence(affectRef.current);
    if (proactive) {
      speak(proactive);
      return;
    }
    setWho('MIRA · 24/7');
    setPartial(false);
    setCaption('Em vẫn ở đây — anh cứ nói khi cần.');
    schedulePendingListen(silenceRetryDelayMs(emptyCountRef.current), () => liveRef.current);
  }, [goIdle, schedulePendingListen, setLive, speak]);

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
    lastInterimRef.current = null;

    if (!stt.available) {
      sendEvent('FAIL');
      setLive(false);
      setError('Trình duyệt này chưa nhận giọng nói. Anh bấm LIVE để nói chuyện trực tiếp, hoặc mở bằng Chrome/Edge.');
      return;
    }

    setWho('BẠN ĐANG NÓI');
    setPartial(true);
    setCaption('Đang nghe…');
    sendEvent('MIC_START');
    void startMicLevel();

    // A failed mic/STT start must not leave "Đang nghe…" on screen.
    const failMic = (message: string) => {
      setLive(false);
      sendEvent('FAIL');
      stopMicLevel();
      setWho('CHẠM ĐỂ NÓI');
      setPartial(false);
      setCaption(IDLE_CAPTION);
      setError(message);
    };

    stt.start({
      lang: LANG,
      continuous: smart,
      onResult: (result) => {
        sttNetworkRetryRef.current = false;
        pendingTranscriptRef.current = result.transcript;
        const receivedAt = performance.now();
        if (!result.isFinal && lastInterimRef.current?.transcript !== result.transcript) {
          lastInterimRef.current = { transcript: result.transcript, atMs: receivedAt };
        }
        setCaption(result.transcript || 'Đang nghe…');
        setPartial(!result.isFinal);

        if (smart) {
          clearEndpointTimer();
          const delay = result.isFinal
            ? computeStableFinalEndpointDelay(result.transcript, lastInterimRef.current, receivedAt)
            : ENDPOINT.trailing;
          if (result.isFinal) lastInterimRef.current = null;
          endpointTimerRef.current = window.setTimeout(() => {
            endpointTimerRef.current = null;
            if (stateRef.current !== 'listening') return;
            const text = pendingTranscriptRef.current.trim();
            stt.abort();
            if (text && isMeaningfulTranscript(text)) void handleUtterance(text, 'voice');
            else handleEmptyListen();
          }, delay);
        } else if (result.isFinal && result.transcript) {
          if (isMeaningfulTranscript(result.transcript)) void handleUtterance(result.transcript, 'voice');
          else { stt.abort(); handleEmptyListen(); }
        }
      },
      onError: (err) => {
        if (err === 'aborted' || err === 'no-speech') return;
        if (err === 'not-allowed' || err === 'service-not-allowed') {
          failMic('Mic bị chặn. Cho phép quyền micro cho trang này rồi thử lại nhé.');
          return;
        }
        if (err === 'network') {
          // Browser STT runs on a cloud service: one quiet retry before giving up.
          if (liveRef.current && !sttNetworkRetryRef.current) {
            sttNetworkRetryRef.current = true;
            schedulePendingListen(1200, () => liveRef.current);
            return;
          }
          sttNetworkRetryRef.current = false;
          failMic('Mất kết nối khi nhận giọng nói. Kiểm tra mạng rồi chạm mic để thử lại.');
          return;
        }
        if (err === 'audio-capture') {
          failMic('Không tìm thấy micro. Cắm tai nghe/mic hoặc kiểm tra cài đặt âm thanh rồi thử lại.');
          return;
        }
        if (err === 'language-not-supported') {
          failMic('Trình duyệt này chưa nhận tiếng Việt. Anh bấm LIVE để nói chuyện trực tiếp nhé.');
          return;
        }
        setLive(false);
        goIdle();
      },
      onEnd: () => {
        if (stateRef.current !== 'listening') return;
        clearEndpointTimer();
        const pending = pendingTranscriptRef.current.trim();
        if (pending && isMeaningfulTranscript(pending)) void handleUtterance(pending, 'voice');
        else handleEmptyListen();
      },
    });
  }, [cancelSpeech, clearEndpointTimer, clearPendingListen, goIdle, handleEmptyListen, handleUtterance, schedulePendingListen, sendEvent, setLive]);

  /** Tab hidden / screen locked: stop the mic but keep hands-free armed; visibility resumes it. */
  const pauseForBackground = useCallback(() => {
    if (!liveRef.current || stateRef.current !== 'listening') return;
    turnSeqRef.current += 1;
    clearEndpointTimer();
    sttRef.current!.abort();
    sendEvent('MIC_STOP');
    goIdle('Đã tạm dừng nghe khi anh rời trang. Quay lại là em nghe tiếp.');
  }, [clearEndpointTimer, goIdle, sendEvent]);

  useEffect(() => {
    startListeningRef.current = startListening;
  }, [startListening]);

  const stopListening = useCallback(() => {
    sttRef.current!.abort();
    lastInterimRef.current = null;
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
    if (liveRef.current) {
      if (stateRef.current === 'idle' || stateRef.current === 'interrupted') startListening();
      return;
    }
    setLive(true);
    emptyCountRef.current = 0;
    silentStreakRef.current = 0;
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

  const notifyContextEvent = useCallback((kind: 'resume' | 'wake') => {
    const prompt = proactiveRef.current.nextContextPrompt(kind, affectRef.current);
    if (!prompt || !liveRef.current) return;
    if (stateRef.current === 'idle' || stateRef.current === 'listening' || stateRef.current === 'interrupted') {
      speak(prompt);
    }
  }, [speak]);

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

  /** Mira Live records its transcripts through the same history + Memory path. */
  const liveCrisisReplyRef = useRef(false);
  // Turns are processed strictly in arrival order (user before Mira) even though the
  // crisis check is async — otherwise a fast Mira turn could overtake its user turn.
  const recordQueueRef = useRef<Promise<void>>(Promise.resolve());
  const recordTurn = useCallback((turn: BrainTurn): Promise<void> => {
    const text = turn.text.trim();
    if (!text) return recordQueueRef.current;
    recordQueueRef.current = recordQueueRef.current.then(async () => {
      let persist = true;
      if (turn.role === 'user' && await isHighRiskText(text)) {
        setCrisis(true);
        liveCrisisReplyRef.current = true;
        persist = false;
      } else if (turn.role === 'mira' && liveCrisisReplyRef.current) {
        liveCrisisReplyRef.current = false;
        persist = false;
      }
      pushHistory({ role: turn.role, text }, persist);
    }).catch(() => undefined);
    return recordQueueRef.current;
  }, [pushHistory]);

  /** Bounded memory context for a Live session (sent to the server as data, not instructions). */
  const recallContext = useCallback(async (): Promise<string> => {
    const lastUser = [...historyRef.current].reverse().find((turn) => turn.role === 'user')?.text || '';
    try {
      const recalled = await memoryRef.current!.recall(lastUser);
      return String(recalled || '').slice(0, 2400);
    } catch {
      return '';
    }
  }, []);

  /** Retry the last unanswered turn, replacing (not duplicating) the failed exchange on screen. */
  const retryLast = useCallback(() => {
    const last = retryText;
    if (!last) return;
    const h = historyRef.current;
    if (h.length >= 2 && h[h.length - 1].role === 'mira' && h[h.length - 2].role === 'user' && h[h.length - 2].text === last) {
      historyRef.current = h.slice(0, -2);
      setHistory(historyRef.current);
    }
    setTranscript((prev) => {
      const n = prev.length;
      return n >= 2 && prev[n - 1].failed && prev[n - 2].role === 'user' && prev[n - 2].text === last ? prev.slice(0, -2) : prev;
    });
    setError(null);
    sendText(last);
  }, [retryText, sendText]);

  return {
    state,
    stateRef,
    crisis,
    flagCrisis: () => setCrisis(true),
    dismissCrisis: () => setCrisis(false),
    recordTurn,
    recallContext,
    live,
    mood,
    moodRef,
    caption,
    idleCaption: IDLE_CAPTION,
    who,
    partial,
    latencyMs,
    firstAudioLatencyMs,
    responseLatency,
    error,
    history,
    voices,
    voiceURI,
    selectVoice,
    unlockAudio,
    sttAvailable: sttRef.current!.available,
    ttsAvailable: ttsRef.current!.available,
    brainName,
    observedMood,
    observeAffect,
    notifyContextEvent,
    applyLLMConfig,
    testBrain,
    testVoice,
    ttsDiagnostics,
    toggleMic,
    toggleLive,
    startLive,
    stopLive,
    startListening,
    pauseForBackground,
    interrupt,
    sendText,
    transcript,
    retryText,
    retryLast,
    dismissError: () => setError(null),
    demoGo,
    say: speak,
    content,
    clearContent: () => setContent(null),
  };
}

export type UseMira = ReturnType<typeof useMira>;
