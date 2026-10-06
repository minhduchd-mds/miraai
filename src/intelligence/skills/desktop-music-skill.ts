import { desktopInvoke, isDesktopRuntime } from '../../desktop/bridge';
import type { MiraSkill } from './types';

export type DesktopMediaAction = 'open' | 'play' | 'pause' | 'next' | 'previous';

interface DesktopMediaActionResult {
  action: DesktopMediaAction;
  handled: boolean;
  detail: string;
}

function normalize(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function desktopMusicAction(input: string): DesktopMediaAction | null {
  const q = normalize(input);
  if (!q) return null;
  const mentionsMusic = /\b(nhac|music|bai hat|bai nhac|spotify|apple music)\b/.test(q);

  if (/\b(dung|tam dung|pause|ngung)\b/.test(q) && mentionsMusic) return 'pause';
  if (/\b(next|bai tiep|bai ke|bai khac|chuyen bai|qua bai)\b/.test(q)) return 'next';
  if (/\b(previous|bai truoc|quay lai bai)\b/.test(q)) return 'previous';
  if (/\b(mo|open)\b/.test(q) && mentionsMusic) return 'open';
  if (/\b(bat|play|tiep tuc)\b/.test(q) && mentionsMusic) return 'play';
  return null;
}

export function isExplicitDesktopMusicCommand(input: string): boolean {
  return desktopMusicAction(input) !== null;
}

export const desktopMusicSkill: MiraSkill = {
  id: 'desktop.music',
  description: 'Điều khiển media cục bộ trên Mira Desktop khi người dùng ra lệnh rõ ràng: mở/bật/dừng/chuyển bài.',
  priority: 120,
  risk: 'write',
  requiresNetwork: false,
  supportsVoice: true,
  capabilities: ['host.write'],
  examples: ['Bật nhạc đi em.', 'Dừng nhạc một chút.', 'Chuyển bài khác.', 'Mở nhạc cho đỡ im lặng.'],
  match(input) {
    if (!isDesktopRuntime()) return 0;
    return isExplicitDesktopMusicCommand(input) ? 0.99 : 0;
  },
  async execute(input) {
    const action = desktopMusicAction(input);
    if (!action) return null;
    const result = await desktopInvoke<DesktopMediaActionResult>('desktop_media_action', { action });
    const title = action === 'pause'
      ? 'Đã dừng nhạc'
      : action === 'next'
        ? 'Đã chuyển bài'
        : action === 'previous'
          ? 'Đã quay lại bài trước'
          : 'Đã gửi lệnh phát nhạc';
    return {
      skillId: 'desktop.music',
      speechHint: result.handled ? title : 'Em chưa điều khiển được trình phát nhạc trên máy.',
      content: {
        kind: 'card',
        data: { eyebrow: 'Mira Desktop · Music', title, body: result.detail },
      },
      data: result,
    };
  },
};
