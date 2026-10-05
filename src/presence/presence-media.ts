export interface PresencePrefetchHints {
  saveData?: boolean;
  effectiveType?: string;
  hidden?: boolean;
}

export function shouldPrefetchPresenceAsset(hints: PresencePrefetchHints): boolean {
  if (hints.hidden) return false;
  if (hints.saveData) return false;
  const type = String(hints.effectiveType || '').toLowerCase();
  return type !== 'slow-2g' && type !== '2g';
}

export function shouldRenderExpressionReaction(input: {
  expression: string;
  state?: 'idle' | 'listening' | 'thinking' | 'speaking' | 'interrupted' | 'error';
  moodConfidence?: number;
  socialCue?: 'none' | 'wink_left' | 'wink_right' | 'brow_raise' | 'smile';
}): boolean {
  const expression = String(input.expression || '');
  const confidence = Math.max(0, Math.min(1, Number(input.moodConfidence) || 0));
  const cue = input.socialCue || 'none';

  if (cue !== 'none') return true;
  if (input.state === 'thinking') return true;
  if (expression === 'gentle' || expression === 'calm' || expression === 'sleepy') return false;
  return confidence >= 0.55;
}
