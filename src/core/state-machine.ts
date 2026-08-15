// Backward-compatible export. Runtime ownership now lives in src/runtime/conversation-machine.ts
// so the state machine is no longer coupled to the legacy core folder.
export {
  transitions,
  transition,
  canTransition,
  assertTransition,
  type ConversationEvent,
} from '../runtime/conversation-machine';
