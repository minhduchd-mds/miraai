export type ObservedMood = 'happy' | 'sad' | 'tired' | 'angry' | 'surprised' | 'neutral';

export interface VoiceAffectSample {
  energy?: number;
  activity?: number;
  silenceRatio?: number;
  pitchHz?: number;
  pitchVariability?: number;
  confidence?: number;
}

export interface PostureAffectSample {
  present?: boolean;
  confidence?: number;
  upright?: number;
  slump?: number;
  motion?: number;
  label?: string;
}

export interface PhysiologyAffectSample {
  quality?: number;
  relativeActivation?: number;
}

export interface MicroAffectSample {
  kind?: string;
  confidence?: number;
}

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
  gazeX?: number;
  gazeY?: number;
  actionUnits?: Partial<Record<string, number>>;
  voice?: VoiceAffectSample;
  posture?: PostureAffectSample;
  physiology?: PhysiologyAffectSample;
  microExpression?: MicroAffectSample;
}

export interface AffectDimensions {
  valence: number;
  arousal: number;
  engagement: number;
  fatigue: number;
  tension: number;
}

export interface AffectState {
  mood: ObservedMood;
  confidence: number;
  speechRate: number;
  visualEnergy: number;
  promptContext: string;
  dimensions: AffectDimensions;
  channels: {
    face: number;
    voice: number;
    posture: number;
    physiology: number;
    micro: number;
    baselineReady: number;
  };
  metrics: {
    positive: number;
    negative: number;
    fatigue: number;
    surprise: number;
    tension: number;
  };
}

interface BaselineState {
  count: number;
  means: Record<string, number>;
}

const BASELINE_KEY = 'mira.affect.baseline.v2';
const BASELINE_FEATURES = ['smile', 'frown', 'browUp', 'browDown', 'jaw', 'blink', 'cheek', 'eyeWide', 'mouthPress'] as const;

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}
function clampSigned(value: number): number {
  return Math.max(-1, Math.min(1, Number.isFinite(value) ? value : 0));
}
function au(sample: FaceAffectSample, name: string): number {
  return clamp01(Number(sample.actionUnits?.[name] || 0));
}
function neutralDimensions(): AffectDimensions {
  return { valence: 0, arousal: 0, engagement: 0, fatigue: 0, tension: 0 };
}

export function neutralAffect(): AffectState {
  return {
    mood: 'neutral',
    confidence: 0,
    speechRate: 1,
    visualEnergy: 0.5,
    promptContext: 'Camera hiện không cho thấy tín hiệu biểu cảm đủ rõ. Không suy diễn cảm xúc của người dùng.',
    dimensions: neutralDimensions(),
    channels: { face: 0, voice: 0, posture: 0, physiology: 0, micro: 0, baselineReady: 0 },
    metrics: { positive: 0, negative: 0, fatigue: 0, surprise: 0, tension: 0 },
  };
}

function weightedAverage(parts: Array<{ value: number; weight: number }>, fallback = 0): number {
  let sum = 0;
  let weight = 0;
  for (const part of parts) {
    const w = Math.max(0, Number(part.weight) || 0);
    if (!w) continue;
    sum += part.value * w;
    weight += w;
  }
  return weight > 0 ? sum / weight : fallback;
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
  const gazeMagnitude = clamp01(Math.hypot(sample.gazeX || 0, sample.gazeY || 0) / 0.75);

  const au01 = au(sample, 'AU01');
  const au04 = au(sample, 'AU04');
  const au05 = au(sample, 'AU05');
  const au06 = au(sample, 'AU06');
  const au07 = au(sample, 'AU07');
  const au12 = au(sample, 'AU12');
  const au15 = au(sample, 'AU15');
  const au23 = au(sample, 'AU23');
  const au26 = au(sample, 'AU26');
  const au45 = au(sample, 'AU45');

  const voiceEnergy = clamp01(sample.voice?.energy || 0);
  const voiceActivity = clamp01(sample.voice?.activity || 0);
  const voicePitchVar = clamp01(sample.voice?.pitchVariability || 0);
  const voiceConfidence = clamp01(sample.voice?.confidence || 0);

  const postureConfidence = sample.posture?.present ? clamp01(sample.posture?.confidence || 0) : 0;
  const postureUpright = clamp01(sample.posture?.upright || 0);
  const postureSlump = clamp01(sample.posture?.slump || 0);
  const postureMotion = clamp01(sample.posture?.motion || 0);

  const physiologyQuality = clamp01(sample.physiology?.quality || 0);
  const physiologyActivation = clampSigned(sample.physiology?.relativeActivation || 0);

  const microConfidence = clamp01(sample.microExpression?.confidence || 0);
  const microKind = String(sample.microExpression?.kind || 'none');

  let happy = clamp01(smile * 0.58 + au12 * 0.24 + Math.max(cheek, au06) * 0.2);
  let sad = clamp01(frown * 0.48 + au15 * 0.3 + Math.max(browUp, au01) * 0.1 + (1 - smile) * 0.05);
  let tired = clamp01(
    Math.max(blink, au45) * 0.42 +
    (1 - eyeWide) * 0.11 +
    (1 - voiceActivity) * voiceConfidence * 0.08 +
    postureSlump * postureConfidence * 0.12,
  );
  let angry = clamp01(
    Math.max(browDown, au04) * 0.46 +
    Math.max(mouthPress, au23) * 0.24 +
    Math.max(cheek, au07) * 0.1,
  );
  let surprised = clamp01(Math.max(jaw, au26) * 0.4 + Math.max(browUp, au01) * 0.22 + Math.max(eyeWide, au05) * 0.24);

  // Micro-expression events are low-weight nudges and can never determine a label alone.
  if (microKind === 'smile_flash') happy = clamp01(happy + microConfidence * 0.08);
  if (microKind === 'tension_flash' || microKind === 'lip_press_flash') angry = clamp01(angry + microConfidence * 0.07);
  if (microKind === 'surprise_flash' || microKind === 'brow_flash') surprised = clamp01(surprised + microConfidence * 0.07);
  if (microKind === 'blink_burst') tired = clamp01(tired + microConfidence * 0.05);

  const positive = happy;
  const negative = sad;
  const tension = angry;
  const fatigue = tired;
  const surprise = surprised;

  const acousticArousal = clamp01(voiceEnergy * 0.58 + voiceActivity * 0.24 + voicePitchVar * 0.18);
  const faceArousal = clamp01(Math.max(surprise, tension) * 0.7 + eyeWide * 0.16 + jaw * 0.14);
  // Only above-baseline pulse activation can add a small arousal cue; neutral baseline contributes zero.
  const physiologyArousal = clamp01(Math.max(0, physiologyActivation));

  const arousal = clamp01(weightedAverage([
    { value: faceArousal, weight: 0.72 },
    { value: acousticArousal, weight: 0.22 * voiceConfidence },
    { value: physiologyArousal, weight: physiologyQuality >= 0.5 ? 0.06 * physiologyQuality : 0 },
  ], faceArousal));

  const valence = clampSigned(positive - Math.max(negative, tension * 0.78));
  const faceEngagement = clamp01(0.54 + (1 - gazeMagnitude) * 0.32 + eyeWide * 0.08 + smile * 0.06);
  const postureEngagement = clamp01(postureUpright * 0.7 + (1 - postureSlump) * 0.2 + (1 - Math.min(1, postureMotion * 0.7)) * 0.1);
  const engagement = clamp01(weightedAverage([
    { value: faceEngagement, weight: 0.78 },
    { value: voiceActivity, weight: 0.14 * voiceConfidence },
    { value: postureEngagement, weight: 0.08 * postureConfidence },
  ], faceEngagement));

  const scores: Record<Exclude<ObservedMood, 'neutral'>, number> = { happy, sad, tired, angry, surprised };
  const ranked = Object.entries(scores).sort((a, b) => b[1] - a[1]) as [Exclude<ObservedMood, 'neutral'>, number][];
  const [winner, top] = ranked[0];
  const second = ranked[1]?.[1] || 0;
  const faceConfidence = clamp01(top * 0.82 + Math.max(0, top - second) * 0.42);
  const confidence = clamp01(
    faceConfidence * 0.86 +
    voiceConfidence * 0.07 +
    postureConfidence * 0.04 +
    physiologyQuality * 0.015 +
    microConfidence * 0.015,
  );

  const dimensions: AffectDimensions = {
    valence,
    arousal,
    engagement,
    fatigue,
    tension,
  };

  const channels = {
    face: faceConfidence,
    voice: voiceConfidence,
    posture: postureConfidence,
    physiology: physiologyQuality,
    micro: microConfidence,
    baselineReady: 0,
  };

  const contextSignals: string[] = [];
  if (microKind !== 'none' && microConfidence >= 0.45) {
    contextSignals.push('Có một micro-expression ngắn (' + microKind + ') vừa xuất hiện; chỉ xem đây là chuyển động thoáng qua.');
  }
  if (postureConfidence >= 0.62 && postureSlump >= 0.55) {
    contextSignals.push('Hình học tư thế 2D đang cúi/co người hơn baseline; không diễn giải thành tình trạng sức khỏe.');
  } else if (postureConfidence >= 0.62 && postureUpright >= 0.72) {
    contextSignals.push('Tư thế 2D hiện khá thẳng và ổn định.');
  }
  if (physiologyQuality >= 0.65 && Math.abs(physiologyActivation) >= 0.35) {
    contextSignals.push(
      'rPPG thử nghiệm cho thấy xu hướng nhịp màu da ' +
      (physiologyActivation > 0 ? 'cao hơn' : 'thấp hơn') +
      ' baseline phiên; không coi đây là phép đo y tế.',
    );
  }
  const withContextSignals = (base: string) =>
    contextSignals.length ? base + ' ' + contextSignals.join(' ') : base;

  if (top < 0.28 || faceConfidence < 0.26) {
    return {
      ...neutralAffect(),
      confidence: clamp01(Math.max(0.16, faceConfidence * 0.62)),
      visualEnergy: clamp01(0.36 + arousal * 0.36),
      dimensions,
      channels,
      metrics: { positive, negative, fatigue, surprise, tension },
    };
  }

  const config: Record<Exclude<ObservedMood, 'neutral'>, Pick<AffectState, 'speechRate' | 'visualEnergy' | 'promptContext'>> = {
    happy: {
      speechRate: 1.02,
      visualEnergy: 0.76,
      promptContext: 'Camera thấy các tín hiệu cơ mặt thiên về tích cực như AU12/cheek raise. Đây là quan sát biểu cảm, không khẳng định trạng thái cảm xúc bên trong.',
    },
    sad: {
      speechRate: 0.92,
      visualEnergy: 0.34,
      promptContext: 'Camera thấy các tín hiệu cơ mặt trầm hơn như lip-corner depressor/frown. Đây chỉ là tín hiệu biểu cảm; nói nhẹ và không suy diễn nguyên nhân.',
    },
    tired: {
      speechRate: 0.9,
      visualEnergy: 0.28,
      promptContext: 'Camera thấy mắt hoặc tư thế có tín hiệu hoạt động thấp hơn bình thường. Đây chỉ là quan sát hành vi; nói ngắn hơn và tránh kết luận về sức khỏe.',
    },
    angry: {
      speechRate: 0.94,
      visualEnergy: 0.42,
      promptContext: 'Camera thấy tín hiệu căng ở brow/lip press. Không gán nhãn cảm xúc như sự thật; nói gọn, bình tĩnh và không suy diễn động cơ.',
    },
    surprised: {
      speechRate: 0.99,
      visualEnergy: 0.68,
      promptContext: 'Camera thấy jaw/eye/brow mở mạnh hơn baseline. Đây là tín hiệu hình ảnh; có thể xác nhận ngắn trước khi tiếp tục.',
    },
  };

  return {
    mood: winner,
    confidence,
    ...config[winner],
    promptContext: withContextSignals(config[winner].promptContext),
    dimensions,
    channels,
    metrics: { positive, negative, fatigue, surprise, tension },
  };
}

function loadBaseline(): BaselineState {
  try {
    if (typeof localStorage === 'undefined') return { count: 0, means: {} };
    const parsed = JSON.parse(localStorage.getItem(BASELINE_KEY) || 'null') as BaselineState | null;
    if (!parsed || !Number.isFinite(parsed.count) || typeof parsed.means !== 'object') return { count: 0, means: {} };
    return { count: Math.max(0, Math.min(20_000, parsed.count)), means: parsed.means || {} };
  } catch {
    return { count: 0, means: {} };
  }
}

function saveBaseline(state: BaselineState): void {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(BASELINE_KEY, JSON.stringify(state));
  } catch {
    /* local personalization is best effort */
  }
}

function baselineFeatures(sample: FaceAffectSample): Record<string, number> {
  return {
    smile: clamp01(sample.smile || 0),
    frown: clamp01(sample.frown || 0),
    browUp: clamp01(sample.browUp || 0),
    browDown: clamp01(sample.browDown || 0),
    jaw: clamp01(sample.jaw || 0),
    blink: clamp01(((sample.blinkL || 0) + (sample.blinkR || 0)) / 2),
    cheek: clamp01(sample.cheekSquint || 0),
    eyeWide: clamp01(sample.eyeWide || 0),
    mouthPress: clamp01(sample.mouthPress || 0),
  };
}

function blendDimensions(previous: AffectDimensions, next: AffectDimensions, alpha: number): AffectDimensions {
  return {
    valence: previous.valence + (next.valence - previous.valence) * alpha,
    arousal: previous.arousal + (next.arousal - previous.arousal) * alpha,
    engagement: previous.engagement + (next.engagement - previous.engagement) * alpha,
    fatigue: previous.fatigue + (next.fatigue - previous.fatigue) * alpha,
    tension: previous.tension + (next.tension - previous.tension) * alpha,
  };
}

export class AffectTracker {
  private current = neutralAffect();
  private candidate: ObservedMood = 'neutral';
  private candidateSince = 0;
  private baseline = loadBaseline();
  private baselineWrites = 0;

  private personalize(sample: FaceAffectSample): FaceAffectSample {
    if (this.baseline.count < 90) return sample;
    const features = baselineFeatures(sample);
    const adjusted = { ...sample };
    for (const key of BASELINE_FEATURES) {
      const mean = clamp01(this.baseline.means[key] || 0);
      const value = features[key];
      const centered = clamp01(value * 0.45 + Math.max(0, value - mean) * 0.88);
      if (key === 'blink') {
        adjusted.blinkL = centered;
        adjusted.blinkR = centered;
      } else if (key === 'cheek') {
        adjusted.cheekSquint = centered;
      } else {
        (adjusted as any)[key] = centered;
      }
    }
    return adjusted;
  }

  private observeBaseline(sample: FaceAffectSample, raw: AffectState): void {
    if (!sample.present) return;
    if (raw.mood !== 'neutral' && raw.confidence > 0.5) return;
    const features = baselineFeatures(sample);
    const nextCount = Math.min(20_000, this.baseline.count + 1);
    const rate = nextCount < 180 ? 1 / nextCount : 0.0045;
    for (const key of BASELINE_FEATURES) {
      const previous = Number(this.baseline.means[key] || 0);
      this.baseline.means[key] = previous + (features[key] - previous) * rate;
    }
    this.baseline.count = nextCount;
    this.baselineWrites += 1;
    if (this.baselineWrites >= 120) {
      this.baselineWrites = 0;
      saveBaseline(this.baseline);
    }
  }

  update(sample: FaceAffectSample, now = performance.now()): AffectState {
    const raw = inferAffect(this.personalize(sample));
    this.observeBaseline(sample, raw);
    raw.channels.baselineReady = clamp01(this.baseline.count / 180);

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

    const blendedDimensions = blendDimensions(this.current.dimensions, raw.dimensions, 0.24);

    if (raw.mood === this.current.mood) {
      this.current = {
        ...raw,
        confidence: this.current.confidence * 0.62 + raw.confidence * 0.38,
        dimensions: blendedDimensions,
      };
    } else if (now - this.candidateSince >= requiredStableMs && raw.confidence >= 0.42) {
      this.current = { ...raw, dimensions: blendedDimensions };
    } else if (!sample.present) {
      this.current = neutralAffect();
    } else {
      this.current = {
        ...this.current,
        dimensions: blendedDimensions,
        channels: raw.channels,
        metrics: raw.metrics,
      };
    }
    return this.current;
  }
}
