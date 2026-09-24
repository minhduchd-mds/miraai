export type ObservedMood = 'happy' | 'sad' | 'tired' | 'angry' | 'surprised' | 'neutral';

export interface FaceAffectSample {
  present?: boolean;
  smile?: number;
  frown?: number;
  browUp?: number;
  browDown?: number;
  jaw?: number;
  blinkL?: number;
  blinkR?: number;
  cheekSquint?: number;
  eyeWide?: number;
  mouthPress?: number;
}

export interface AffectState {
  mood: ObservedMood;
  confidence: number;
  speechRate: number;
  visualEnergy: number;
  promptContext: string;
  metrics: {
    positive: number;
    negative: number;
    fatigue: number;
    surprise: number;
    tension: number;
  };
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

export function neutralAffect(): AffectState {
  return {
    mood: 'neutral',
    confidence: 0,
    speechRate: 1,
    visualEnergy: 0.5,
    promptContext: 'Camera hiện không cho thấy tín hiệu biểu cảm đủ rõ. Không suy diễn cảm xúc của người dùng.',
    metrics: { positive: 0, negative: 0, fatigue: 0, surprise: 0, tension: 0 },
  };
}

export function inferAffect(sample: FaceAffectSample): AffectState {
  if (!sample.present) return neutralAffect();

  const smile = clamp01(sample.smile || 0);
  const frown = clamp01(sample.frown || 0);
  const browUp = clamp01(sample.browUp || 0);
  const browDown = clamp01(sample.browDown || 0);
  const jaw = clamp01(sample.jaw || 0);
  const blink = clamp01(((sample.blinkL || 0) + (sample.blinkR || 0)) / 2);
  const cheek = clamp01(sample.cheekSquint || 0);
  const eyeWide = clamp01(sample.eyeWide || 0);
  const mouthPress = clamp01(sample.mouthPress || 0);

  const scores: Record<Exclude<ObservedMood, 'neutral'>, number> = {
    happy: clamp01(smile * 0.84 + cheek * 0.2),
    sad: clamp01(frown * 0.72 + browUp * 0.16 + (1 - smile) * 0.06),
    tired: clamp01(blink * 0.55 + jaw * 0.12 + (1 - eyeWide) * 0.08 + (1 - smile) * 0.05),
    angry: clamp01(browDown * 0.58 + mouthPress * 0.24 + cheek * 0.08),
    surprised: clamp01(jaw * 0.5 + browUp * 0.3 + eyeWide * 0.24),
  };

  const ranked = Object.entries(scores).sort((a, b) => b[1] - a[1]) as [
    Exclude<ObservedMood, 'neutral'>,
    number,
  ][];
  const [winner, top] = ranked[0];
  const second = ranked[1]?.[1] || 0;
  const confidence = clamp01(top * 0.82 + Math.max(0, top - second) * 0.42);

  if (top < 0.28 || confidence < 0.26) return neutralAffect();

  const config: Record<
    Exclude<ObservedMood, 'neutral'>,
    Pick<AffectState, 'speechRate' | 'visualEnergy' | 'promptContext'>
  > = {
    happy: {
      speechRate: 1.02,
      visualEnergy: 0.76,
      promptContext: 'Camera ước lượng người dùng đang cười hoặc có biểu cảm tích cực. Đây chỉ là tín hiệu hình ảnh; có thể phản hồi ấm và sáng hơn, không khẳng định cảm xúc.',
    },
    sad: {
      speechRate: 0.92,
      visualEnergy: 0.34,
      promptContext: 'Camera ước lượng nét mặt người dùng đang trầm xuống. Đây chỉ là tín hiệu biểu cảm, không phải chẩn đoán; ưu tiên giọng nhẹ, rõ, không suy diễn nguyên nhân.',
    },
    tired: {
      speechRate: 0.9,
      visualEnergy: 0.28,
      promptContext: 'Camera ước lượng biểu cảm có dấu hiệu mệt hoặc mắt khép lâu. Đây chỉ là ước lượng; nói ngắn hơn, chậm hơn và tránh làm phiền.',
    },
    angry: {
      speechRate: 0.94,
      visualEnergy: 0.42,
      promptContext: 'Camera ước lượng biểu cảm đang căng. Không gán nhãn cảm xúc như sự thật; nói gọn, bình tĩnh và tránh lời lẽ kích thích.',
    },
    surprised: {
      speechRate: 0.99,
      visualEnergy: 0.68,
      promptContext: 'Camera ước lượng biểu cảm bất ngờ. Đây chỉ là tín hiệu hình ảnh; có thể xác nhận ngắn trước khi tiếp tục.',
    },
  };

  return {
    mood: winner,
    confidence,
    ...config[winner],
    metrics: {
      positive: scores.happy,
      negative: scores.sad,
      fatigue: scores.tired,
      surprise: scores.surprised,
      tension: scores.angry,
    },
  };
}

export class AffectTracker {
  private current = neutralAffect();
  private candidate: ObservedMood = 'neutral';
  private candidateSince = 0;

  update(sample: FaceAffectSample, now = performance.now()): AffectState {
    const raw = inferAffect(sample);
    if (raw.mood !== this.candidate) {
      this.candidate = raw.mood;
      this.candidateSince = now;
    }

    const requiredStableMs =
      raw.mood === 'tired'
        ? 2200
        : raw.mood === 'sad' || raw.mood === 'angry'
          ? 1300
          : raw.mood === 'neutral'
            ? 700
            : 650;

    if (raw.mood === this.current.mood) {
      this.current = {
        ...raw,
        confidence: this.current.confidence * 0.62 + raw.confidence * 0.38,
      };
    } else if (now - this.candidateSince >= requiredStableMs && raw.confidence >= 0.42) {
      this.current = raw;
    } else if (!sample.present) {
      this.current = neutralAffect();
    }
    return this.current;
  }
}
