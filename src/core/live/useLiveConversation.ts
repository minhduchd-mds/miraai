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

  const stop = useCallback(() => {
    sessionRef.current?.stop();
    sessionRef.current = null;
    setActive(false);
    setState('idle');
  }, []);

  const start = useCallback(async () => {
    if (sessionRef.current) return;
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
      });
      sessionRef.current = session;
      await session.start();
    } catch {
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

  return { active, state, caption, who, error, start, stop, sendText };
}
