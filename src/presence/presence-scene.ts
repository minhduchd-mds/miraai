export type MiraPresenceScene =
  | 'daytime'
  | 'welcome-home'
  | 'home-evening'
  | 'bedtime';

export interface PresenceReturnSample {
  dayKey: string;
  weekday: number;
  minuteOfDay: number;
  at: number;
}

export interface PresenceSceneInput {
  now?: Date | number;
  presenceCue?: 'none' | 'return' | 'focus' | 'smile' | 'brow';
  presenceMode?: 'ambient' | 'attentive' | 'quiet' | 'reconnect';
  interactionState?: 'engaged' | 'focused' | 'looking_away' | 'returning' | 'absent' | 'uncertain';
  expectedReturnMinute?: number;
  recentReturnAt?: number | null;
}

export const PRESENCE_SCENE_LABEL: Record<MiraPresenceScene, string> = {
  daytime: 'Ban ngày',
  'welcome-home': 'Về nhà',
  'home-evening': 'Ở nhà',
  bedtime: 'Đi ngủ',
};

export const PRESENCE_IMAGE: Record<MiraPresenceScene, string> = {
  daytime: '/mira-assets/scenes/scene_home_main.webp',
  'welcome-home': '/mira-assets/scenes/scene_welcome_home.webp',
  'home-evening': '/mira-assets/scenes/scene_relax_sofa.webp',
  bedtime: '/mira-assets/scenes/scene_bedtime.webp',
};

export const PRESENCE_SUBSCENE_IMAGE = {
  'cooking-together': '/mira-assets/scenes/scene_cooking_together.webp',
  'work-together': '/mira-assets/scenes/scene_work_together.webp',
  'bed-close': '/mira-assets/scenes/scene_bed_close.webp',
  sleep: '/mira-assets/scenes/scene_sleep.webp',
  morning: '/mira-assets/scenes/scene_morning.webp',
} as const;

export const EXPRESSION_ASSET = {
  gentle: 'expr_01_gentle.webp',
  smile: 'expr_02_smile.webp',
  wink: 'expr_03_wink.webp',
  kiss: 'expr_04_kiss.webp',
  shy: 'expr_05_shy.webp',
  surprise: 'expr_06_surprise.webp',
  sad: 'expr_07_sad_soft.webp',
  pout: 'expr_08_pout.webp',
  cute: 'expr_09_cute.webp',
  focus: 'expr_10_focus.webp',
  calm: 'expr_11_calm.webp',
  sleepy: 'expr_12_sleepy.webp',
} as const;

export type MiraExpression = keyof typeof EXPRESSION_ASSET;

export function expressionAssetUrl(name: MiraExpression): string {
  return `/mira-assets/expressions/${EXPRESSION_ASSET[name]}`;
}

export function nextPresenceScene(scene: MiraPresenceScene): MiraPresenceScene {
  if (scene === 'daytime') return 'welcome-home';
  if (scene === 'welcome-home') return 'home-evening';
  if (scene === 'home-evening') return 'bedtime';
  return 'daytime';
}

export function resolvePresenceExpression(input: {
  state?: 'idle' | 'listening' | 'thinking' | 'speaking' | 'interrupted' | 'error';
  mood?: 'happy' | 'sad' | 'tired' | 'angry' | 'surprised' | 'neutral';
  scene?: MiraPresenceScene;
  socialCue?: 'none' | 'wink_left' | 'wink_right' | 'brow_raise' | 'smile';
}): MiraExpression {
  const mood = input.mood || 'neutral';
  const state = input.state || 'idle';
  const scene = input.scene || 'home-evening';
  const cue = input.socialCue || 'none';

  if (cue === 'wink_left' || cue === 'wink_right') return 'wink';
  if (cue === 'smile' && mood === 'happy') return 'smile';
  if (mood === 'surprised' || cue === 'brow_raise') return 'surprise';
  if (mood === 'sad') return 'sad';
  if (mood === 'angry') return 'pout';
  if (mood === 'tired') return 'sleepy';
  if (state === 'thinking') return 'focus';
  if (state === 'listening') return 'gentle';
  if (state === 'speaking' && mood === 'happy') return 'smile';
  if (mood === 'happy') return 'smile';
  if (scene === 'bedtime') return 'calm';
  return 'gentle';
}

export const PRESENCE_SCENE_COPY: Record<MiraPresenceScene, { title: string; subtitle: string }> = {
  daytime: {
    title: 'Em ở đây cùng anh.',
    subtitle: 'Mira ở chế độ yên tĩnh, sẵn sàng khi anh gọi.',
  },
  'welcome-home': {
    title: 'Anh về rồi à?',
    subtitle: 'Vất vả rồi. Nghỉ một chút nhé, em đang nghe anh.',
  },
  'home-evening': {
    title: 'Tối nay mình ở nhà nhé.',
    subtitle: 'Mình cứ nói chuyện tự nhiên, không cần chạm vào màn hình.',
  },
  bedtime: {
    title: 'Ngủ ngon nhé anh.',
    subtitle: 'Em ở đây, nói chuyện nhỏ thôi trước khi mình nghỉ.',
  },
};

export const PRESENCE_SCHEDULE = {
  wakeMinute: 6 * 60,
  fallbackReturnMinute: 18 * 60,
  returnLearningMinMinute: 15 * 60 + 30,
  returnLearningMaxMinute: 21 * 60 + 30,
  welcomeLeadMinutes: 25,
  welcomeHoldMinutes: 75,
  recentReturnHoldMs: 90 * 60 * 1000,
  eveningWeekendMinute: 17 * 60,
  bedtimeMinute: 22 * 60 + 30,
  maxSamples: 14,
} as const;

function clampMinute(value: number): number {
  return Math.max(0, Math.min(23 * 60 + 59, Math.round(Number.isFinite(value) ? value : 0)));
}

export function presenceMinuteOfDay(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

export function presenceDayKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function isPresenceWorkday(weekday: number): boolean {
  return weekday >= 1 && weekday <= 5;
}

export function sanitizePresenceReturnSamples(input: unknown): PresenceReturnSample[] {
  if (!Array.isArray(input)) return [];
  return input
    .filter((item: any) =>
      item &&
      typeof item.dayKey === 'string' &&
      Number.isFinite(item.weekday) &&
      Number.isFinite(item.minuteOfDay) &&
      Number.isFinite(item.at)
    )
    .map((item: any) => ({
      dayKey: item.dayKey.slice(0, 10),
      weekday: Math.max(0, Math.min(6, Math.round(item.weekday))),
      minuteOfDay: clampMinute(item.minuteOfDay),
      at: Math.max(0, Number(item.at)),
    }))
    .sort((a, b) => a.at - b.at)
    .slice(-PRESENCE_SCHEDULE.maxSamples);
}

export function appendPresenceReturnSample(
  samples: PresenceReturnSample[],
  date: Date,
): PresenceReturnSample[] {
  const weekday = date.getDay();
  const minuteOfDay = presenceMinuteOfDay(date);

  if (!isPresenceWorkday(weekday)) return samples;
  if (
    minuteOfDay < PRESENCE_SCHEDULE.returnLearningMinMinute ||
    minuteOfDay > PRESENCE_SCHEDULE.returnLearningMaxMinute
  ) return samples;

  const dayKey = presenceDayKey(date);
  const existingIndex = samples.findIndex((sample) => sample.dayKey === dayKey);
  const sample: PresenceReturnSample = {
    dayKey,
    weekday,
    minuteOfDay,
    at: date.getTime(),
  };

  const next = existingIndex >= 0
    ? samples.map((item, index) => index === existingIndex ? sample : item)
    : [...samples, sample];

  return sanitizePresenceReturnSamples(next);
}

function median(values: number[]): number {
  if (!values.length) return PRESENCE_SCHEDULE.fallbackReturnMinute;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : Math.round((sorted[middle - 1] + sorted[middle]) / 2);
}

export function learnedPresenceReturnMinute(
  samples: PresenceReturnSample[],
): number {
  const workdayValues = sanitizePresenceReturnSamples(samples)
    .filter((sample) => isPresenceWorkday(sample.weekday))
    .slice(-10)
    .map((sample) => sample.minuteOfDay);

  if (!workdayValues.length) return PRESENCE_SCHEDULE.fallbackReturnMinute;

  if (workdayValues.length === 1) {
    return clampMinute(
      PRESENCE_SCHEDULE.fallbackReturnMinute * 0.7 +
      workdayValues[0] * 0.3,
    );
  }

  return Math.max(
    16 * 60 + 30,
    Math.min(20 * 60 + 30, median(workdayValues)),
  );
}

export function resolvePresenceScene(input: PresenceSceneInput): MiraPresenceScene {
  const now = input.now instanceof Date
    ? input.now
    : new Date(typeof input.now === 'number' ? input.now : Date.now());

  const nowMs = now.getTime();
  const minuteOfDay = presenceMinuteOfDay(now);
  const weekday = now.getDay();

  const recentReturn = Number(input.recentReturnAt || 0);
  if (
    recentReturn > 0 &&
    nowMs >= recentReturn &&
    nowMs - recentReturn <= PRESENCE_SCHEDULE.recentReturnHoldMs
  ) {
    return 'welcome-home';
  }

  if (
    input.presenceCue === 'return' ||
    input.interactionState === 'returning' ||
    input.presenceMode === 'reconnect'
  ) {
    return 'welcome-home';
  }

  if (
    minuteOfDay >= PRESENCE_SCHEDULE.bedtimeMinute ||
    minuteOfDay < PRESENCE_SCHEDULE.wakeMinute
  ) {
    return 'bedtime';
  }

  if (isPresenceWorkday(weekday)) {
    const expectedReturn = clampMinute(
      input.expectedReturnMinute ?? PRESENCE_SCHEDULE.fallbackReturnMinute,
    );
    const welcomeStart = Math.max(
      PRESENCE_SCHEDULE.wakeMinute,
      expectedReturn - PRESENCE_SCHEDULE.welcomeLeadMinutes,
    );
    const welcomeEnd = Math.min(
      PRESENCE_SCHEDULE.bedtimeMinute,
      expectedReturn + PRESENCE_SCHEDULE.welcomeHoldMinutes,
    );

    if (minuteOfDay >= welcomeStart && minuteOfDay <= welcomeEnd) {
      return 'welcome-home';
    }

    if (minuteOfDay > welcomeEnd && minuteOfDay < PRESENCE_SCHEDULE.bedtimeMinute) {
      return 'home-evening';
    }

    return 'daytime';
  }

  if (
    minuteOfDay >= PRESENCE_SCHEDULE.eveningWeekendMinute &&
    minuteOfDay < PRESENCE_SCHEDULE.bedtimeMinute
  ) {
    return 'home-evening';
  }

  return 'daytime';
}
