import type { MiraState } from '../core/types';

export type ConversationEvent =
  | 'MIC_START'
  | 'MIC_STOP'
  | 'STT_FINAL'
  | 'BRAIN_DONE'
  | 'TTS_DONE'
  | 'INTERRUPT'
  | 'FAIL'
  | 'RESET';

export const transitions: Record<MiraState, Partial<Record<ConversationEvent, MiraState>>> = {
  idle: {
    MIC_START: 'listening',
    FAIL: 'error',
    RESET: 'idle',
  },
  listening: {
    MIC_STOP: 'idle',
    STT_FINAL: 'thinking',
    FAIL: 'error',
    RESET: 'idle',
  },
  thinking: {
    BRAIN_DONE: 'speaking',
    INTERRUPT: 'idle',
    FAIL: 'error',
    RESET: 'idle',
  },
  speaking: {
    TTS_DONE: 'idle',
    INTERRUPT: 'interrupted',
    MIC_START: 'listening',
    FAIL: 'error',
    RESET: 'idle',
  },
  interrupted: {
    MIC_START: 'listening',
    RESET: 'idle',
    FAIL: 'error',
  },
  error: {
    MIC_START: 'listening',
    RESET: 'idle',
  },
};

/**
 * Pure state transition used by the voice runtime and tests.
 * Returning the current state for an unsupported event keeps the machine deterministic
 * without throwing inside browser audio callbacks.
 */
export function transition(from: MiraState, event: ConversationEvent): MiraState {
  return transitions[from]?.[event] ?? from;
}

export function canTransition(from: MiraState, to: MiraState): boolean {
  if (from === to) return true;
  return Object.values(transitions[from] ?? {}).includes(to);
}

export function assertTransition(from: MiraState, to: MiraState): void {
  if (!canTransition(from, to)) {
    throw new Error(`Invalid Mira transition: ${from} -> ${to}`);
  }
}
