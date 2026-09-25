export type ObservedExpression = 'happy' | 'sad' | 'tired' | 'angry' | 'surprised' | 'neutral';
export type FaceControlAction = 'none' | 'listen' | 'interrupt';

export interface AffectSignalInput {
  faceSeen: boolean;
  mood: ObservedExpression;
  confidence: number;
  faceChannel: number;
}

export interface AffectSignalPresentation {
  label: string;
  ready: boolean;
  tone: 'neutral' | 'positive' | 'quiet' | 'tense' | 'open';
}

const LABELS: Record<ObservedExpression, string> = {
  happy: 'Tín hiệu tích cực',
  sad: 'Tín hiệu trầm',
  tired: 'Hoạt động thấp',
  angry: 'Tín hiệu căng',
  surprised: 'Phản ứng mở',
  neutral: 'Trung tính',
};

export function describeAffectSignal(input: AffectSignalInput): AffectSignalPresentation {
  if (!input.faceSeen) return { label: 'Đang tìm khuôn mặt', ready: false, tone: 'neutral' };

  const confidence = Math.max(0, Math.min(1, Number(input.confidence) || 0));
  const faceChannel = Math.max(0, Math.min(1, Number(input.faceChannel) || 0));
  const ready = input.mood === 'neutral'
    ? faceChannel >= 0.18
    : confidence >= 0.42;

  if (!ready) return { label: 'Đang đọc biểu cảm', ready: false, tone: 'neutral' };

  const tone: AffectSignalPresentation['tone'] =
    input.mood === 'happy' ? 'positive'
      : input.mood === 'sad' || input.mood === 'tired' ? 'quiet'
        : input.mood === 'angry' ? 'tense'
          : input.mood === 'surprised' ? 'open'
            : 'neutral';

  return { label: LABELS[input.mood], ready: true, tone };
}

export interface FaceControlInput {
  faceSeen: boolean;
  faceConfidence: number;
  headGesture: string;
  state: string;
  voiceReady: boolean;
}

export function resolveFaceControlAction(input: FaceControlInput): FaceControlAction {
  if (!input.faceSeen || Number(input.faceConfidence || 0) < 0.55) return 'none';

  if (
    input.headGesture === 'shake' &&
    (input.state === 'speaking' || input.state === 'thinking')
  ) return 'interrupt';

  if (
    input.headGesture === 'nod' &&
    input.voiceReady &&
    (input.state === 'idle' || input.state === 'interrupted')
  ) return 'listen';

  return 'none';
}
