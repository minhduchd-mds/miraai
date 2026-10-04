export type MiraPresenceScene =
  | 'daytime'
  | 'welcome-home'
  | 'home-evening'
  | 'bedtime';

export interface PresenceSceneInput {
  hour: number;
  presenceCue?: 'none' | 'return' | 'focus' | 'smile' | 'brow';
  presenceMode?: 'ambient' | 'attentive' | 'quiet' | 'reconnect';
  interactionState?: 'engaged' | 'focused' | 'looking_away' | 'returning' | 'absent' | 'uncertain';
  override?: MiraPresenceScene | null;
}

export const PRESENCE_SCENE_LABEL: Record<MiraPresenceScene, string> = {
  daytime: 'Ban ngày',
  'welcome-home': 'Về nhà',
  'home-evening': 'Ở nhà',
  bedtime: 'Đi ngủ',
};

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

export function resolvePresenceScene(input: PresenceSceneInput): MiraPresenceScene {
  if (input.override) return input.override;

  if (input.presenceCue === 'return' || input.interactionState === 'returning' || input.presenceMode === 'reconnect') {
    return 'welcome-home';
  }

  const hour = Number.isFinite(input.hour)
    ? Math.max(0, Math.min(23, Math.floor(input.hour)))
    : 20;

  if (hour >= 22 || hour < 6) return 'bedtime';
  if (hour >= 17) return 'home-evening';
  return 'daytime';
}
