export type ConversationSource = 'voice' | 'text';

export interface ConversationTimingInput {
  input: string;
  source: ConversationSource;
  turnIndex: number;
  previousLatencyMs?: number | null;
  interrupted?: boolean;
  recentCue?: string;
}

export interface ConversationTimingPlan {
  captionDelayMs: number;
  captionText: string;
  audibleCueDelayMs: number | null;
  audibleCue: string | null;
  longWaitDelayMs: number | null;
  longWaitCaption: string | null;
}

const SHORT_ACK_RE = /^(?:ừ+|ừm+|uhm+|vâng|dạ|ok|okay|được|rồi|thôi|cảm ơn|thanks|yes|no|có|không)[.!?…\s]*$/iu;
const SENSITIVE_RE = /(buồn|mệt|đau|sợ|lo lắng|căng thẳng|xin lỗi|mất mát|qua đời|bệnh|sức khỏe)/iu;
const TECHNICAL_RE = /(code|build|api|ui|ux|database|backend|frontend|github|vercel|figma|playwright|repo|bug|lỗi|kiến trúc|architecture|deploy|test|ci|cd)/iu;
const DELIBERATE_RE = /(so sánh|đánh giá|phân tích|cân nhắc|theo em|nên chọn|phương án|tại sao|vì sao|giải thích|nghiên cứu|review)/iu;
const LOOKUP_RE = /(kiểm tra|check|xem lại|tìm|tra|thống kê|đọc repo|soi|tổng hợp|nguồn|dữ liệu)/iu;
const COMPLEX_RE = /(chi tiết|toàn bộ|hoàn chỉnh|kiến trúc|phân tích|đánh giá|nghiên cứu|so sánh|nâng cấp|tổng hợp|luồng|workflow)/iu;

const CUES = {
  technical: ['Vâng, em đang xem.', 'Để em kiểm tra chỗ này.', 'Ừm… em đang xem.'],
  deliberate: ['Ừm… để em cân nhắc.', 'Để em nghĩ chỗ này một chút.', 'Ừm… em đang cân nhắc.'],
  lookup: ['Để em xem.', 'Vâng, em đang kiểm tra.', 'Em đang xem chỗ này.'],
  neutral: ['Ừm…', 'Vâng.', 'Để em xem một chút.'],
} as const;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function stableHash(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function cueFamily(input: string): keyof typeof CUES {
  if (TECHNICAL_RE.test(input)) return 'technical';
  if (DELIBERATE_RE.test(input)) return 'deliberate';
  if (LOOKUP_RE.test(input)) return 'lookup';
  return 'neutral';
}

export function chooseThinkingCue(input: string, turnIndex: number, recentCue = ''): string {
  const family = CUES[cueFamily(input)];
  let index = (stableHash(input) + Math.max(0, turnIndex)) % family.length;
  if (family[index] === recentCue && family.length > 1) index = (index + 1) % family.length;
  return family[index];
}

function shouldSpeakBackchannel(input: string, source: ConversationSource): boolean {
  const clean = input.trim();
  if (source !== 'voice') return false;
  if (clean.length < 8 || SHORT_ACK_RE.test(clean)) return false;
  // On emotionally sensitive turns, silence is usually more respectful than a synthetic filler.
  if (SENSITIVE_RE.test(clean)) return false;
  return true;
}

function predictedCueDelay(previousLatencyMs?: number | null): number {
  if (previousLatencyMs == null) return 1380;
  if (previousLatencyMs < 700) return 1850;
  if (previousLatencyMs < 1100) return 1580;
  if (previousLatencyMs < 1800) return 1280;
  if (previousLatencyMs < 2800) return 1020;
  return 880;
}

export function planConversationTiming(input: ConversationTimingInput): ConversationTimingPlan {
  const text = input.input.trim();
  const complex = COMPLEX_RE.test(text) || text.length > 90;
  const audible = shouldSpeakBackchannel(text, input.source);
  let audibleDelay = predictedCueDelay(input.previousLatencyMs);
  if (complex) audibleDelay -= 110;
  if (input.interrupted) audibleDelay += 260;
  audibleDelay = clamp(audibleDelay, 820, 2100);

  const family = cueFamily(text);
  const captionText = family === 'technical' || family === 'lookup'
    ? 'Em đang xem…'
    : family === 'deliberate'
      ? 'Em đang cân nhắc…'
      : 'Đang suy nghĩ…';

  const cue = audible ? chooseThinkingCue(text, input.turnIndex, input.recentCue) : null;
  const longWaitDelay = input.source === 'voice' && text.length >= 8
    ? Math.max(2450, audibleDelay + 1250)
    : null;
  const longWaitCaption = complex ? 'Em đang xem kỹ chỗ này…' : 'Em vẫn đang xử lý…';

  return {
    captionDelayMs: input.source === 'voice' ? (complex ? 360 : 460) : 520,
    captionText,
    audibleCueDelayMs: cue ? audibleDelay : null,
    audibleCue: cue,
    longWaitDelayMs: longWaitDelay,
    longWaitCaption: longWaitDelay ? longWaitCaption : null,
  };
}

/** Gap after Mira finishes before reopening the microphone in hands-free mode. */
export function resumeListeningDelayMs(responseText: string): number {
  const text = responseText.trim();
  if (!text) return 280;
  if (/\?\s*$/.test(text)) return 180;
  if (text.length < 56) return 250;
  if (SENSITIVE_RE.test(text) || /(cảnh báo|nghiêm trọng|rủi ro|không nên)/iu.test(text)) return 460;
  return 340;
}

/** Barge-in should feel immediate; the visual acknowledgement itself is enough. */
export function interruptionRecoveryDelayMs(): number {
  return 150;
}

/** Avoid a rigid retry cadence during hands-free silence. */
export function silenceRetryDelayMs(emptyCount: number): number {
  return clamp(320 + Math.max(0, emptyCount - 1) * 70, 320, 620);
}
