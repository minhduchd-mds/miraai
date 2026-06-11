import type { MiraState } from './types';

// Port từ §9 của MIRA-KIEN-TRUC.md, có bổ sung trạng thái 'error'
// (đề xuất #6 — state machine không chỉ có happy-path).
export const transitions: Record<MiraState, MiraState[]> = {
  idle: ['listening', 'error'],
  listening: ['thinking', 'idle', 'error'],
  thinking: ['speaking', 'idle', 'error'],
  speaking: ['interrupted', 'listening', 'idle', 'error'],
  interrupted: ['listening', 'idle'],
  error: ['idle', 'listening'],
};

export function canTransition(from: MiraState, to: MiraState): boolean {
  return from === to || transitions[from]?.includes(to) || false;
}
