import { useCallback, useEffect, useRef, useState } from 'react';
import type { MiraState } from '../types';
import type { LivePhase, LiveSession, LiveTurn } from './live-session';

// Thin hook: the heavy session module is imported only when the user starts Live,
// keeping the AppV2 boot graph inside its bundle budget.

const PHASE_STATE: Record<LivePhase, MiraState> = {
  connecting: 'thinking',
  listening: 'listening',
  speaking: 'speaking',
  interrupted: 'interrupted',
  closed: 'idle',
  error: 'error',
};

/** Created synchronously in the tap handler: iOS Safari leaves contexts made after an await suspended. */
function unlockedAudioContext(): AudioContext | undefined {
  try {
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return undefined;
    const ctx = new Ctor();
    if (ctx.state === 'suspended') void ctx.resume().catch(() => undefined);
    return ctx;
  } catch {
    return undefined;
  }
}

export interface LiveConversationDeps {
  persona: () => string;
  adultConfirmed: () => boolean;
  recallContext: () => Promise<string>;
  recordTurn: (turn: LiveTurn) => void;
  onUserFinal?: (text: string) => void;
}

export function useLiveConversation(deps: LiveConversationDeps) {
  const sessionRef = useRef<LiveSession | null>(null);
  const depsRef = useRef(deps);
  depsRef.current = deps;
  const [active, setActive] = useState(false);
  const [state, setState] = useState<MiraState>('idle');
  const [caption, setCaption] = useState('');
  const [who, setWho] = useState('MIRA LIVE');
  const [error, setError] = useState<string | null>(null);
  // E4 telemetry: numbers only, session-local, never sent anywhere.
  const latencySamplesRef = useRef<number[]>([]);
  const [latency, setLatency] = useState<{ p50: number; n: number } | null>(null);

  const stop = useCallback(() => {
    sessionRef.current?.stop();
    sessionRef.current = null;
    setActive(false);
    setState('idle');
  }, []);

  const start = useCallback(async () => {
    if (sessionRef.current) return;
    const audioContext = unlockedAudioContext();
    let handedOver = false;
    setError(null);
    setActive(true);
    setState('thinking');
    setWho('MIRA LIVE');
    setCaption('Đang kết nối Mira Live…');
    try {
      const [{ LiveSession: Session }, context] = await Promise.all([
        import('./live-session'),
        depsRef.current.recallContext().catch(() => ''),
      ]);
      const session = new Session({
        persona: depsRef.current.persona(),
        adultConfirmed: depsRef.current.adultConfirmed(),
        context,
        onPhase: (phase) => {
          setState(PHASE_STATE[phase]);
          if (phase === 'listening') { setWho('ĐANG NGHE'); setCaption((current) => current === 'Đang kết nối Mira Live…' ? 'Em đang nghe — anh cứ nói tự nhiên.' : current); }
          if (phase === 'closed' || phase === 'error') { sessionRef.current = null; setActive(false); }
        },
        onUserText: (text, final) => {
          setWho('ANH');
          setCaption(text);
          if (final) depsRef.current.onUserFinal?.(text);
        },
        onMiraText: (text) => { setWho('MIRA'); setCaption(text); },
        onTurn: (turn) => depsRef.current.recordTurn(turn),
        onError: (message) => setError(message),
        onLatency: (ms) => {
          const samples = [...latencySamplesRef.current, ms].slice(-30);
          latencySamplesRef.current = samples;
          const sorted = [...samples].sort((a, b) => a - b);
          setLatency({ p50: sorted[Math.floor((sorted.length - 1) / 2)], n: samples.length });
        },
        audioContext,
      });
      handedOver = true;
      sessionRef.current = session;
      await session.start();
    } catch {
      if (!handedOver) void audioContext?.close().catch(() => undefined);
      setError('Mira Live chưa tải được. Anh thử lại sau nhé.');
      stop();
    }
  }, [stop]);

  const sendText = useCallback((text: string) => {
    if (!sessionRef.current) return;
    sessionRef.current.sendText(text);
    // Typed input never appears in the audio transcription stream, so record it here.
    depsRef.current.recordTurn({ role: 'user', text });
    depsRef.current.onUserFinal?.(text);
    setWho('ANH');
    setCaption(text);
  }, []);

  useEffect(() => () => { sessionRef.current?.stop(); sessionRef.current = null; }, []);

  return { active, state, caption, who, error, latency, start, stop, sendText };
}
