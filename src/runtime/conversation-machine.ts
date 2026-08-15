import type { MiraState } from '../core/types';

export type ConversationEvent =
  | 'MIC_START'
  | 'MIC_STOP'
  | 'STT_FINAL'
  | 'TEXT_SUBMIT'
  | 'BRAIN_DONE'
  | 'SPEAK'
  | 'TTS_DONE'
  | 'INTERRUPT'
  | 'FAIL'
  | 'RESET';

export const transitions: Record<MiraState, Partial<Record<ConversationEvent, MiraState>>> = {
  idle: {
    MIC_START: 'listening',
    TEXT_SUBMIT: 'thinking',
    SPEAK: 'speaking',
    FAIL: 'error',
    RESET: 'idle',
  },
  listening: {
    MIC_STOP: 'idle',
    STT_FINAL: 'thinking',
    TEXT_SUBMIT: 'thinking',
    SPEAK: 'speaking',
    FAIL: 'error',
    RESET: 'idle',
  },
  thinking: {
    MIC_START: 'listening',
    TEXT_SUBMIT: 'thinking',
    BRAIN_DONE: 'speaking',
    SPEAK: 'speaking',
    INTERRUPT: 'idle',
    FAIL: 'error',
    RESET: 'idle',
  },
  speaking: {
    MIC_START: 'listening',
    TEXT_SUBMIT: 'thinking',
    SPEAK: 'speaking',
    TTS_DONE: 'idle',
    INTERRUPT: 'interrupted',
    FAIL: 'error',
    RESET: 'idle',
  },
  interrupted: {
    MIC_START: 'listening',
    TEXT_SUBMIT: 'thinking',
    SPEAK: 'speaking',
    RESET: 'idle',
    FAIL: 'error',
  },
  error: {
    MIC_START: 'listening',
    TEXT_SUBMIT: 'thinking',
    SPEAK: 'speaking',
    RESET: 'idle',
  },
};

/** Pure state transition. Unsupported events are ignored instead of throwing inside audio callbacks. */
export function transition(from: MiraState, event: ConversationEvent): MiraState {
  return transitions[from]?.[event] ?? from;
}

export function canTransition(from: MiraState, to: MiraState): boolean {
  if (from === to) return true;
  return Object.values(transitions[from] ?? {}).includes(to);
}

export function assertTransition(from: MiraState, to: MiraState): void {
  if (!canTransition(from, to)) throw new Error(`Invalid Mira transition: ${from} -> ${to}`);
}
